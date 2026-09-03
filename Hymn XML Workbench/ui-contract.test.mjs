import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('./app.js', import.meta.url), 'utf8');
const cleaner = readFileSync(new URL('./photo-cleaner.html', import.meta.url), 'utf8');
const jianpuRules = readFileSync(new URL('./JIANPU-ENCODING-RULES.md', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

const hasId = id => new RegExp(`id=["']${id}["']`).test(html);

test('project, file, and tab controls remain present', () => {
  for (const id of ['open-project', 'new-project', 'delete-project-launcher', 'project-save', 'unsaved-save-warning', 'project-add-input', 'project-change-input', 'project-delete-input', 'project-quit', 'major-tabs', 'source-processing-tab', 'editor-tab']) assert.equal(hasId(id), true, `missing #${id}`);
  for (const removed of ['project-reset', 'save-button', 'export-button', 'export-review-button']) assert.equal(hasId(removed), false, `obsolete #${removed}`);
  assert.doesNotMatch(html, /Check and save/);
  assert.match(html, /Save updates the working MusicXML, revised MusicXML, alignment JSON, and project state/);
  assert.equal(hasId('unsaved-change-message'), true);
});

test('development server and repository utility commands remain available', () => {
  assert.equal(packageJson.scripts.start, 'node server.mjs');
  for (const command of ['sync:hymn-display:help', 'sync:hymn-display:check', 'sync:hymn-display:pull', 'sync:hymn-display:push']) assert.equal(typeof packageJson.scripts[command], 'string', `missing npm script ${command}`);
});

test('source-processing stages remain ordered and addressable', () => {
  const ids = ['prepare-photo', 'extract-staff-layout', 'recognize-source-content', 'review-recognition'];
  for (const id of ids) assert.equal(hasId(id), true, `missing #${id}`);
  assert.deepEqual(ids.map(id => html.indexOf(`id="${id}"`)), ids.map(id => html.indexOf(`id="${id}"`)).toSorted((a, b) => a - b));
});

test('photo input accepts supported raster and Apple photo formats', () => {
  const accept = html.match(/id="source-photo-input"[^>]*accept="([^"]+)"/)?.[1] || '';
  for (const type of ['image/png', 'image/jpeg', 'image/tiff', 'image/webp', 'image/heic', 'image/heif']) assert.match(accept, new RegExp(type));
});

test('Jianpu editor keeps native editing, wrapping, validation, and spacing controls', () => {
  assert.match(html, /Jianpu Encoded Stream/);
  assert.match(html, /id="jianpu-input"[^>]*contenteditable="plaintext-only"/);
  for (const id of ['measures-per-line', 'all-measure-width-slider', 'measure-width-slider', 'symbol-width-slider', 'reset-spacing-button']) assert.equal(hasId(id), true, `missing #${id}`);
  assert.match(app, /jianpuParenthesisIssues/);
});

test('beat guides, Jianpu lyrics, and staff notes share one rendered timing map', () => {
  assert.match(app, /function measureTimingMap\(/);
  assert.match(app, /anchorTime = eventAnchorTime\(measure, event\)[\s\S]*?timing\.xAtTime\(anchorTime\)/);
  assert.match(app, /anchors\?\.xAtTime/);
  assert.match(app, /timing\.pxAtTime\(\(beat \+ \.5\) \* beatUnit\)/);
});

test('Jianpu meter markers replace global meter controls and persist into MusicXML', () => {
  assert.equal(hasId('entry-beats'), false);
  assert.equal(hasId('entry-beat-type'), false);
  assert.match(html, /<code>\{3\/4\}<\/code> meter \(continues until changed\)/);
  assert.match(app, /currentMeter = \{ beats: 4, beatType: 4 \}/);
  assert.match(app, /parsed\.push\(\{ events, repeatStart, rightMark, newSystem, \.\.\.currentMeter/);
  assert.match(app, /appendXmlText\(xml, time, 'beats', measureData\.beats\)/);
  assert.match(app, /appendXmlText\(xml, time, 'beat-type', measureData\.beatType\)/);
});

test('Jianpu Encoding Rules document the implemented timing contract', () => {
  for (const phrase of ['# Jianpu Encoding Rules', '{3/4}', 'Timed symbols', 'Attached symbols', 'Spanning symbols', 'Alignment contract']) assert.match(jianpuRules, new RegExp(phrase.replace(/[{}]/g, '\\$&')));
  assert.doesNotMatch(jianpuRules, /Direct-Entry Rules/i);
});

test('subdivisions use proportional widths and dotted duration stays attached', () => {
  assert.match(app, /event\.duration \/ Math\.max\(\.000001, measure\.timeBeats\) \* 100/);
  assert.match(app, /targetCenter - renderedCenter\) \/ renderedScale/);
  assert.match(html, /attached duration dot/);
});

test('rendered numeral centers, connected underlines, and slurs retain their visual contract', () => {
  assert.match(app, /renderedScale = events\.offsetWidth \? eventsBox\.width \/ events\.offsetWidth : 1/);
  assert.match(app, /targetCenter - renderedCenter\) \/ renderedScale/);
  assert.match(app, /function renderConnectedUnderlines\(/);
  assert.match(app, /lastCenter - firstCenter \+ Math\.max\(first\.width, last\.width\)/);
  assert.match(app, /return jianpuSymbolTime\(event\.beat - 1, measure\.beatType \|\| 4\)/);
  assert.match(app, /eventPercentInMeasure\(start\.event, measure\)/);
  assert.doesNotMatch(app, /renderedPercent = event =>/);
  assert.match(readFileSync(new URL('./styles.css', import.meta.url), 'utf8'), /\.slur-overlay \{[^}]*z-index:7;[^}]*top:calc\(17px/);
});

test('slur clearance uses controlled dot geometry instead of unreliable font boxes', () => {
  assert.match(app, /function positionSlurFromRenderedDotSize\(/);
  assert.match(app, /sectionBox\.width \/ section\.offsetWidth/);
  assert.match(app, /getBoundingClientRect\(\)\.height/);
  assert.match(app, /currentTop - renderedDotDiameter/);
  assert.doesNotMatch(app, /renderedGap > 0/);
  const realignment = app.match(/function scheduleStaffRealignment\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(realignment, /renderSlurOverlays\(grid\)/);
});

test('sustain symbols receive beat-center anchors while duration dots remain attached', () => {
  assert.match(app, /part\?\.name !== 'sustain line'/);
  assert.match(app, /sustainTime = Number\(event\.beat - 1\) \+ Number\(part\.offset\) \+ timing\.beatUnit \/ 2/);
  assert.match(app, /sustainTarget - sustainCenter\) \/ renderedScale/);
});

test('duration dots are vertically centered on their preceding numeral', () => {
  assert.match(app, /part\?\.name === 'duration dot'/);
  assert.match(app, /currentDegreeBox\.top \+ currentDegreeBox\.bottom/);
  assert.match(app, /mark\.style\.transform = `translateY\(\$\{verticalOffset\}px\)`/);
});

test('Jianpu symbols remain closer in scale to Chinese lyrics', () => {
  assert.match(app, /'--jianpu-font': 18/);
  assert.match(app, /'--zh-font': 20/);
});

test('encoded octave marks use a stable key-tonic reference', () => {
  const tonicReference = app.match(/function tonicMidi\(\) \{[\s\S]*?\n\}/)?.[0] || '';
  assert.match(tonicReference, /return 60 \+ \(\(tonicPc \+ 12\) % 12\)/);
  assert.doesNotMatch(tonicReference, /median|state\.events/);
  assert.match(app, /applyJianpuOctaveModifier\(event, modifier\)/);
  assert.match(app, /entry\.octave \* 12/);
  assert.match(app, /hymn-play-jianpu-octave/);
  assert.match(app, /Number\.isInteger\(event\.jianpuOctave\) \? event\.jianpuOctave/);
  assert.match(app, /setPitch\(delta, operation === 'octave-down' \? -1 : operation === 'octave-up' \? 1 : 0\)/);
  assert.match(app, /function setEventJianpuOctave\(event, nextOctave\)/);
  assert.match(app, /setEventJianpuOctave\(event, currentOctave \+ octaveDelta\)/);
  assert.match(app, /setEventJianpuOctave\(rebuiltEvent, parsedEvent\.octave\)/);
  assert.match(app, /\$\('#jianpu-input'\)\.value = directEntryTextFromScore\(\)/);
  assert.match(app, /function octaveDotsHtml\(count\)/);
  assert.match(app, /\.octave-mark\.upper \.octave-dot/);
  assert.match(app, /\.octave-mark\.lower \.octave-dot/);
  assert.match(app, /\["'", '’', '′', ',', '，'\]\.includes\(char\)/);
  assert.match(app, /applyJianpuOctaveModifier\(previous, char\)/);
});

test('Jianpu selection follows the symbol box and octave dots stack vertically', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.event\.selected \.notation-core/);
  assert.doesNotMatch(styles, /\.event\.selected \{[^}]*background/);
  assert.match(styles, /\.octave-mark \{[^}]*flex-direction:column/);
  assert.match(styles, /\.octave-mark\.lower \{[^}]*justify-content:flex-start/);
  assert.match(styles, /\.octave-dot \{[^}]*border-radius:50%/);
  assert.match(styles, /\.octave-mark\.upper \{[^}]*top:calc\(5px \* var\(--measure-scale\)\)[^}]*padding-bottom:calc\(\.208px \* var\(--measure-scale\)\)/);
  assert.match(styles, /\.octave-mark\.lower \{[^}]*padding-top:calc\(\.104px \* var\(--measure-scale\)\)/);
  assert.match(styles, /\.octave-dot \{[^}]*width:calc\(3\.556px \* var\(--measure-scale\)\)[^}]*height:calc\(3\.556px \* var\(--measure-scale\)\)/);
  assert.match(app, /upperDot\.getBoundingClientRect\(\)\.height \/ renderedScale/);
  assert.match(app, /-lowerDot\.getBoundingClientRect\(\)\.height \/ renderedScale/);
  assert.match(app, /querySelectorAll\('\.octave-mark\.upper \.octave-dot'\)/);
  assert.match(app, /currentTop - renderedDotDiameter/);
  assert.match(app, /querySelector\('\.degree-glyph'\)\.getBoundingClientRect\(\)/);
  assert.match(styles, /\.degree-glyph \{[^}]*line-height:1/);
});

test('visual and behavior assets use the same cache-busting build key', () => {
  const styleVersion = html.match(/styles\.css\?v=([^"']+)/)?.[1];
  const appVersion = html.match(/app\.js\?v=([^"']+)/)?.[1];
  assert.ok(styleVersion, 'stylesheet build key is required');
  assert.equal(styleVersion, appVersion);
});

test('every parsed Jianpu symbol is checked against MusicXML and visible rendering', () => {
  const validator = app.match(/function validateParsedJianpuRender\(parsedMeasures\) \{[\s\S]*?\n\}/)?.[0] || '';
  for (const contract of ['meter', 'system break', 'repeat-start', 'ending barline', 'timed symbols', 'octave or accidental', 'duration', 'octave mark', 'sustain or duration dot', 'connected underline', 'slur', 'meter beat guides']) assert.match(validator, new RegExp(contract));
  assert.match(app, /validateParsedJianpuRender\(measures\)/);
  assert.match(app, /renderWarnings\.length \? 'warning'/);
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.jianpu-entry-status\.warning/);
  assert.match(styles, /\.measure\.render-warning, \.event\.render-warning/);
});

test('Jianpu preview reports failures from every post-parse stage inline', () => {
  assert.match(app, /function updateNotationPreviewFromJianpu\(\)/);
  assert.match(app, /Update failed after parsing the Jianpu stream/);
  assert.match(app, /addEventListener\('click', updateNotationPreviewFromJianpu\)/);
  assert.match(app, /querySelector\('score-partwise > part\[id="P1"\]'\)/);
  assert.match(app, /generated MusicXML melody part could not be created/);
  assert.doesNotMatch(app, /querySelector\('part#P1'\)/);
  assert.match(app, /<midi-program>1<\/midi-program><\/midi-instrument>/);
  assert.match(app, /xml\.querySelector\('parsererror'\)/);
});

test('measure viewports finish grid sizing before alignment is measured', () => {
  const renderGrid = app.match(/function renderGrid\(\) \{[\s\S]*?\n\}\n\nfunction measureCapacityMeterHtml/)?.[0] || '';
  const sizing = renderGrid.indexOf("style.setProperty('--system-measure-count'");
  const alignment = renderGrid.indexOf('alignStaffEditorToJianpu(section, measure)', sizing);
  assert.ok(sizing >= 0, 'system sizing must be applied');
  assert.ok(alignment > sizing, 'alignment must be measured only after system sizing');
  assert.equal(renderGrid.slice(0, sizing).includes('alignStaffEditorToJianpu(section, measure)'), false, 'premature alignment leaves an empty right strip');
});

test('resizing the Editor realigns Jianpu, lyrics, guides, and staff notation', () => {
  const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');
  const observer = app.match(/new ResizeObserver\(entries => \{[\s\S]*?\}\)\.observe\(\$\('\.workspace'\)\);/)?.[0] || '';
  assert.match(observer, /state\.containerSize/);
  assert.match(observer, /scheduleStaffRealignment\(\)/);
  assert.match(styles, /\.workspace \{[^}]*max-width:none;[^}]*resize:none;/);
  assert.match(styles, /\.editor \{[^}]*overflow-x:auto;[^}]*overflow-y:visible;/);
  assert.match(styles, /\.workspace-resize-handle \{[^}]*position:fixed;/);
  assert.match(html, /id="workspace-resize-handle"[^>]*aria-label="Resize notation workspace horizontally and vertically"/);
  assert.match(app, /workspaceResizeHandle\.addEventListener\('pointerdown'/);
  assert.match(app, /document\.body\.append\(workspaceResizeHandle\)/);
  assert.match(app, /pointer\.clientX - start\.x\) \/ uiZoom/);
  assert.match(app, /pointer\.clientY - start\.y\) \/ uiZoom/);
  assert.match(app, /function positionWorkspaceResizeHandle\(\)/);
  assert.match(app, /Math\.min\(workspaceBox\.right, editorBox\.right, window\.innerWidth\)/);
  assert.match(app, /Math\.min\(workspaceBox\.bottom, window\.innerHeight\)/);
  assert.match(app, /window\.addEventListener\('scroll', positionWorkspaceResizeHandle/);
});

test('Automatic layout honors exact user-authored @ system lengths without inference', () => {
  assert.match(html, /Automatic \(use exact @ breaks\)/);
  assert.match(app, /--system-measure-count/);
  assert.doesNotMatch(app, /inferAutomaticMeasuresPerLine|automatic-measures-per-line/);
});

test('Hymn Editor sidebar has complete Chinese and English panes without numbered steps', () => {
  for (const id of ['chinese-sidebar-pane', 'english-sidebar-pane', 'language-token-card']) assert.equal(hasId(id), true, `missing #${id}`);
  assert.match(html, /data-language="1"[^>]*aria-controls="chinese-sidebar-pane"/);
  assert.match(html, /data-language="2"[^>]*aria-controls="english-sidebar-pane"/);
  const editorMarkup = html.slice(html.indexOf('<section id="editor"'), html.indexOf('<dialog id="new-project-dialog"'));
  assert.doesNotMatch(editorMarkup, />\s*Step\s+\d/i);
});

test('project Save writes working, revised, and alignment artifacts and clears its warning', () => {
  assert.match(app, /working\/draft\/\$\{draftName\}/);
  assert.match(app, /`\$\{projectSession\.name\}-working\.musicxml`/);
  assert.match(app, /output\/musicxml\/\$\{outputName\}/);
  assert.match(app, /output\/reports\/\$\{reviewName\}/);
  assert.match(app, /state\.history=\[\];state\.future=\[\];updateUnsavedIndicator\(\)/);
  assert.match(app, /unsaved-save-warning/);
  assert.match(app, /summary\.classList\.toggle\('dirty',dirty\)/);
  assert.match(app, /warning\.classList\.toggle\('hidden',!dirty\)/);
  assert.doesNotMatch(app, /function resetProjectWorkingState|function saveWorkingCopy|function exportXml|function exportReview/);
});

test('photo preparation retains its essential controls', () => {
  for (const id of ['protect-symbols', 'remove-background', 'toggle-eraser', 'eraser-shape', 'eraser-size', 'undo-eraser', 'rotate-left', 'rotate-right', 'reset-rotation', 'preview']) assert.match(cleaner, new RegExp(`id=["']${id}["']`), `missing photo cleaner #${id}`);
});
