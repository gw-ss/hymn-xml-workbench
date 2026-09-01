import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { basename, extname, join, resolve } from 'node:path';

const root = resolve(import.meta.dirname);
const projectRoot = root;
const hymnDisplayData = process.env.HYMN_DISPLAY_DATA || join(projectRoot, 'vendor', 'hymn-display', 'app', 'data', 'hymns-001-848.review.json');
const port = Number(process.env.PORT || 4174);
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8' };
let hymnDatabase;
function loadHymnDatabase() {
  if (!hymnDatabase) hymnDatabase = JSON.parse(readFileSync(hymnDisplayData, 'utf8'));
  return hymnDatabase;
}
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const hymnMatch = pathname.match(/^\/api\/hymn\/(\d+)$/);
  if (request.method === 'GET' && pathname === '/api/hymns') {
    try {
      const hymns = loadHymnDatabase().hymns.map(({ number, titles, sections }) => ({
        number,
        titles,
        verseCount: sections.filter(section => section.kind === 'verse').length,
      }));
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ hymns }));
    } catch (error) {
      response.writeHead(500, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: error.message }));
    }
    return;
  }
  if (request.method === 'GET' && hymnMatch) {
    try {
      const database = loadHymnDatabase();
      const hymn = database.hymns.find(item => item.number === Number(hymnMatch[1]));
      if (!hymn) { response.writeHead(404, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: 'Hymn not found.' })); return; }
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(hymn));
    } catch (error) { response.writeHead(500, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message })); }
    return;
  }
  if (request.method === 'POST' && pathname === '/api/save') {
    const chunks = []; let size = 0;
    request.on('data', chunk => { size += chunk.length; if (size > 10 * 1024 * 1024) request.destroy(); else chunks.push(chunk); });
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (typeof payload.xml !== 'string' || !payload.xml.includes('<score-partwise')) throw new Error('The working copy is not valid partwise MusicXML.');
        const stem = basename(String(payload.filename || 'hymn.musicxml')).replace(/\.(musicxml|xml)$/i, '').replace(/(?:-aligned)+$/i, '').replace(/[^a-zA-Z0-9._-]+/g, '-');
        const xmlDir = join(projectRoot, 'output', 'musicxml'), reviewDir = join(projectRoot, 'output', 'alignment');
        mkdirSync(xmlDir, { recursive: true }); mkdirSync(reviewDir, { recursive: true });
        const xmlName = `${stem}-aligned.musicxml`, reviewName = `${stem}-alignment.json`;
        const xmlPath = join(xmlDir, xmlName), reviewPath = join(reviewDir, reviewName);
        if (!payload.overwrite && (existsSync(xmlPath) || existsSync(reviewPath))) {
          response.writeHead(409, { 'content-type': 'application/json' });
          response.end(JSON.stringify({ error: 'A saved working copy already exists.', xmlPath: `output/musicxml/${xmlName}`, reviewPath: `output/alignment/${reviewName}` }));
          return;
        }
        writeFileSync(xmlPath, payload.xml, 'utf8');
        writeFileSync(reviewPath, `${JSON.stringify(payload.review, null, 2)}\n`, 'utf8');
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ xmlPath: `output/musicxml/${xmlName}`, reviewPath: `output/alignment/${reviewName}` }));
      } catch (error) {
        response.writeHead(400, { 'content-type': 'application/json' }); response.end(JSON.stringify({ error: error.message }));
      }
    });
    return;
  }
  const candidate = resolve(join(root, pathname === '/' ? 'index.html' : pathname));
  if (!candidate.startsWith(root) || !existsSync(candidate) || !statSync(candidate).isFile()) { response.writeHead(404); response.end('Not found'); return; }
  response.writeHead(200, { 'content-type': types[extname(candidate)] || 'application/octet-stream', 'cache-control':'no-store' });
  createReadStream(candidate).pipe(response);
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
    console.error(`The workbench may already be running at http://127.0.0.1:${port}`);
    console.error(`To use another port: PORT=4175 npm start`);
    process.exitCode = 1;
    return;
  }
  throw error;
});

server.listen(port, '127.0.0.1', () => console.log(`MusicXML Workbench is available at http://127.0.0.1:${port}`));
