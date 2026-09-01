import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';

const projectRoot = resolve(import.meta.dirname, '..');
const displayRoot = resolve(process.env.HYMN_DISPLAY_PROJECT || '/Users/garrywu/Documents/ChatGPT/Hymn Display');
const mirrorRoot = join(projectRoot, 'vendor', 'hymn-display');
const roots = ['app/data', 'db', 'drizzle', 'docs/sql'];
const singleFiles = ['drizzle.config.ts'];
if (process.argv.includes('--help')) {
  console.log(`Hymn Display synchronization commands

  npm run sync:hymn-display:check   Compare both projects; change nothing
  npm run sync:hymn-display:pull    Copy corrections from Hymn Display to Hymn XML Workbench
  npm run sync:hymn-display:push    Copy corrections from Hymn XML Workbench to Hymn Display

Memory aid: CHECK first, then PULL toward this project or PUSH away from it.
Full guide: docs/hymn-display-sync.md`);
  process.exit(0);
}
const mode = process.argv.includes('--from-display') ? 'pull'
  : process.argv.includes('--to-display') ? 'push'
    : process.argv.includes('--check') ? 'check' : null;

if (!mode) {
  console.error('Use --check, --from-display, or --to-display.');
  process.exit(2);
}
if (mode === 'push' && !process.argv.includes('--confirm-write-to-display')) {
  console.error('Refusing to write to Hymn Display without --confirm-write-to-display.');
  process.exit(2);
}

function walk(root, path = root) {
  if (!existsSync(path)) return [];
  if (statSync(path).isFile()) return [relative(root, path)];
  return readdirSync(path).flatMap(name => walk(root, join(path, name)));
}

function managedPaths() {
  const paths = new Set(singleFiles);
  for (const folder of roots) {
    const displayFolder = join(displayRoot, folder);
    const mirrorFolder = join(mirrorRoot, folder);
    for (const rel of walk(displayFolder)) paths.add(join(folder, rel));
    for (const rel of walk(mirrorFolder)) paths.add(join(folder, rel));
  }
  return [...paths].sort();
}

function checksum(path) {
  if (!existsSync(path)) return null;
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

let different = 0;
let copied = 0;
for (const rel of managedPaths()) {
  const displayPath = join(displayRoot, rel);
  const mirrorPath = join(mirrorRoot, rel);
  const displayHash = checksum(displayPath);
  const mirrorHash = checksum(mirrorPath);
  if (displayHash === mirrorHash && displayHash !== null) continue;
  different += 1;
  if (mode === 'check') {
    console.log(`${!displayHash ? 'MISSING DISPLAY' : !mirrorHash ? 'MISSING MIRROR' : 'DIFFERENT'}  ${rel}`);
    continue;
  }
  const source = mode === 'pull' ? displayPath : mirrorPath;
  const target = mode === 'pull' ? mirrorPath : displayPath;
  if (!existsSync(source)) {
    console.error(`Cannot ${mode}: source is missing: ${source}`);
    process.exitCode = 1;
    continue;
  }
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  copied += 1;
  console.log(`COPIED  ${rel}`);
}

if (mode === 'check') {
  if (different) {
    console.error(`${different} managed file(s) differ. Review them, then pull or push deliberately.`);
    process.exitCode = 1;
  } else {
    console.log('Hymn Display and Hymn XML Workbench mirrors match exactly.');
  }
} else {
  console.log(`${copied} file(s) copied ${mode === 'pull' ? 'from Hymn Display' : 'to Hymn Display'}.`);
}
