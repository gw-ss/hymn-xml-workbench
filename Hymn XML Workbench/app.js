import { MAJOR_STEPS, applyJianpuOctaveModifier, chooseChineseLyricAnchors, chooseStaffBeamRange, clampMeasureWidth, combineCompatibleStaffBeamGroups, durationClass, jianpuDurationSuffix, jianpuForMidi, jianpuForSpelledPitch, jianpuParenthesisIssues, jianpuSymbolTime, measureCapacityInQuarterNotes, measureCapacityMeter, measureContentScale, musicXmlTypeForBeats, normalizePhotoConflicts, normalizeSpacingSettings, parseJianpuMeterMarker, pickupControlsForDuration, pickupDurationInQuarterNotes, pitchFromMidi, tokenizeChinese, tokenizeEnglish, unresolvedPhotoConflicts, validatePickupDuration } from './core.mjs';
import { assessStaffPhotoQuality, extractStaffRegions } from './photo-recognition.mjs';

const $ = selector => document.querySelector(selector);
const jianpuEditor = $('#jianpu-input');
Object.defineProperty(jianpuEditor, 'value', { configurable:true, get(){return this.innerText.replace(/\u00a0/g,' ');}, set(value){this.textContent=String(value??'');} });
const UI_ZOOM_KEY='hymn-workbench-ui-zoom';
let uiZoom=Math.min(2,Math.max(.5,Number(localStorage.getItem(UI_ZOOM_KEY))||1));
function applyUiZoom(){document.documentElement.style.zoom=String(uiZoom);localStorage.setItem(UI_ZOOM_KEY,String(uiZoom));}
function changeUiZoom(direction){uiZoom=direction===0?1:Math.min(2,Math.max(.5,Math.round((uiZoom+direction*.1)*10)/10));applyUiZoom();requestAnimationFrame(positionWorkspaceResizeHandle);}
function handleUiZoomShortcut(event){if(!(event.metaKey||event.ctrlKey))return;const key=event.key;if(key==='+'||key==='='){event.preventDefault();changeUiZoom(1);}else if(key==='-'||key==='_'){event.preventDefault();changeUiZoom(-1);}else if(key==='0'){event.preventDefault();changeUiZoom(0);}}
applyUiZoom();document.addEventListener('keydown',handleUiZoomShortcut);
const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const KEYS = { '-7': ['Cb', 11], '-6': ['Gb', 6], '-5': ['Db', 1], '-4': ['Ab', 8], '-3': ['Eb', 3], '-2': ['Bb', 10], '-1': ['F', 5], 0: ['C', 0], 1: ['G', 7], 2: ['D', 2], 3: ['A', 9], 4: ['E', 4], 5: ['B', 11], 6: ['F#', 6], 7: ['C#', 1] };
const state = { xml: null, filename: '', events: [], measures: [], fifths: 0, activeLanguage: '1', tokens: { 1: [], 2: [] }, assignments: { 1: new Map(), 2: new Map() }, staffNotes: [], staffAssignments: new Map(), photoConflicts: [], staffPhoto: null, staffRegisters: { treble: 0, bass: 0 }, spacing: { measureWidth: 320, symbolWidth: 56, measuresPerLine: 'auto' }, containerSize: null, layoutProfiles: {}, firstNoteOffsets: new Map(), measureWidths: new Map(), nextStaffNoteId: 1, selectedStaffNoteId: null, staffBeamMode: null, staffBeamStartId: null, selectedTokenId: null, shiftAnchorTokenId: null, selectedEventId: null, selectedContinuation: null, history: [], future: [] };

function setupKeySignaturePicker() {
  const picker = $('#key-signature-picker'), staffs = [...document.querySelectorAll('.key-staff')];
  const majorMinor = {
    flat: [['C major', 'A minor'], ['F major', 'D minor'], ['B♭ major', 'G minor'], ['E♭ major', 'C minor'], ['A♭ major', 'F minor'], ['D♭ major', 'B♭ minor'], ['G♭ major', 'E♭ minor'], ['C♭ major', 'A♭ minor']],
    sharp: [['C major', 'A minor'], ['G major', 'E minor'], ['D major', 'B minor'], ['A major', 'F♯ minor'], ['E major', 'C♯ minor'], ['B major', 'G♯ minor'], ['F♯ major', 'D♯ minor'], ['C♯ major', 'A♯ minor']],
  };
  const letterNames = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const middleBottom = { treble: 30, bass: 18 }; // E4 and G2 bottom staff lines.
  const standardOrder = { sharp: ['F', 'C', 'G', 'D', 'A', 'E', 'B'], flat: ['B', 'E', 'A', 'D', 'G', 'C', 'F'] };
  const registerNames = ['Lower group', 'Middle group', 'Upper group'];
  const registers = { treble: 0, bass: 0 };
  const selections = [];
  let kind = 'flat', locked = false, selectedId = null, nextSelectionId = 1;
  const svgElement = (name, attributes = {}) => {
    const element = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  };
  function noteAt(clefName, register, row) {
    const absolute = middleBottom[clefName] + register * 9 + row;
    return { absolute, letter: letterNames[((absolute % 7) + 7) % 7], octave: Math.floor(absolute / 7) };
  }
  function rowForSelection(selection, clefName, register) {
    return selection.sourceClef === clefName ? selection.absolute - (middleBottom[clefName] + register * 9) : -1;
  }
  function draw(staff) {
    const svg = staff.querySelector('svg'), clefName = staff.dataset.clef, register = registers[clefName]; svg.replaceChildren();
    staff.querySelector('.key-register-label').textContent = registerNames[register + 1];
    staff.querySelector('[data-register-up]').disabled = locked || register === 1;
    staff.querySelector('[data-register-down]').disabled = locked || register === -1;
    for (let row = 0; row < 9; row += 1) {
      const y = 68 - row * 5, hit = svgElement('rect', { x: 0, y: y - 2.5, width: 260, height: 5, fill: 'transparent', class: 'key-hit-row', 'data-row': row });
      const title = svgElement('title'); const note = noteAt(clefName, register, row); title.textContent = `${note.letter}${note.octave}`; hit.append(title); svg.append(hit);
    }
    for (let line = 0; line < 5; line += 1) svg.append(svgElement('line', { x1: 8, y1: 28 + line * 10, x2: 252, y2: 28 + line * 10, stroke: 'currentColor', 'stroke-width': 1, 'pointer-events': 'none' }));
    const clef = svgElement('text', { x: 15, y: clefName === 'treble' ? 66 : 58, 'font-family': 'Times New Roman, serif', 'font-size': clefName === 'treble' ? 53 : 40, fill: 'currentColor', 'pointer-events': 'none' });
    clef.textContent = clefName === 'treble' ? '𝄞' : '𝄢'; svg.append(clef);
    let visibleIndex = 0;
    for (const selection of selections) {
      const row = rowForSelection(selection, clefName, register); if (row < 0 || row > 8) continue;
      const x = 72 + visibleIndex * 20, pitchY = 68 - row * 5, y = pitchY + 7;
      const hit = svgElement('rect', { x: x - 5, y: pitchY - 11, width: 21, height: 22, rx: 4, class: `key-symbol-hit${selectedId === selection.id ? ' selected' : ''}`, 'data-selection-id': selection.id });
      const title = svgElement('title'); title.textContent = `Select ${selection.letter}${selection.kind === 'flat' ? '♭' : '♯'} for deletion`; hit.append(title); svg.append(hit);
      const symbol = svgElement('text', { x, y, 'font-family': 'Times New Roman, serif', 'font-size': selection.kind === 'flat' ? 21 : 19, 'font-weight': 700, fill: 'currentColor', 'pointer-events': 'none' });
      symbol.textContent = selection.kind === 'flat' ? '♭' : '♯'; svg.append(symbol); visibleIndex += 1;
    }
  }
  function redraw() { staffs.forEach(draw); }
  function setFromFifths(value) {
    const fifths = Math.max(-7, Math.min(7, Number(value) || 0));
    const importedPositions = {
      treble: { flat: [34, 37, 33, 36, 32, 35, 31], sharp: [38, 35, 39, 36, 33, 37, 34] },
      bass: { flat: [20, 23, 19, 22, 18, 21, 17], sharp: [24, 21, 25, 22, 19, 23, 20] },
    };
    selections.splice(0); selectedId = null; nextSelectionId = 1;
    kind = fifths < 0 ? 'flat' : 'sharp';
    const count = Math.abs(fifths);
    if (count) for (const clefName of ['treble', 'bass']) {
      importedPositions[clefName][kind].slice(0, count).forEach(absolute => selections.push({ id: nextSelectionId++, sourceClef: clefName, absolute, letter: letterNames[((absolute % 7) + 7) % 7], kind }));
    }
    $('#entry-key').value = String(fifths);
    if (!count) $('#entry-key-display').value = 'No sharps or flats — C major / A minor';
    else {
      const [major, minor] = majorMinor[kind][count];
      $('#entry-key-display').value = `${count} ${kind}${count === 1 ? '' : 's'} — ${major} / ${minor}`;
    }
    $('#key-position-readout').textContent = count ? `Imported ${count} ${kind}${count === 1 ? '' : 's'} from MusicXML.` : 'Imported key signature has no sharps or flats.';
    locked = true; picker.classList.add('locked'); $('#finish-key-signature').textContent = 'Change selection';
    document.querySelectorAll('[data-key-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.keyKind === kind)));
    redraw();
  }
  function chooseKind(nextKind) {
    if (locked) return;
    kind = nextKind;
    document.querySelectorAll('[data-key-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.keyKind === kind)));
  }
  document.querySelectorAll('[data-key-kind]').forEach(button => button.addEventListener('click', () => chooseKind(button.dataset.keyKind)));
  staffs.forEach(staff => {
    const clefName = staff.dataset.clef;
    staff.querySelector('[data-register-up]').addEventListener('click', () => { if (!locked && registers[clefName] < 1) { registers[clefName] += 1; redraw(); } });
    staff.querySelector('[data-register-down]').addEventListener('click', () => { if (!locked && registers[clefName] > -1) { registers[clefName] -= 1; redraw(); } });
    staff.querySelector('svg').addEventListener('click', event => {
      if (locked) return;
      const requestedId = Number(event.target.dataset.selectionId);
      if (requestedId) {
        selectedId = requestedId;
        const selected = selections.find(item => item.id === selectedId);
        $('#key-position-readout').textContent = `${selected.letter}${selected.kind === 'flat' ? '♭' : '♯'} selected. Press Delete or Backspace to remove it.`;
        redraw(); return;
      }
      const svg = event.currentTarget, box = svg.getBoundingClientRect(), y = (event.clientY - box.top) * 96 / box.height;
      const row = Math.max(0, Math.min(8, Math.round((68 - y) / 5))), note = noteAt(clefName, registers[clefName], row);
      const existing = selections.find(item => item.sourceClef === clefName && item.absolute === note.absolute && item.kind === kind);
      if (existing) selectedId = existing.id;
      else { const added = { id: nextSelectionId++, sourceClef: clefName, absolute: note.absolute, letter: note.letter, kind }; selections.push(added); selectedId = added.id; }
      const accidental = kind === 'flat' ? '♭' : '♯';
      $('#key-position-readout').textContent = `${existing ? 'Selected' : 'Added and selected'} ${note.letter}${accidental} on the ${clefName} ${registerNames[registers[clefName] + 1].toLowerCase()}. Press Delete or Backspace to remove it.`;
      $('#entry-key').value = ''; $('#entry-key-display').value = 'Not generated yet'; redraw();
    });
  });
  $('#clear-key-signature').addEventListener('click', () => { if (!locked) { selections.splice(0); selectedId = null; $('#key-position-readout').textContent = 'No symbols selected.'; $('#entry-key').value = ''; $('#entry-key-display').value = 'Not generated yet'; redraw(); } });
  document.addEventListener('keydown', event => {
    if (locked || selectedId === null || !['Delete', 'Backspace'].includes(event.key) || event.target.matches('input, textarea, select, [contenteditable]')) return;
    const index = selections.findIndex(item => item.id === selectedId); if (index < 0) return;
    const [removed] = selections.splice(index, 1); selectedId = null; event.preventDefault();
    $('#key-position-readout').textContent = `Removed ${removed.letter}${removed.kind === 'flat' ? '♭' : '♯'}.`;
    $('#entry-key').value = ''; $('#entry-key-display').value = 'Not generated yet'; redraw();
  });
  $('#finish-key-signature').addEventListener('click', event => {
    if (locked) { locked = false; picker.classList.remove('locked'); event.currentTarget.textContent = 'Done'; return; }
    const unique = [...new Map(selections.map(item => [`${item.kind}:${item.letter}`, item])).values()];
    if (!unique.length) {
      $('#entry-key').value = '0'; $('#entry-key-display').value = 'No sharps or flats — C major / A minor';
    } else {
      const kinds = new Set(unique.map(item => item.kind)), selectedKind = kinds.size === 1 ? unique[0].kind : null;
      const letters = new Set(unique.map(item => item.letter));
      const count = selectedKind ? standardOrder[selectedKind].findIndex((_, index) => {
        const expected = new Set(standardOrder[selectedKind].slice(0, index + 1));
        return expected.size === letters.size && [...expected].every(letter => letters.has(letter));
      }) + 1 : 0;
      if (!selectedKind || !count) {
        $('#entry-key').value = ''; $('#entry-key-display').value = `Unusual signature — ${unique.map(item => `${item.letter}${item.kind === 'flat' ? '♭' : '♯'}`).join(', ')} — review needed`;
      } else {
        const fifths = selectedKind === 'flat' ? -count : count, [major, minor] = majorMinor[selectedKind][count];
        $('#entry-key').value = String(fifths); $('#entry-key-display').value = `${count} ${selectedKind}${count === 1 ? '' : 's'} — ${major} / ${minor}`;
      }
    }
    locked = true; picker.classList.add('locked'); event.currentTarget.textContent = 'Change selection';
    selectedId = null;
    redraw();
  });
  redraw();
  return { setFromFifths };
}

function midi(note) {
  const pitch = note.querySelector(':scope > pitch');
  return (Number(pitch.querySelector('octave').textContent) + 1) * 12 + STEP[pitch.querySelector('step').textContent] + Number(pitch.querySelector('alter')?.textContent || 0);
}

function parseScore(xml) {
  let divisions = 1, fifths = 0, measureBeats = 4, measureBeatType = 4;
  const events = [], measures = [];
  for (const measure of xml.querySelectorAll('score-partwise > part:first-of-type > measure')) {
    divisions = Number(measure.querySelector(':scope > attributes > divisions')?.textContent || divisions);
    fifths = Number(measure.querySelector(':scope > attributes > key > fifths')?.textContent || fifths);
    measureBeats = Number(measure.querySelector(':scope > attributes > time > beats')?.textContent || measureBeats);
    measureBeatType = Number(measure.querySelector(':scope > attributes > time > beat-type')?.textContent || measureBeatType);
    const measureCapacity = measureCapacityInQuarterNotes(measureBeats, measureBeatType);
    let cursor = 0, previous = 0;
    const groups = new Map();
    for (const item of measure.children) {
      const duration = Number(item.querySelector?.(':scope > duration')?.textContent || 0);
      if (item.tagName === 'backup') { cursor -= duration; continue; }
      if (item.tagName === 'forward') { cursor += duration; continue; }
      if (item.tagName !== 'note') continue;
      const chord = Boolean(item.querySelector(':scope > chord'));
      const onset = chord ? previous : cursor;
      if (!chord) previous = onset;
      if (item.querySelector(':scope > voice')?.textContent === '1' && item.querySelector(':scope > staff')?.textContent === '1') {
        if (!groups.has(onset)) groups.set(onset, []);
        groups.get(onset).push(item);
      }
      if (!chord) cursor += duration;
    }
    const measureNumber = Number(measure.getAttribute('number'));
    const measureEvents = [];
    let pickupPaddingRemoved = false;
    let eventNumber = 0;
    for (const [onset, notes] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      const pitched = notes.filter(note => note.querySelector(':scope > pitch'));
      const note = pitched.length ? pitched.toSorted((a, b) => midi(b) - midi(a))[0] : notes[0];
      const isRest = !note.querySelector(':scope > pitch');
      const beam = note.querySelector(':scope > beam[number="1"]')?.textContent || null;
      const encodedOctave = note.getAttribute('hymn-play-jianpu-octave');
      const event = { id: `m${String(measureNumber).padStart(3, '0')}-n${String(++eventNumber).padStart(3, '0')}`, index: -1, measure: measureNumber, beat: onset / divisions + 1, duration: Number(note.querySelector(':scope > duration')?.textContent || 0) / divisions, divisions, midi: isRest ? null : midi(note), isRest, beam, note };
      event.jianpuOctave = encodedOctave === null ? null : Number(encodedOctave);
      measureEvents.push(event);
    }
    // Many notation programs encode an incomplete pickup as leading rests in
    // a full first measure. Suppress only that padding from the Jianpu review.
    if (measureNumber === 1 && measureEvents.some(event => !event.isRest)) {
      const firstPitch = measureEvents.findIndex(event => !event.isRest);
      const total = measureEvents.reduce((sum, event) => sum + event.duration, 0);
      if (firstPitch > 0 && Math.abs(total - measureCapacity) < .001) { measureEvents.splice(0, firstPitch); pickupPaddingRemoved = true; }
    }
    for (const event of measureEvents) { event.index = events.length; events.push(event); }
    const rightBarline = measure.querySelector(':scope > barline[location="right"]');
    const leftBarline = measure.querySelector(':scope > barline[location="left"]');
    const visibleBeats = measureEvents.reduce((sum, event) => sum + event.duration, 0);
    const isFirstMeasure = measures.length === 0;
    const isPickup = isFirstMeasure && visibleBeats > 0 && (pickupPaddingRemoved || measure.getAttribute('implicit') === 'yes' || visibleBeats < measureCapacity - .001);
    measures.push({ number: measureNumber, timeBeats: measureCapacity, timeSignatureBeats: measureBeats, beatType: measureBeatType, expectedBeats: isPickup ? visibleBeats : measureCapacity, isPickup, isComplementaryEnding: false, newSystem: Boolean(measure.querySelector(':scope > print[new-system="yes"]')), events: measureEvents, barStyle: rightBarline?.querySelector(':scope > bar-style')?.textContent || null, repeatStart: leftBarline?.querySelector(':scope > repeat')?.getAttribute('direction') === 'forward', repeatEnd: rightBarline?.querySelector(':scope > repeat')?.getAttribute('direction') === 'backward' });
  }
  const pickup = measures[0], ending = measures.at(-1);
  if (measures.length > 1 && pickup?.isPickup && ending?.barStyle === 'light-heavy') {
    ending.expectedBeats = Math.round((ending.timeBeats - pickup.expectedBeats) * 1000) / 1000;
    ending.isComplementaryEnding = true;
  }
  const firstPart = xml.querySelector('score-partwise > part:first-of-type');
  const tempoText = firstPart?.querySelector('direction direction-type words')?.textContent?.trim() || '';
  const tempoSource = firstPart?.querySelector('direction direction-type metronome per-minute')?.textContent || firstPart?.querySelector('direction sound[tempo]')?.getAttribute('tempo') || '';
  const tempoBpm = tempoSource && Number.isFinite(Number(tempoSource)) ? Number(tempoSource) : null;
  return { events, measures, fifths, tempoText, tempoBpm };
}

function reflectImportedScore(filename) {
  const firstMeasure = state.measures[0];
  keySignaturePicker.setFromFifths(state.fifths);
  if (firstMeasure) {
    const pickup = pickupControlsForDuration(firstMeasure.isPickup ? firstMeasure.expectedBeats : 0);
    $('#entry-pickup-type').value = String(pickup.noteValue);
    $('#entry-pickup-count').value = String(pickup.count);
  }
  const tempoSelect = $('#entry-tempo-text');
  tempoSelect.querySelectorAll('option[data-imported]').forEach(option => option.remove());
  if (state.tempoText && ![...tempoSelect.options].some(option => option.value === state.tempoText)) {
    const option = document.createElement('option'); option.value = state.tempoText; option.textContent = `${state.tempoText} (imported)`; option.dataset.imported = 'true'; tempoSelect.append(option);
  }
  tempoSelect.value = state.tempoText || '';
  $('#entry-tempo').value = state.tempoBpm ?? '';
  const hymnMatch = filename.match(/hymn[-_ ]?0*(\d+)/i);
  if (hymnMatch) $('#hymn-number').value = hymnMatch[1];
  $('#jianpu-input').value = directEntryTextFromScore();
  updateJianpuPairCheck();
}

function directEntryTokenForEvent(event) {
  let token = event.isRest ? '0' : jianpuForEvent(event);
  if (!event.isRest) {
    const degree = Number(token.at(-1));
    const accidental = token.startsWith('#') ? 1 : token.startsWith('b') ? -1 : 0;
    const [, tonicPc] = KEYS[state.fifths] || KEYS[0];
    const directEntryBase = 60 + tonicPc + MAJOR_STEPS[degree - 1] + accidental;
    const octave = Number.isInteger(event.jianpuOctave) ? event.jianpuOctave : Math.round((event.midi - directEntryBase) / 12);
    if (octave > 0) token += "'".repeat(octave);
    if (octave < 0) token += ','.repeat(-octave);
  }
  return token + jianpuDurationSuffix(event.duration);
}

function directEntryTextFromScore() {
  let output = '';
  state.measures.forEach((measure, measureIndex) => {
    const previous = state.measures[measureIndex - 1];
    if (!previous || previous.timeSignatureBeats !== measure.timeSignatureBeats || previous.beatType !== measure.beatType) output += `{${measure.timeSignatureBeats}/${measure.beatType}}`;
    if (measureIndex === 0 && measure.repeatStart) output += '|:';
    if (measure.newSystem) output += `${measureIndex ? '\n' : ''}@`;
    for (const event of measure.events) {
      const starts = slurs(event.note).filter(slur => slur.getAttribute('type') === 'start').length;
      const stops = slurs(event.note).filter(slur => slur.getAttribute('type') === 'stop').length;
      output += 's('.repeat(starts);
      if (event.beam === 'begin') output += '(';
      output += directEntryTokenForEvent(event);
      if (event.beam === 'end') output += ')';
      output += ')'.repeat(stops);
    }
    let marker = measure.repeatEnd ? ':|' : measure.barStyle === 'light-light' ? '||' : measure.barStyle === 'light-heavy' ? '|]' : '|';
    const next = state.measures[measureIndex + 1];
    if (next?.repeatStart) marker = marker === '|' ? '|:' : `${marker} |:`;
    output += marker;
  });
  return output;
}

function lyricData(note, number) {
  const lyric = [...note.querySelectorAll(':scope > lyric')].find(item => item.getAttribute('number') === number);
  if (!lyric) return null;
  return { text: lyric.querySelector('text')?.textContent || '', syllabic: lyric.querySelector('syllabic')?.textContent || 'single', extend: Boolean(lyric.querySelector('extend')) };
}

function jianpuForEvent(event) {
  const [tonicName, tonicPc] = KEYS[state.fifths] || KEYS[0];
  const noteStep = event.note.querySelector(':scope > pitch > step')?.textContent;
  return noteStep ? jianpuForSpelledPitch(event.midi, tonicPc, noteStep, tonicName[0]) : jianpuForMidi(event.midi, tonicPc);
}

function loadExistingAssignments() {
  for (const language of ['1', '2']) {
    const tokens = [], assignments = new Map();
    for (const event of state.events) {
      const lyric = lyricData(event.note, language);
      if (!lyric?.text) continue;
      const token = { id: `${language}-${tokens.length}`, text: lyric.text, syllabic: lyric.syllabic };
      tokens.push(token); assignments.set(event.id, token.id);
    }
    state.tokens[language] = tokens; state.assignments[language] = assignments;
  }
  const embeddedChinese = embeddedLyricSource(state.xml, 'zh-Hant'), embeddedEnglish = embeddedLyricSource(state.xml, 'en');
  $('#zh-input').value = embeddedChinese ?? state.tokens['1'].map(token => token.text).join('');
  $('#en-input').value = embeddedEnglish ?? state.tokens['2'].map(token => token.text).join(' ');
}

function embeddedLyricSource(xml, language) {
  const name = `hymn-play-source-${language}`;
  const field = [...xml.querySelectorAll('score-partwise > identification > miscellaneous > miscellaneous-field')].find(item => item.getAttribute('name') === name);
  return field ? field.textContent : null;
}

function writeEmbeddedLyricSources(xml) {
  const score = xml.querySelector('score-partwise');
  let identification = score.querySelector(':scope > identification');
  if (!identification) { identification = xml.createElement('identification'); score.insertBefore(identification, score.querySelector(':scope > part-list')); }
  let miscellaneous = identification.querySelector(':scope > miscellaneous');
  if (!miscellaneous) { miscellaneous = xml.createElement('miscellaneous'); identification.append(miscellaneous); }
  for (const [language, value] of [['zh-Hant', $('#zh-input').value], ['en', $('#en-input').value]]) {
    const name = `hymn-play-source-${language}`;
    let field = [...miscellaneous.querySelectorAll(':scope > miscellaneous-field')].find(item => item.getAttribute('name') === name);
    if (!field) { field = xml.createElement('miscellaneous-field'); field.setAttribute('name', name); miscellaneous.append(field); }
    field.textContent = value;
  }
}

function miscellaneousField(xml, name, create = false) {
  const score = xml.querySelector('score-partwise');
  let identification = score.querySelector(':scope > identification');
  if (!identification && create) { identification = xml.createElement('identification'); score.insertBefore(identification, score.querySelector(':scope > part-list')); }
  let miscellaneous = identification?.querySelector(':scope > miscellaneous');
  if (!miscellaneous && create) { miscellaneous = xml.createElement('miscellaneous'); identification.append(miscellaneous); }
  let field = miscellaneous ? [...miscellaneous.querySelectorAll(':scope > miscellaneous-field')].find(item => item.getAttribute('name') === name) : null;
  if (!field && create) { field = xml.createElement('miscellaneous-field'); field.setAttribute('name', name); miscellaneous.append(field); }
  return field;
}

function loadEmbeddedStaffLayer() {
  state.staffNotes = []; state.staffAssignments = new Map(); state.photoConflicts = []; state.staffRegisters = { treble: 0, bass: 0 }; state.layoutProfiles = {}; state.firstNoteOffsets = new Map(); state.measureWidths = new Map(); state.nextStaffNoteId = 1; state.selectedStaffNoteId = null;
  applyLoadedSpacing();
  applyContainerSize();
  const field = miscellaneousField(state.xml, 'hymn-play-satb-json'); if (!field?.textContent) return;
  try {
    const data = JSON.parse(field.textContent);
    state.staffNotes = Array.isArray(data.notes) ? data.notes : [];
    state.staffAssignments = new Map(Array.isArray(data.assignments) ? data.assignments : []);
    state.photoConflicts = normalizePhotoConflicts(data.photoConflicts || data.photoTranscription?.conflicts);
    state.layoutProfiles = data.layoutProfiles && typeof data.layoutProfiles === 'object' ? data.layoutProfiles : {};
    const profile = state.layoutProfiles[currentEnvironmentKey()] || state.layoutProfiles[legacyEnvironmentKey()] || legacyLayoutProfile(data);
    if (profile) {
      state.firstNoteOffsets = new Map(Array.isArray(profile.firstNoteOffsets) ? profile.firstNoteOffsets.map(([measure, offset]) => [Number(measure), Number(offset)]) : []);
      state.measureWidths = new Map(Array.isArray(profile.measureWidths) ? profile.measureWidths.map(([measure, width]) => [Number(measure), clampMeasureWidth(width)]) : []);
      applyLoadedSpacing(profile.spacing); applyContainerSize(profile.containerSize);
      for (const clef of ['treble', 'bass']) state.staffRegisters[clef] = Math.max(-1, Math.min(1, Number(profile.staffRegisters?.[clef]) || 0));
    }
    if (Array.isArray(data.englishTokens) && data.englishTokens.length) state.tokens['2'] = data.englishTokens;
    state.nextStaffNoteId = Math.max(0, ...state.staffNotes.map(note => Number(String(note.id).replace(/\D/g, '')) || 0)) + 1;
  } catch { $('#status').textContent = 'The saved SATB staff layer could not be read.'; }
}

function writeEmbeddedStaffLayer(xml) {
  state.layoutProfiles[currentEnvironmentKey()] = currentLayoutProfile();
  miscellaneousField(xml, 'hymn-play-satb-json', true).textContent = JSON.stringify({ schemaVersion: 7, notes: state.staffNotes, assignments: [...state.staffAssignments], englishTokens: state.tokens['2'], photoConflicts: state.photoConflicts, layoutProfiles: state.layoutProfiles });
}

function snapshot() { return { xml: new XMLSerializer().serializeToString(state.xml), assignments: { 1: [...state.assignments['1']], 2: [...state.assignments['2']] }, staffNotes: state.staffNotes.map(note => ({ ...note })), staffAssignments: [...state.staffAssignments], photoConflicts: state.photoConflicts.map(conflict => ({ ...conflict })), staffRegisters: { ...state.staffRegisters }, spacing: { ...state.spacing }, containerSize: state.containerSize ? { ...state.containerSize } : null, layoutProfiles: structuredClone(state.layoutProfiles), firstNoteOffsets: [...state.firstNoteOffsets], measureWidths: [...state.measureWidths], nextStaffNoteId: state.nextStaffNoteId, selectedStaffNoteId: state.selectedStaffNoteId, tokens: { 1: state.tokens['1'].map(token => ({ ...token })), 2: state.tokens['2'].map(token => ({ ...token })) }, selected: state.selectedTokenId, shiftAnchorTokenId: state.shiftAnchorTokenId, selectedEventId: state.selectedEventId, selectedContinuation: state.selectedContinuation, activeLanguage: state.activeLanguage }; }
function restore(snap) {
  state.xml = new DOMParser().parseFromString(snap.xml, 'application/xml');
  Object.assign(state, parseScore(state.xml));
  state.assignments['1'] = new Map(snap.assignments['1']); state.assignments['2'] = new Map(snap.assignments['2']);
  state.staffNotes = snap.staffNotes?.map(note => ({ ...note })) || []; state.staffAssignments = new Map(snap.staffAssignments || []); state.photoConflicts = normalizePhotoConflicts(snap.photoConflicts); state.staffRegisters = { treble: snap.staffRegisters?.treble || 0, bass: snap.staffRegisters?.bass || 0 }; state.firstNoteOffsets = new Map(snap.firstNoteOffsets || []); state.measureWidths = new Map(snap.measureWidths || []); state.nextStaffNoteId = snap.nextStaffNoteId || 1; state.selectedStaffNoteId = snap.selectedStaffNoteId || null; state.staffBeamMode = null; state.staffBeamStartId = null;
  state.layoutProfiles = structuredClone(snap.layoutProfiles || {});
  state.tokens = { 1: snap.tokens['1'].map(token => ({ ...token })), 2: snap.tokens['2'].map(token => ({ ...token })) };
  state.selectedTokenId = snap.selected; state.shiftAnchorTokenId = snap.shiftAnchorTokenId; state.selectedEventId = snap.selectedEventId; state.selectedContinuation = snap.selectedContinuation; state.activeLanguage = snap.activeLanguage;
  $('#zh-input').value = state.tokens['1'].map(token => token.text).join('');
  $('#en-input').value = state.tokens['2'].map(token => token.text).join(' ');
  applyLoadedSpacing(snap.spacing);
  applyContainerSize(snap.containerSize);
  render();
}
function recordChange() { state.history.push(snapshot()); state.future = []; updateUnsavedIndicator(); }

function renderPalette() {
  const language = state.activeLanguage;
  const assigned = new Set([...state.assignments[language].values(), ...(language === '2' ? state.staffAssignments.values() : [])]);
  const palette = $('#token-palette'); palette.replaceChildren();
  state.tokens[language].forEach((token, index) => {
    const button = document.createElement('button');
    button.className = `token ${assigned.has(token.id) ? 'assigned' : ''} ${state.selectedTokenId === token.id ? 'selected' : ''} ${state.shiftAnchorTokenId === token.id ? 'shift-anchor' : ''}`;
    button.textContent = `${assigned.has(token.id) ? '✓ ' : ''}${token.text}`;
    button.title = `Token ${index + 1}`;
    button.addEventListener('click', () => { state.selectedTokenId = token.id; state.shiftAnchorTokenId = token.id; render(); });
    palette.append(button);
  });
}

function assignmentFor(language, eventId) {
  const id = state.assignments[language].get(eventId);
  return state.tokens[language].find(token => token.id === id);
}

function tonicMidi() {
  const [, tonicPc] = KEYS[state.fifths] || KEYS[0];
  // Jianpu octave marks are relative to the stable octave-4 tonic used by the
  // encoded stream. Deriving this reference from the melody would let raised
  // notes move the reference itself and make an explicitly entered ' vanish.
  return 60 + ((tonicPc + 12) % 12);
}

function octaveMarks(event) {
  if (event.isRest) return [0, 0];
  const distance = Number.isInteger(event.jianpuOctave) ? event.jianpuOctave : Math.floor((event.midi - tonicMidi()) / 12);
  return distance > 0 ? [Math.min(3, distance), 0] : [0, Math.min(3, Math.abs(distance))];
}

function octaveDotsHtml(count) {
  return Array.from({ length: count }, () => '<i class="octave-dot" aria-hidden="true"></i>').join('');
}

function connectorSpan(event) {
  const start = slurs(event.note).find(slur => slur.getAttribute('type') === 'start');
  if (!start) return 0;
  const number = start.getAttribute('number') || '1';
  const relativeIndex = state.events.slice(event.index + 1).findIndex(later => slurs(later.note).some(slur => slur.getAttribute('type') === 'stop' && (slur.getAttribute('number') || '1') === number));
  return relativeIndex < 0 ? 0 : relativeIndex + 1;
}

function continuationParts(event) {
  if (event.duration >= 2) return Array.from({ length: Math.round(event.duration) - 1 }, (_, index) => ({ symbol: '−', offset: index + 1, duration: 1, name: 'sustain line' }));
  if (event.duration === 1.5) return [{ symbol: '·', offset: 1, duration: .5, name: 'duration dot' }];
  if (event.duration === .75) return [{ symbol: '·', offset: .5, duration: .25, name: 'duration dot' }];
  return [];
}

function assign(eventId) {
  if (state.events.find(event => event.id === eventId)?.isRest) { $('#status').textContent = 'A pause cannot carry a lyric. Choose a numbered note.'; return; }
  if (!state.selectedTokenId) { $('#status').textContent = 'Select a lyric token first.'; return; }
  recordChange();
  const map = state.assignments[state.activeLanguage];
  for (const [key, value] of map) if (value === state.selectedTokenId) map.delete(key);
  map.set(eventId, state.selectedTokenId);
  state.selectedTokenId = null;
  state.shiftAnchorTokenId = null;
  $('#status').textContent = 'Lyric assigned. Select another token explicitly before making another assignment.';
  render();
}

function shiftLyrics(direction) {
  const anchorTokenId = state.selectedTokenId || state.shiftAnchorTokenId;
  const selectedLanguage = anchorTokenId?.split('-', 1)[0];
  const language = ['1', '2'].includes(selectedLanguage) ? selectedLanguage : state.activeLanguage;
  const tokens = state.tokens[language], current = state.assignments[language];
  if (!current.size) { $('#status').textContent = 'There are no assigned lyrics to shift.'; return; }
  const selectedIndex = anchorTokenId ? tokens.findIndex(token => token.id === anchorTokenId) : 0;
  const startIndex = selectedIndex < 0 ? 0 : selectedIndex;
  const movingTokenIds = new Set(tokens.slice(startIndex).map(token => token.id));
  const fixed = [...current].filter(([, tokenId]) => !movingTokenIds.has(tokenId));
  const moving = [...current].filter(([, tokenId]) => movingTokenIds.has(tokenId));
  const fixedEventIds = new Set(fixed.map(([eventId]) => eventId));
  const shifted = [];
  const lyricEvents = state.events.filter(event => !event.isRest);
  for (const [eventId, tokenId] of moving) {
    const eventIndex = lyricEvents.findIndex(event => event.id === eventId);
    const target = lyricEvents[eventIndex + direction];
    if (!target) { $('#status').textContent = `Cannot shift: ${direction < 0 ? 'the first' : 'the last'} lyric would move beyond the melody.`; return; }
    if (fixedEventIds.has(target.id)) { $('#status').textContent = 'Cannot shift across an earlier lyric. Select an earlier starting token or shift the entire lyric.'; return; }
    shifted.push([target.id, tokenId]);
  }
  recordChange(); state.assignments[language] = new Map([...fixed, ...shifted]);
  const languageName = language === '1' ? 'Chinese' : 'English';
  $('#status').textContent = `${languageName} lyrics shifted one note ${direction < 0 ? 'left' : 'right'}${startIndex ? ' from the selected token' : ''}.`;
  render();
}

const STAFF_VOICES = { S: { name: 'Soprano', clef: 'treble' }, A: { name: 'Alto', clef: 'treble' }, T: { name: 'Tenor', clef: 'bass' }, B: { name: 'Bass', clef: 'bass' } };
const STAFF_BOTTOM = { treble: 28, bass: 16 }; // C4 through A5; E2 through C4.
const STAFF_LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

function generateSopranoFromJianpu() {
  if (!state.events.length) { $('#status').textContent = 'Load or create corrected Jianpu before generating Soprano.'; return; }
  const existing = state.staffNotes.filter(note => note.voice === 'S');
  if (existing.length && !confirm(`Replace ${existing.length} existing Soprano staff entries from the corrected Jianpu? Alto, Tenor, and Bass will remain unchanged.`)) return;
  recordChange();
  for (const note of existing) state.staffAssignments.delete(note.id);
  state.staffNotes = state.staffNotes.filter(note => note.voice !== 'S');
  let sourceBeamGroup = null, sourceBeamNumber = 0;
  for (const event of state.events) {
    const pitch = event.note.querySelector(':scope > pitch');
    if (event.beam === 'begin') sourceBeamGroup = `source-beam-${++sourceBeamNumber}`;
    state.staffNotes.push({
      id: `satb-${state.nextStaffNoteId++}`, measure: event.measure, voice: 'S', clef: 'treble', onset: event.beat - 1,
      duration: event.duration, rest: event.isRest, step: pitch?.querySelector('step')?.textContent || 'C', octave: Number(pitch?.querySelector('octave')?.textContent || 4),
      alter: Number(pitch?.querySelector('alter')?.textContent || 0), explicitAccidental: Boolean(event.note.querySelector(':scope > accidental')), stem: 'auto', sourceEventId: event.id,
      beam: event.beam || null, beamGroup: event.beam ? sourceBeamGroup : null,
    });
    if (event.beam === 'end') sourceBeamGroup = null;
  }
  state.selectedStaffNoteId = null;
  $('#status').textContent = `Generated ${state.staffNotes.filter(note => note.voice === 'S').length} Soprano staff entries from corrected Jianpu. Review the paper copy before aligning English.`; render();
}

function selectedStaffNote() { return state.staffNotes.find(note => note.id === state.selectedStaffNoteId) || null; }

function beginStaffBeamOperation(mode) {
  state.staffBeamMode = mode; state.staffBeamStartId = null; state.selectedStaffNoteId = null;
  $('#status').textContent = `${mode === 'beam' ? 'Beam Notes' : 'Remove Beam'} ready. Click the first staff note, then click the last note in the range.`;
  render();
}

function clearTouchedBeamGroups(members) {
  const groupIds = new Set(members.map(note => note.beamGroup).filter(Boolean));
  for (const note of state.staffNotes) if (groupIds.has(note.beamGroup)) { note.beam = null; note.beamGroup = null; }
}

function handleStaffBeamClick(note) {
  if (!state.staffBeamMode) return false;
  if (!state.staffBeamStartId) {
    if (note.rest || Number(note.duration) >= 1) { $('#status').textContent = 'Choose an eighth note or shorter value as the first Beam Notes symbol.'; return true; }
    state.staffBeamStartId = note.id; state.selectedStaffNoteId = note.id;
    $('#status').textContent = `${STAFF_VOICES[note.voice].name} beam start selected in measure ${note.measure}. Now click the last note.`;
    render(); return true;
  }
  const result = chooseStaffBeamRange(state.staffNotes, state.staffBeamStartId, note.id);
  if (result.error) { $('#status').textContent = result.error; return true; }
  recordChange(); clearTouchedBeamGroups(result.members);
  if (state.staffBeamMode === 'beam') {
    const groupId = `staff-beam-${result.members[0].id}-${result.members.at(-1).id}`;
    result.members.forEach((member, index) => {
      member.beamGroup = groupId;
      member.beam = index === 0 ? 'begin' : index === result.members.length - 1 ? 'end' : 'continue';
    });
  }
  const action = state.staffBeamMode === 'beam' ? 'Beamed' : 'Removed beams from';
  state.staffBeamMode = null; state.staffBeamStartId = null; state.selectedStaffNoteId = note.id;
  $('#status').textContent = `${action} ${result.members.length} ${STAFF_VOICES[note.voice].name} notes in measure ${note.measure}.`;
  render(); return true;
}

function removeStaffNote(note) {
  state.staffNotes = state.staffNotes.filter(item => item.id !== note.id); state.staffAssignments.delete(note.id);
  if (state.selectedStaffNoteId === note.id) state.selectedStaffNoteId = null;
}

function applyStaffOperation() {
  const note = selectedStaffNote(); if (!note) { $('#status').textContent = 'Select a staff note first.'; return; }
  const operation = $('#staff-operation').value;
  recordChange();
  if (operation === 'delete') { removeStaffNote(note); $('#status').textContent = 'Selected staff note deleted.'; render(); return; }
  if (operation === 'split') {
    const half = note.duration / 2;
    if (!musicXmlTypeForBeats(half)) { state.history.pop(); $('#status').textContent = `A ${formatBeat(note.duration)}-beat staff note cannot be split into supported equal values.`; return; }
    note.duration = half; const copy = { ...note, id: `satb-${state.nextStaffNoteId++}`, onset: note.onset + half, sourceEventId: null }; state.staffNotes.push(copy);
    $('#status').textContent = 'Selected staff note split into two equal notes.'; render(); return;
  }
  if (operation === 'merge-previous' || operation === 'merge-next') {
    const sameVoice = state.staffNotes.filter(item => item.measure === note.measure && item.voice === note.voice).toSorted((a, b) => a.onset - b.onset);
    const index = sameVoice.findIndex(item => item.id === note.id), other = sameVoice[index + (operation === 'merge-previous' ? -1 : 1)];
    if (!other) { state.history.pop(); $('#status').textContent = `There is no ${operation === 'merge-previous' ? 'previous' : 'next'} ${STAFF_VOICES[note.voice].name} note in this measure.`; return; }
    const first = operation === 'merge-previous' ? other : note, second = operation === 'merge-previous' ? note : other;
    if (Math.abs(first.onset + first.duration - second.onset) > .001 || first.rest !== second.rest || (!first.rest && (first.step !== second.step || first.octave !== second.octave || first.alter !== second.alter))) { state.history.pop(); $('#status').textContent = 'Only adjacent staff notes with the same pitch (or two adjacent rests) can be merged.'; return; }
    const combined = first.duration + second.duration;
    if (!musicXmlTypeForBeats(combined)) { state.history.pop(); $('#status').textContent = `The merged ${formatBeat(combined)}-beat value is unsupported.`; return; }
    first.duration = combined; if (state.staffAssignments.has(second.id) && !state.staffAssignments.has(first.id)) state.staffAssignments.set(first.id, state.staffAssignments.get(second.id)); removeStaffNote(second); state.selectedStaffNoteId = first.id;
    $('#status').textContent = 'Adjacent staff notes merged.'; render(); return;
  }
  if (operation === 'step-up' || operation === 'step-down') {
    const absolute = note.octave * 7 + STAFF_LETTERS.indexOf(note.step) + (operation === 'step-up' ? 1 : -1); note.step = STAFF_LETTERS[((absolute % 7) + 7) % 7]; note.octave = Math.floor(absolute / 7); note.alter = 0; note.explicitAccidental = false;
  } else if (operation === 'semitone-up' || operation === 'semitone-down') {
    const midiValue = (note.octave + 1) * 12 + STEP[note.step] + note.alter + (operation === 'semitone-up' ? 1 : -1), next = pitchFromMidi(midiValue, state.fifths < 0); Object.assign(note, next); note.explicitAccidental = true;
  } else if (operation === 'octave-up' || operation === 'octave-down') note.octave += operation === 'octave-up' ? 1 : -1;
  else if (operation.startsWith('stem-')) {
    const members = note.beamGroup ? state.staffNotes.filter(item => item.beamGroup === note.beamGroup) : [note];
    for (const member of members) member.stem = operation.slice(5);
  }
  $('#status').textContent = `Applied ${$('#staff-operation').selectedOptions[0].textContent} to the selected ${STAFF_VOICES[note.voice].name} note.`; render();
}

function staffPitch(clef, row) {
  const absolute = staffWindowBottom(clef) + row;
  return { step: STAFF_LETTERS[((absolute % 7) + 7) % 7], octave: Math.floor(absolute / 7), absolute };
}

function staffY(clef, note) {
  const absolute = Number(note.octave) * 7 + STAFF_LETTERS.indexOf(note.step);
  return 80 - (absolute - staffWindowBottom(clef)) * 5;
}

function staffWindowBottom(clef) { return STAFF_BOTTOM[clef] + state.staffRegisters[clef] * 7; }

function appendStaffLedgerLines(group, x, y) {
  const positions = [];
  if (y <= 20) for (let lineY = 20; lineY >= y; lineY -= 10) positions.push(lineY);
  if (y >= 80) for (let lineY = 80; lineY <= y; lineY += 10) positions.push(lineY);
  for (const lineY of positions) {
    const line = document.createElementNS(group.namespaceURI, 'line');
    for (const [key, value] of Object.entries({ x1: x - 9, x2: x + 9, y1: lineY, y2: lineY })) line.setAttribute(key, String(value));
    line.setAttribute('class', 'satb-ledger-line'); group.append(line);
  }
}

function staffOnsetKey(onset) { return Number(onset).toFixed(6); }

function staffX(note, measure, anchors = null) {
  if (note.sourceEventId && anchors?.byEventId.has(note.sourceEventId)) return anchors.byEventId.get(note.sourceEventId);
  if (anchors?.byOnset.has(staffOnsetKey(note.onset))) return anchors.byOnset.get(staffOnsetKey(note.onset));
  if (anchors?.xAtTime) return anchors.xAtTime(Number(note.onset) + Math.min(Number(note.duration) || anchors.beatUnit, anchors.beatUnit) / 2);
  return 42 + Number(note.onset) / measure.timeBeats * 266;
}

function keySignatureAlter(step) {
  const order = state.fifths > 0 ? ['F', 'C', 'G', 'D', 'A', 'E', 'B'] : ['B', 'E', 'A', 'D', 'G', 'C', 'F'];
  return order.slice(0, Math.abs(state.fifths)).includes(step) ? Math.sign(state.fifths) : 0;
}

function displayedStaffAccidental(note) {
  const keyAlter = keySignatureAlter(note.step), alter = Number(note.alter) || 0;
  const sourceAccidental = note.sourceEventId && state.events.find(event => event.id === note.sourceEventId)?.note.querySelector(':scope > accidental')?.textContent?.trim();
  if (sourceAccidental) return sourceAccidental === 'natural' ? '♮' : sourceAccidental.includes('sharp') ? '♯' : sourceAccidental.includes('flat') ? '♭' : '';
  if (!note.explicitAccidental && alter === keyAlter) return '';
  if (alter > 0) return '♯';
  if (alter < 0) return '♭';
  return keyAlter ? '♮' : '';
}

function staffRenderedX(note, measure, anchors = null) {
  return staffX(note, measure, anchors);
}

function assignEnglishToStaffNote(note) {
  if (note.voice !== 'S') { $('#status').textContent = 'English syllables attach to Soprano notes. Choose a Soprano note.'; return; }
  if (!state.selectedTokenId?.startsWith('2-')) return;
  recordChange();
  for (const [noteId, tokenId] of state.staffAssignments) if (tokenId === state.selectedTokenId) state.staffAssignments.delete(noteId);
  state.staffAssignments.set(note.id, state.selectedTokenId); state.selectedTokenId = null; state.shiftAnchorTokenId = null;
  $('#status').textContent = 'English syllable assigned to the Soprano note.'; render();
}

function editStaffAt(measure, clef, clientX, clientY, svg) {
  const voice = $('#staff-voice').value, voiceInfo = STAFF_VOICES[voice];
  if (voiceInfo.clef !== clef) { $('#status').textContent = `${voiceInfo.name} belongs on the ${voiceInfo.clef} staff.`; return; }
  const box = svg.getBoundingClientRect(), x = (clientX - box.left) * 330 / box.width, y = (clientY - box.top) * 100 / box.height;
  const duration = Number($('#staff-duration').value), action = $('#staff-action').value;
  const onset = Math.max(0, Math.min(measure.timeBeats - Math.min(duration, measure.timeBeats), Math.round(((x - 42) / 266 * measure.timeBeats) * 4) / 4));
  const existingIndex = state.staffNotes.findIndex(note => note.measure === measure.number && note.voice === voice && Math.abs(note.onset - onset) < .001);
  recordChange();
  if (action === 'erase') {
    if (existingIndex >= 0) { const [removed] = state.staffNotes.splice(existingIndex, 1); state.staffAssignments.delete(removed.id); }
    $('#status').textContent = `${voiceInfo.name} position erased at beat ${formatBeat(onset + 1)}.`; render(); return;
  }
  const row = Math.max(0, Math.min(12, Math.round((80 - y) / 5))), pitch = staffPitch(clef, row);
  const chosenAlter = Number($('#staff-accidental').value);
  const note = { id: existingIndex >= 0 ? state.staffNotes[existingIndex].id : `satb-${state.nextStaffNoteId++}`, measure: measure.number, voice, clef, onset, duration, rest: action === 'rest', step: pitch.step, octave: pitch.octave, alter: chosenAlter, explicitAccidental: chosenAlter !== 0 };
  if (existingIndex >= 0) state.staffNotes.splice(existingIndex, 1, note); else state.staffNotes.push(note);
  state.selectedStaffNoteId = note.id;
  $('#status').textContent = `${action === 'rest' ? 'Rest' : `${pitch.step}${pitch.octave}`} entered for ${voiceInfo.name} at beat ${formatBeat(onset + 1)}.`; render();
}

function createStaffSvg(measure, clef, anchors = null) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 330 100'); svg.setAttribute('class', `satb-staff ${clef}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `Clickable ${clef} staff for measure ${measure.number}`);
  const clickSurface = document.createElementNS(svg.namespaceURI, 'rect'); for (const [key, value] of Object.entries({ x: 34, y: 15, width: 286, height: 70 })) clickSurface.setAttribute(key, value); clickSurface.setAttribute('class', 'satb-click-surface'); svg.append(clickSurface);
  for (let line = 0; line < 5; line += 1) { const staffLine = document.createElementNS(svg.namespaceURI, 'line'); for (const [key, value] of Object.entries({ x1: 34, x2: 320, y1: 30 + line * 10, y2: 30 + line * 10 })) staffLine.setAttribute(key, value); staffLine.setAttribute('class', 'satb-staff-line'); svg.append(staffLine); }
  appendStaffBarline(svg, measure);
  const clefMark = document.createElementNS(svg.namespaceURI, 'text'); clefMark.setAttribute('x', '5'); clefMark.setAttribute('y', clef === 'treble' ? '70' : '62'); clefMark.setAttribute('class', 'satb-clef'); clefMark.textContent = clef === 'treble' ? '𝄞' : '𝄢'; svg.append(clefMark);
  const visibleNotes = state.staffNotes.filter(item => item.measure === measure.number && item.clef === clef && (item.rest || (staffY(clef, item) >= 10 && staffY(clef, item) <= 90))).toSorted((a, b) => a.onset - b.onset || a.voice.localeCompare(b.voice));
  const rawBeamGroups = [...new Set(visibleNotes.map(note => note.beamGroup).filter(Boolean))].map(id => {
    const members = visibleNotes.filter(note => note.beamGroup === id).toSorted((a, b) => a.onset - b.onset);
    const first = members[0], stemDown = first?.stem === 'down' || (first?.stem !== 'up' && ['A', 'B'].includes(first?.voice));
    return { id, clef, direction: stemDown ? 'down' : 'up', members: members.map(note => ({ ...note, y: staffY(clef, note) })) };
  });
  const beamLayouts = combineCompatibleStaffBeamGroups(rawBeamGroups), beamLayoutByGroup = new Map();
  for (const layout of beamLayouts) for (const groupId of layout.groupIds) beamLayoutByGroup.set(groupId, layout);
  for (const note of visibleNotes) {
    const x = staffRenderedX(note, measure, anchors), y = staffY(clef, note), displayedAccidental = displayedStaffAccidental(note);
    const group = document.createElementNS(svg.namespaceURI, 'g'); group.setAttribute('class', `satb-note voice-${note.voice}${state.staffAssignments.has(note.id) ? ' has-lyric' : ''}${state.selectedStaffNoteId === note.id ? ' selected' : ''}${state.staffBeamStartId === note.id ? ' beam-anchor' : ''}`); group.dataset.noteId = note.id;
    const title = document.createElementNS(svg.namespaceURI, 'title'); title.textContent = `${STAFF_VOICES[note.voice].name} · ${note.rest ? 'rest' : `${note.step}${note.octave}`} · beat ${formatBeat(note.onset + 1)}`; group.append(title);
    const hit = document.createElementNS(svg.namespaceURI, 'circle'); hit.setAttribute('cx', String(x)); hit.setAttribute('cy', String(note.rest ? 52 : y)); hit.setAttribute('r', '11'); hit.setAttribute('class', 'satb-note-hit'); group.append(hit);
    if (displayedAccidental) { const accidental = document.createElementNS(svg.namespaceURI, 'text'); accidental.setAttribute('x', String(x - 8)); accidental.setAttribute('y', String(y + 5)); accidental.setAttribute('text-anchor', 'end'); accidental.setAttribute('class', 'satb-accidental'); accidental.textContent = displayedAccidental; group.append(accidental); }
    if (note.rest) { const rest = document.createElementNS(svg.namespaceURI, 'text'); rest.setAttribute('x', String(x - 5)); rest.setAttribute('y', '55'); rest.setAttribute('class', 'satb-rest'); rest.textContent = '𝄽'; group.append(rest); }
    else {
      appendStaffLedgerLines(group, x, y);
      const head = document.createElementNS(svg.namespaceURI, 'ellipse'); head.setAttribute('cx', String(x)); head.setAttribute('cy', String(y)); head.setAttribute('rx', '6'); head.setAttribute('ry', '4'); head.setAttribute('class', `satb-notehead${note.duration >= 2 ? ' open' : ''}`); group.append(head);
      const stemDown = note.stem === 'down' || (note.stem !== 'up' && ['A', 'B'].includes(note.voice));
      const beamLayout = note.beamGroup ? beamLayoutByGroup.get(note.beamGroup) : null, referenceMembers = beamLayout?.members || [];
      const beamEnds = beamLayout?.beamEnds || null;
      const firstBeamX = beamEnds ? staffX(referenceMembers[0], measure, anchors) : 0, lastBeamX = beamEnds ? staffX(referenceMembers.at(-1), measure, anchors) : 0;
      const beamRatio = beamEnds && Math.abs(lastBeamX - firstBeamX) > .001 ? (x - firstBeamX) / (lastBeamX - firstBeamX) : 0;
      const beamY = beamEnds ? beamEnds.start + (beamEnds.end - beamEnds.start) * beamRatio : null;
      const stemX = x + (stemDown ? -5 : 5), stemEnd = beamY ?? y + (stemDown ? 25 : -25);
      if (note.duration < 4) { const stem = document.createElementNS(svg.namespaceURI, 'line'); stem.setAttribute('x1', String(stemX)); stem.setAttribute('x2', String(stemX)); stem.setAttribute('y1', String(y)); stem.setAttribute('y2', String(stemEnd)); stem.setAttribute('class', 'satb-stem'); group.append(stem); }
      if (note.duration < 1 && !note.beamGroup) { const flag = document.createElementNS(svg.namespaceURI, 'path'); flag.setAttribute('d', stemDown ? `M ${stemX} ${stemEnd} q -13 -7 -4 -17` : `M ${stemX} ${stemEnd} q 13 7 4 17`); flag.setAttribute('class', 'satb-flag'); group.append(flag); }
    }
    group.addEventListener('pointerdown', down => {
      if (state.activeLanguage !== '2') return;
      const startX = down.clientX, startY = down.clientY;
      const finish = up => {
        if (Math.hypot(up.clientX - startX, up.clientY - startY) < 4) return;
        const box = svg.getBoundingClientRect(), px = (up.clientX - box.left) * 330 / box.width, py = (up.clientY - box.top) * 100 / box.height;
        recordChange(); note.onset = Math.max(0, Math.min(measure.timeBeats - Math.min(note.duration, measure.timeBeats), Math.round(((px - 42) / 266 * measure.timeBeats) * 4) / 4));
        if (!note.rest) { const row = Math.max(0, Math.min(12, Math.round((80 - py) / 5))), pitch = staffPitch(clef, row); note.step = pitch.step; note.octave = pitch.octave; note.alter = 0; note.explicitAccidental = false; }
        state.selectedStaffNoteId = note.id; $('#status').textContent = `${STAFF_VOICES[note.voice].name} note moved to beat ${formatBeat(note.onset + 1)}${note.rest ? '' : ` at ${note.step}${note.octave}`}.`; render();
      };
      document.addEventListener('pointerup', finish, { once: true });
    });
    svg.append(group);
  }
  for (const layout of beamLayouts) {
    const members = layout.members;
    if (members.length < 2) continue;
    const stemDown = layout.direction === 'down', stemX = item => staffX(item, measure, anchors) + (stemDown ? -5 : 5);
    const addBeam = offset => { const beam = document.createElementNS(svg.namespaceURI, 'line'); beam.setAttribute('x1', String(stemX(members[0]))); beam.setAttribute('x2', String(stemX(members.at(-1)))); beam.setAttribute('y1', String(layout.beamEnds.start + offset)); beam.setAttribute('y2', String(layout.beamEnds.end + offset)); beam.setAttribute('class', `satb-beam ${layout.shared ? 'shared' : `voice-${members[0].voice}`}`); svg.append(beam); };
    addBeam(0);
    if (members.every(item => Number(item.duration) <= .25)) addBeam(stemDown ? -7 : 7);
  }
  const positionPreview = document.createElementNS(svg.namespaceURI, 'ellipse'); positionPreview.setAttribute('rx', '6'); positionPreview.setAttribute('ry', '4'); positionPreview.setAttribute('class', 'satb-position-preview'); svg.append(positionPreview);
  svg.addEventListener('pointermove', event => {
    if (state.activeLanguage !== '2') { positionPreview.classList.remove('visible'); return; }
    if (event.target.closest?.('.satb-note')) { positionPreview.classList.remove('visible'); return; }
    const box = svg.getBoundingClientRect(), x = (event.clientX - box.left) * 330 / box.width, y = (event.clientY - box.top) * 100 / box.height;
    const duration = Number($('#staff-duration').value), onset = Math.max(0, Math.min(measure.timeBeats - Math.min(duration, measure.timeBeats), Math.round(((x - 42) / 266 * measure.timeBeats) * 4) / 4));
    const row = Math.max(0, Math.min(12, Math.round((80 - y) / 5)));
    positionPreview.setAttribute('cx', String(42 + onset / measure.timeBeats * 266)); positionPreview.setAttribute('cy', String(80 - row * 5)); positionPreview.classList.add('visible');
  });
  svg.addEventListener('pointerleave', () => positionPreview.classList.remove('visible'));
  svg.addEventListener('click', event => {
    if (state.activeLanguage !== '2') { $('#status').textContent = 'Staff notation and English lyrics are read-only in Chinese mode. Switch to English to edit them.'; return; }
    const noteId = event.target.closest?.('.satb-note')?.dataset.noteId;
    if (noteId && handleStaffBeamClick(state.staffNotes.find(note => note.id === noteId))) { event.stopPropagation(); return; }
    if (noteId && state.selectedTokenId?.startsWith('2-')) { event.stopPropagation(); assignEnglishToStaffNote(state.staffNotes.find(note => note.id === noteId)); return; }
    if (noteId) { state.selectedStaffNoteId = noteId; const note = selectedStaffNote(); $('#staff-voice').value = note.voice; $('#status').textContent = `${STAFF_VOICES[note.voice].name} ${note.rest ? 'rest' : `${note.step}${note.octave}`} selected at beat ${formatBeat(note.onset + 1)}.`; render(); return; }
    editStaffAt(measure, clef, event.clientX, event.clientY, svg);
  });
  return svg;
}

function appendStaffBarline(svg, measure) {
  const kind = measure.repeatEnd ? 'repeat-end' : measure.barStyle === 'light-light' ? 'double' : measure.barStyle === 'light-heavy' ? 'final' : '';
  const addLine = (x, width) => { const line = document.createElementNS(svg.namespaceURI, 'line'); line.setAttribute('x1', x); line.setAttribute('x2', x); line.setAttribute('y1', '30'); line.setAttribute('y2', '70'); line.setAttribute('class', 'satb-barline'); line.setAttribute('stroke-width', width); svg.append(line); };
  const addDot = (x, y) => { const dot = document.createElementNS(svg.namespaceURI, 'circle'); dot.setAttribute('cx', x); dot.setAttribute('cy', y); dot.setAttribute('r', '2'); dot.setAttribute('class', 'satb-repeat-dot'); svg.append(dot); };
  if (measure.repeatStart) { addLine('34', '4'); addLine('40', '1.5'); addDot('47', '45'); addDot('47', '55'); }
  if (!kind) return;
  addLine('314', '1.5'); addLine('320', kind === 'final' || kind === 'repeat-end' ? '4' : '1.5');
  if (kind === 'repeat-end') { addDot('307', '45'); addDot('307', '55'); }
}

function createAlignedLyricRow(measure, language, anchors = null) {
  const row = document.createElement('div'); row.className = `staff-lyric-row ${language === '1' ? 'zh' : 'en'}`;
  if (language === '1') for (const event of measure.events) {
    const lyric = assignmentFor('1', event.id); if (!lyric) continue;
    const anchorX = anchors?.byEventId.get(event.id), match = String(lyric.text).match(/^(.*?)([，。！？；：、,.!?;:]*)$/u);
    const item = document.createElement('span'); item.style.left = `${anchorX === undefined ? eventPercentInMeasure(event, measure) : anchorX / 330 * 100}%`; item.textContent = match?.[1] || lyric.text; item.dataset.punctuation = match?.[2] || ''; row.append(item);
  }
  if (language === '2') for (const note of state.staffNotes.filter(item => item.measure === measure.number && item.voice === 'S')) {
    const tokenId = state.staffAssignments.get(note.id), token = state.tokens['2'].find(item => item.id === tokenId); if (!token) continue;
    const item = document.createElement('span'); item.style.left = `${staffX(note, measure, anchors) / 330 * 100}%`; item.textContent = token.text; row.append(item);
  }
  return row;
}

function createStaffEditor(measure, anchors = null) {
  const editor = document.createElement('div'); editor.className = `measure-staff-editor${state.activeLanguage === '2' ? '' : ' staff-readonly'}`;
  editor.append(createStaffSvg(measure, 'treble', anchors), createAlignedLyricRow(measure, '1', anchors), createAlignedLyricRow(measure, '2', anchors), createStaffSvg(measure, 'bass', anchors));
  return editor;
}

function eventAnchorTime(measure, event) {
  return jianpuSymbolTime(event.beat - 1, measure.beatType || 4);
}

function measureTimingMap(eventsElement, measure) {
  const cells = [...eventsElement.querySelectorAll('.event')], capacity = Number(measure.timeBeats) || 1;
  const unitWidth = cells.length ? Math.max(...cells.map(cell => cell.offsetWidth / Math.max(.000001, Number(measure.events.find(item => item.id === cell.dataset.eventId)?.duration) || 1))) : eventsElement.clientWidth / capacity;
  const width = Math.max(eventsElement.clientWidth, unitWidth * capacity, eventsElement.scrollWidth || 0, 1);
  const pxAtTime = time => Math.max(0, Number(time)) * unitWidth;
  return { beatUnit: 4 / Number(measure.beatType || 4), pxAtTime, xAtTime: time => pxAtTime(time) / width * 330, width };
}

function renderConnectedUnderlines(eventsElement) {
  eventsElement.querySelectorAll('.beam-group-underline').forEach(line => line.remove());
  const cells = [...eventsElement.querySelectorAll('.event')], eventsBox = eventsElement.getBoundingClientRect();
  const renderedScale = eventsElement.offsetWidth ? eventsBox.width / eventsElement.offsetWidth : 1;
  for (let index = 0; index < cells.length; index += 1) {
    if (!cells[index].classList.contains('beam-begin')) continue;
    const members = [cells[index]];
    while (++index < cells.length) {
      members.push(cells[index]);
      if (cells[index].classList.contains('beam-end')) break;
    }
    if (!members.at(-1).classList.contains('beam-end')) continue;
    const first = members[0].querySelector('.degree')?.getBoundingClientRect(), last = members.at(-1).querySelector('.degree')?.getBoundingClientRect();
    if (!first || !last) continue;
    const line = document.createElement('span'); line.className = `beam-group-underline${members.some(cell => cell.classList.contains('sixteenth')) ? ' double' : ''}`;
    const firstCenter = (first.left + first.right) / 2, lastCenter = (last.left + last.right) / 2;
    const groupCenter = ((firstCenter + lastCenter) / 2 - eventsBox.left) / renderedScale + eventsElement.scrollLeft;
    const width = (lastCenter - firstCenter + Math.max(first.width, last.width)) / renderedScale;
    line.style.left = `${groupCenter - width / 2}px`;
    line.style.width = `${width}px`;
    line.style.top = `${(Math.max(first.bottom, last.bottom) - eventsBox.top) / renderedScale + eventsElement.scrollTop + 2}px`;
    eventsElement.append(line);
  }
}

function alignStaffEditorToJianpu(section, measure) {
  const events = section.querySelector('.events'), current = section.querySelector('.measure-staff-editor');
  if (!events || !current || !events.scrollWidth) return;
  applyMeasureContentScale(section);
  const byEventId = new Map(), byOnset = new Map(), timing = measureTimingMap(events, measure), width = timing.width;
  for (const cell of events.querySelectorAll('.event')) {
    const event = measure.events.find(item => item.id === cell.dataset.eventId); if (!event) continue;
    const anchorTime = eventAnchorTime(measure, event), anchorPx = timing.pxAtTime(anchorTime), x = timing.xAtTime(anchorTime);
    const pitch = cell.querySelector('.pitch'); pitch.style.transform = 'none';
    const eventsBox = events.getBoundingClientRect(), degreeBox = cell.querySelector('.degree-glyph').getBoundingClientRect();
    const renderedScale = events.offsetWidth ? eventsBox.width / events.offsetWidth : 1;
    const targetCenter = eventsBox.left + (anchorPx - events.scrollLeft) * renderedScale;
    const renderedCenter = degreeBox.left + degreeBox.width / 2;
    pitch.style.transform = `translateX(${(targetCenter - renderedCenter) / renderedScale}px)`;
    const upperMark = cell.querySelector('.octave-mark.upper'), lowerMark = cell.querySelector('.octave-mark.lower');
    upperMark.style.transform = 'none'; lowerMark.style.transform = 'none';
    const upperDot = upperMark.querySelector('.octave-dot'), lowerDot = lowerMark.querySelector('.octave-dot');
    if (upperDot) upperMark.style.transform = `translateY(${upperDot.getBoundingClientRect().height / renderedScale}px)`;
    if (lowerDot) lowerMark.style.transform = `translateY(${-lowerDot.getBoundingClientRect().height / renderedScale}px)`;
    const parts = continuationParts(event), marks = [...cell.querySelectorAll('.continuation')];
    marks.forEach((mark, index) => {
      const part = parts[index];
      if (part?.name === 'duration dot') {
        mark.style.transform = 'none';
        const markBox = mark.getBoundingClientRect(), currentDegreeBox = cell.querySelector('.degree-glyph').getBoundingClientRect();
        const verticalOffset = ((currentDegreeBox.top + currentDegreeBox.bottom) / 2 - (markBox.top + markBox.bottom) / 2) / renderedScale;
        mark.style.transform = `translateY(${verticalOffset}px)`;
        return;
      }
      if (part?.name !== 'sustain line') return;
      mark.style.transform = 'none';
      const markBox = mark.getBoundingClientRect();
      const sustainTime = Number(event.beat - 1) + Number(part.offset) + timing.beatUnit / 2;
      const sustainTarget = eventsBox.left + (timing.pxAtTime(sustainTime) - events.scrollLeft) * renderedScale;
      const sustainCenter = markBox.left + markBox.width / 2;
      mark.style.transform = `translateX(${(sustainTarget - sustainCenter) / renderedScale}px)`;
    });
    byEventId.set(event.id, x); byOnset.set(staffOnsetKey(event.beat - 1), x);
  }
  renderConnectedUnderlines(events);
  const editor = createStaffEditor(measure, { byEventId, byOnset, xAtTime: timing.xAtTime, beatUnit: timing.beatUnit });
  editor.style.width = `${width}px`;
  editor.style.transform = `translateX(${-events.scrollLeft}px)`;
  current.replaceWith(editor);
  events.onscroll = () => { editor.style.transform = `translateX(${-events.scrollLeft}px)`; renderAlignmentGuides(section, measure); };
  renderAlignmentGuides(section, measure);
}

function applyMeasureContentScale(section) {
  const scale = measureContentScale(section.getBoundingClientRect().width);
  section.style.setProperty('--measure-scale', String(scale));
  const fontSizes = { '--measure-header-font': 12, '--jianpu-font': 18, '--octave-font': 10.4, '--lower-octave-font': 16, '--zh-font': 20, '--en-font': 11.2, '--staff-lyric-font': 12.16, '--staff-en-font': 10.88, '--badge-font': 9.6 };
  for (const [property, baseSize] of Object.entries(fontSizes)) section.style.setProperty(property, `${baseSize * scale}px`);
}

function renderAlignmentGuides(section, measure) {
  section.querySelectorAll('.alignment-guide').forEach(guide => guide.remove());
  const headerHeight = section.querySelector(':scope > header')?.offsetHeight || 0;
  const events = section.querySelector('.events'); if (!events?.querySelector('.event')) return;
  const timing = measureTimingMap(events, measure);
  const beatUnit = 4 / Number(measure.beatType || 4), beatCount = Math.max(1, Math.round(measure.expectedBeats / beatUnit));
  for (let beat = 0; beat < beatCount; beat += 1) {
    const guide = document.createElement('span'); guide.className = 'alignment-guide';
    guide.style.left = `${events.offsetLeft + timing.pxAtTime((beat + .5) * beatUnit) - events.scrollLeft}px`; guide.style.top = `${headerHeight}px`; section.append(guide);
  }
}

let staffAlignmentFrame = null;
function scheduleStaffRealignment() {
  cancelAnimationFrame(staffAlignmentFrame);
  staffAlignmentFrame = requestAnimationFrame(() => {
    for (const section of document.querySelectorAll('#score-grid .measure')) {
      const measure = state.measures.find(item => item.number === Number(section.dataset.measureNumber));
      if (measure) alignStaffEditorToJianpu(section, measure);
    }
    const grid = $('#score-grid');
    if (grid) renderSlurOverlays(grid);
  });
}

function setIndividualMeasureWidth(measure, width, section = null) {
  const next = clampMeasureWidth(width); state.measureWidths.set(measure.number, next);
  if (section) { section.style.flex = `0 0 ${next}px`; section.style.setProperty('--individual-measure-width', `${next}px`); }
  updateFixedMeasureWidth();
  scheduleStaffRealignment(); return next;
}

function beginMeasureResize(down, section, measure) {
  down.preventDefault();
  const handle = down.currentTarget, startX = down.clientX, startWidth = section.getBoundingClientRect().width;
  let changed = false;
  handle.setPointerCapture?.(down.pointerId);
  const move = event => {
    const next = clampMeasureWidth(startWidth + event.clientX - startX);
    if (!changed) { recordChange(); changed = true; }
    setIndividualMeasureWidth(measure, next, section);
    $('#status').textContent = `Measure ${measure.number} width: ${next} px.`;
  };
  const finish = () => {
    handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', finish); handle.removeEventListener('pointercancel', finish);
    if (changed) render();
  };
  handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', finish); handle.addEventListener('pointercancel', finish);
}

function nudgeMeasureWidth(section, measure, delta) {
  recordChange();
  const next = setIndividualMeasureWidth(measure, section.getBoundingClientRect().width + delta);
  $('#status').textContent = `Measure ${measure.number} width: ${next} px.`; render();
}

function resetIndividualMeasureWidth(measure) {
  if (!state.measureWidths.has(measure.number)) return;
  recordChange(); state.measureWidths.delete(measure.number);
  $('#status').textContent = `Measure ${measure.number} returned to the default measure width.`; render();
}

let allMeasureWidthChanging = false;
function applyAllMeasureWidths(width) {
  if (!state.measures.length) return;
  if (!allMeasureWidthChanging) { recordChange(); allMeasureWidthChanging = true; }
  const next = clampMeasureWidth(width);
  for (const measure of state.measures) state.measureWidths.set(measure.number, next);
  for (const section of document.querySelectorAll('#score-grid .measure')) { section.style.flex = `0 0 ${next}px`; section.style.setProperty('--individual-measure-width', `${next}px`); }
  updateFixedMeasureWidth();
  $('#all-measure-width-value').textContent = `${next} px`;
  scheduleStaffRealignment();
  $('#status').textContent = `All measure windows set to ${next} px. Individual handles can still adjust exceptions.`;
}

function updateAllMeasureWidthControl() {
  const output = $('#all-measure-width-value'), slider = $('#all-measure-width-slider');
  if (!state.measures.length || !state.measureWidths.size) { output.textContent = 'Default'; slider.value = $('#measure-width-slider').value; return; }
  const widths = state.measures.map(measure => state.measureWidths.get(measure.number)).filter(Number.isFinite);
  const allCustomized = widths.length === state.measures.length, common = allCustomized && widths.every(width => width === widths[0]) ? widths[0] : null;
  if (common) { slider.value = String(common); output.textContent = `${common} px`; }
  else output.textContent = 'Mixed';
}

function updateFixedMeasureWidth() {
  const widths = state.measures.map(measure => state.measureWidths.get(measure.number)).filter(Number.isFinite);
  const common = widths.length === state.measures.length && widths.every(width => width === widths[0]) ? widths[0] : null;
  document.documentElement.style.setProperty('--fixed-measure-width', `${common || state.spacing.measureWidth}px`);
}

let photoConflictHideTimer = null;

function hidePhotoConflictPopover(force = false) {
  const popover = $('#photo-conflict-popover');
  if (!force && popover.dataset.pinned === 'true') return;
  popover.classList.add('hidden'); popover.dataset.pinned = 'false'; popover.replaceChildren();
  document.querySelectorAll('.photo-conflict-indicator[aria-expanded="true"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
}

function focusPhotoConflict(conflict) {
  state.activeLanguage = '2';
  if (conflict.noteId && state.staffNotes.some(note => note.id === conflict.noteId)) state.selectedStaffNoteId = conflict.noteId;
  render();
  requestAnimationFrame(() => {
    const measure = document.querySelector(`.measure[data-measure-number="${conflict.measure}"]`);
    measure?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    measure?.classList.add('photo-conflict-focus');
    setTimeout(() => measure?.classList.remove('photo-conflict-focus'), 1800);
  });
}

function resolvePhotoConflict(conflictId, resolution) {
  const conflict = state.photoConflicts.find(item => item.id === conflictId); if (!conflict) return;
  recordChange(); conflict.resolution = resolution; hidePhotoConflictPopover(true);
  $('#status').textContent = resolution === 'confirmed-photo' ? `Photo reading confirmed for the ${conflict.voice || 'staff'} conflict in measure ${conflict.measure}.` : `The staff conflict in measure ${conflict.measure} was marked corrected.`;
  render();
}

function showPhotoConflictPopover(measure, button, pinned = false) {
  clearTimeout(photoConflictHideTimer);
  const conflicts = unresolvedPhotoConflicts(state.photoConflicts, measure.number), popover = $('#photo-conflict-popover');
  if (!conflicts.length) return;
  popover.replaceChildren(); popover.dataset.pinned = String(pinned); popover.dataset.measure = String(measure.number);
  const heading = document.createElement('div'); heading.className = 'photo-conflict-heading'; heading.innerHTML = `<strong>Measure ${measure.number} · ${conflicts.length} staff-photo conflict${conflicts.length === 1 ? '' : 's'}</strong><span>${pinned ? 'Pinned' : 'Click warning to pin'}</span>`; popover.append(heading);
  for (const conflict of conflicts) {
    const item = document.createElement('section'); item.className = 'photo-conflict-item';
    const beat = conflict.onset === null ? 'unknown beat' : `beat ${formatBeat(conflict.onset + 1)}`;
    const confidence = conflict.confidence === null ? 'confidence unavailable' : `${Math.round(conflict.confidence * 100)}% confidence`;
    const title = document.createElement('button'); title.type = 'button'; title.className = 'photo-conflict-target'; title.textContent = `${conflict.voice || 'Staff'} · ${beat}`; title.addEventListener('click', () => focusPhotoConflict(conflict));
    const comparison = document.createElement('p'); comparison.innerHTML = `<span>Photo/OCR: <strong>${escapeHtml(conflict.ocrValue)}</strong></span><span>Verification: <strong>${escapeHtml(conflict.inferredValue)}</strong></span>`;
    const reason = document.createElement('p'); reason.className = 'photo-conflict-reason'; reason.textContent = `${conflict.reason} · ${confidence}`;
    const actions = document.createElement('div'); actions.className = 'photo-conflict-actions';
    const keep = document.createElement('button'); keep.type = 'button'; keep.textContent = 'Keep photo reading'; keep.addEventListener('click', () => resolvePhotoConflict(conflict.id, 'confirmed-photo'));
    const corrected = document.createElement('button'); corrected.type = 'button'; corrected.textContent = 'Mark corrected'; corrected.addEventListener('click', () => resolvePhotoConflict(conflict.id, 'corrected'));
    actions.append(keep, corrected); item.append(title, comparison, reason, actions); popover.append(item);
  }
  popover.classList.remove('hidden');
  document.querySelectorAll('.photo-conflict-indicator').forEach(item => item.setAttribute('aria-expanded', String(item === button && pinned)));
  const rect = button.getBoundingClientRect(), width = Math.min(360, window.innerWidth - 20);
  popover.style.width = `${width}px`; popover.style.left = `${Math.max(10, Math.min(rect.right - width, window.innerWidth - width - 10))}px`;
  popover.style.top = `${Math.max(10, Math.min(rect.bottom + 7, window.innerHeight - popover.offsetHeight - 10))}px`;
}

function setupPhotoConflictIndicator(section, measure, conflicts) {
  const button = section.querySelector('.photo-conflict-indicator'); if (!button || !conflicts.length) return;
  button.addEventListener('mouseenter', () => showPhotoConflictPopover(measure, button, false));
  button.addEventListener('mouseleave', () => { photoConflictHideTimer = setTimeout(() => hidePhotoConflictPopover(), 180); });
  button.addEventListener('click', event => { event.stopPropagation(); const popover = $('#photo-conflict-popover'), alreadyPinned = popover.dataset.pinned === 'true' && popover.dataset.measure === String(measure.number); if (alreadyPinned) hidePhotoConflictPopover(true); else showPhotoConflictPopover(measure, button, true); });
}

function renderGrid() {
  hidePhotoConflictPopover(true);
  const grid = $('#score-grid'); grid.replaceChildren();
  const authoredSystems = state.spacing.measuresPerLine === 'auto' && state.measures.some((measure, index) => index > 0 && measure.newSystem);
  grid.classList.toggle('authored-systems', authoredSystems);
  const [, tonicPc] = KEYS[state.fifths] || KEYS[0];
  let system = null;
  for (const measure of state.measures) {
    if (!system || measure.newSystem) {
      system = document.createElement('div'); system.className = 'score-system';
      system.dataset.startMeasure = String(measure.number); grid.append(system);
    }
    const section = document.createElement('section'); section.className = 'measure'; section.dataset.measureNumber = String(measure.number);
    const individualWidth = state.measureWidths.get(measure.number); if (individualWidth) { section.style.flex = `0 0 ${individualWidth}px`; section.style.setProperty('--individual-measure-width', `${individualWidth}px`); }
    if (measure.newSystem) section.classList.add('new-system');
    const usedBeats = measure.events.reduce((sum, event) => sum + event.duration, 0);
    const balance = Math.abs(usedBeats - measure.expectedBeats) < .001 ? 'complete' : usedBeats > measure.expectedBeats ? 'overfull' : 'underfull';
    section.classList.add(balance);
    const photoConflicts = unresolvedPhotoConflicts(state.photoConflicts, measure.number);
    if (photoConflicts.length) section.classList.add('photo-conflict');
    const barClass = measure.repeatEnd ? 'repeat-end' : measure.barStyle === 'light-light' ? 'double' : measure.barStyle === 'light-heavy' ? 'final' : '';
    if (barClass) section.classList.add('has-end-bar');
    const barMarkers = `${measure.repeatStart ? '<button class="barline-marker repeat-start" title="Repeat begins" aria-label="Select repeat-start barline"></button>' : ''}${barClass ? `<button class="barline-marker ${barClass}" title="${barClass === 'final' ? 'Final barline' : barClass === 'repeat-end' ? 'Repeat ends' : 'Section or verse double barline'}" aria-label="Select ${barClass} barline"></button>` : ''}`;
    const measureLabel = measure.isPickup
      ? `Measure ${measure.number} · pickup`
      : measure.isComplementaryEnding
        ? `Measure ${measure.number} · pickup ending`
        : `Measure ${measure.number}`;
    const conflictIndicator = photoConflicts.length ? `<button type="button" class="photo-conflict-indicator" aria-expanded="false" aria-label="${photoConflicts.length} unresolved staff-photo conflict${photoConflicts.length === 1 ? '' : 's'} in measure ${measure.number}">⚠ ${photoConflicts.length}</button>` : '';
    section.innerHTML = `<header><span>${measureLabel}</span><span class="measure-header-tools">${measureCapacityMeterHtml(measure, usedBeats)}${conflictIndicator}</span></header><div class="events">${barMarkers}</div>`;
    setupPhotoConflictIndicator(section, measure, photoConflicts);
    const events = section.querySelector('.events');
    for (const event of measure.events) {
      const beamClass = event.beam ? `beam-${event.beam}` : '';
      const cell = document.createElement('div'); cell.className = `event ${durationClass(event.duration)} ${beamClass} ${state.selectedEventId === event.id ? 'selected' : ''}`; cell.dataset.eventId = event.id;
      cell.style.setProperty('--duration-beats', String(Math.max(1, Math.round(event.duration))));
      cell.style.setProperty('--event-duration', String(event.duration));
      cell.style.flex = `0 0 ${event.duration / Math.max(.000001, measure.timeBeats) * 100}%`;
      cell.style.minWidth = `calc(var(--symbol-width) * var(--measure-scale) * ${event.duration})`;
      if (event === measure.events[0]) cell.style.marginLeft = `${state.firstNoteOffsets.get(measure.number) || 0}px`;
      const continuations = continuationParts(event);
      const zh = assignmentFor('1', event.id), en = assignmentFor('2', event.id);
      const [upperDotCount, lowerDotCount] = octaveMarks(event);
      const span = connectorSpan(event);
      const continuationHtml = continuations.map((part, index) => `<span class="continuation ${state.selectedContinuation?.eventId === event.id && state.selectedContinuation?.index === index ? 'selected' : ''}" role="button" tabindex="0" data-index="${index}" title="Select ${part.name}">${part.symbol}</span>`).join('');
      cell.innerHTML = `${event.beam ? '<span class="beam-link" aria-hidden="true"></span>' : ''}<button class="pitch" title="${event.isRest ? 'Pause' : 'Jianpu note'} in measure ${event.measure}"><span class="notation-core"><span class="octave-mark upper">${octaveDotsHtml(upperDotCount)}</span><span class="degree"><span class="degree-glyph">${event.isRest ? '0' : jianpuForEvent(event)}</span></span><span class="octave-mark lower">${octaveDotsHtml(lowerDotCount)}</span></span><span class="continuation-group">${continuationHtml}</span></button><div class="lyric-slot zh" data-language="1">${zh ? `${chineseLyricHtml(zh.text)}<button class="clear" aria-label="Clear Chinese">×</button>` : ''}</div><div class="lyric-slot en" data-language="2">${en ? `<span>${escapeHtml(en.text)}</span><button class="clear" aria-label="Clear English">×</button>` : ''}</div>`;
      cell.querySelector('.pitch').addEventListener('click', () => {
        if (state.selectedTokenId) { assign(event.id); return; }
        if (state.activeLanguage === '2') { $('#status').textContent = 'English mode keeps Jianpu read-only. Select an English lyric token to align it, or switch to Chinese mode to edit notation.'; return; }
        selectEvent(event.id);
      });
      cell.querySelectorAll('.continuation').forEach(mark => mark.addEventListener('click', click => { click.stopPropagation(); state.selectedEventId = event.id; state.selectedContinuation = { eventId: event.id, index: Number(mark.dataset.index) }; render(); }));
      cell.querySelectorAll('.lyric-slot').forEach(slot => slot.addEventListener('click', e => {
        const language = slot.dataset.language; const token = assignmentFor(language, event.id); if (!token) return;
        if (e.target.closest('.clear')) { recordChange(); state.assignments[language].delete(event.id); render(); return; }
        state.activeLanguage = language; state.selectedTokenId = null; state.shiftAnchorTokenId = token.id;
        $('#status').textContent = `Shift anchor set at “${token.text}”. Shift left/right will move this character and everything following it; note clicks remain in edit mode.`;
        render();
      }));
      events.append(cell);
    }
    section.append(createStaffEditor(measure));
    const resizeHandle = document.createElement('button'); resizeHandle.type = 'button'; resizeHandle.className = 'measure-resize-handle'; resizeHandle.title = `Drag to resize measure ${measure.number}; double-click to restore the default width`; resizeHandle.setAttribute('aria-label', `Resize measure ${measure.number}`);
    resizeHandle.addEventListener('pointerdown', event => beginMeasureResize(event, section, measure));
    resizeHandle.addEventListener('dblclick', () => resetIndividualMeasureWidth(measure));
    resizeHandle.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Home') resetIndividualMeasureWidth(measure); else nudgeMeasureWidth(section, measure, event.key === 'ArrowLeft' ? -10 : 10);
    });
    section.append(resizeHandle);
    section.querySelectorAll('.barline-marker').forEach(marker => marker.addEventListener('click', () => {
      const atStart = marker.classList.contains('repeat-start');
      const anchor = atStart ? measure.events[0] : measure.events.at(-1); if (!anchor) return;
      state.selectedEventId = anchor.id; state.selectedContinuation = null;
      $('#symbol-value').value = atStart ? 'repeat-start' : marker.classList.contains('repeat-end') ? 'repeat-end' : marker.classList.contains('final') ? 'final-bar' : 'double-bar';
      $('#status').textContent = `Selected barline at the ${atStart ? 'start' : 'end'} of measure ${measure.number}.`;
      render();
    }));
    system.append(section);
  }
  for (const renderedSystem of grid.querySelectorAll('.score-system')) renderedSystem.style.setProperty('--system-measure-count', String(renderedSystem.querySelectorAll(':scope > .measure').length));
  for (const section of grid.querySelectorAll('.measure')) {
    const measure = state.measures.find(item => item.number === Number(section.dataset.measureNumber));
    if (measure) alignStaffEditorToJianpu(section, measure);
  }
  renderSlurOverlays(grid);
}

function measureCapacityMeterHtml(measure, usedBeats) {
  const beatUnit = 4 / Number(measure.beatType || 4), model = measureCapacityMeter(measure.expectedBeats, usedBeats, beatUnit);
  const issueClass = model.status === 'over' ? 'over' : model.status === 'under' ? 'under' : '';
  const issue = model.issuePercent ? `<i class="capacity-issue ${issueClass}" style="left:${model.issueStartPercent}%;width:${model.issuePercent}%"></i>` : '';
  const dividers = model.dividers.map(left => `<i class="capacity-divider" style="left:${left}%"></i>`).join('');
  const description = model.status === 'complete' ? `${formatBeat(usedBeats)} of ${formatBeat(measure.expectedBeats)} allowed beats; complete` : model.status === 'under' ? `${formatBeat(usedBeats)} of ${formatBeat(measure.expectedBeats)} allowed beats; ${formatBeat(measure.expectedBeats - usedBeats)} missing` : `${formatBeat(usedBeats)} beats entered, ${formatBeat(measure.expectedBeats)} allowed; ${formatBeat(usedBeats - measure.expectedBeats)} extra`;
  return `<span class="capacity-meter ${model.status}" role="img" aria-label="${description}" title="${description}"><i class="capacity-correct" style="width:${model.correctPercent}%"></i>${issue}${dividers}</span>`;
}

function eventPercentInMeasure(event, measure) {
  return jianpuSymbolTime(event.beat - 1, measure.beatType || 4) / Math.max(.000001, measure.timeBeats) * 100;
}

function positionSlurFromRenderedDotSize(section, svg, endpointEvents) {
  const endpointCells = endpointEvents.map(event => [...section.querySelectorAll('.event')]
    .find(cell => cell.dataset.eventId === event.id)).filter(Boolean);
  const sectionBox = section.getBoundingClientRect();
  const renderedScale = section.offsetWidth ? sectionBox.width / section.offsetWidth : 1;
  if (!(renderedScale > 0)) return;
  const renderedUpperDots = endpointCells.flatMap(cell => [...cell.querySelectorAll('.octave-mark.upper .octave-dot')]);
  const renderedDotDiameter = renderedUpperDots.length
    ? Math.max(...renderedUpperDots.map(dot => dot.getBoundingClientRect().height)) / renderedScale
    : 0;
  const currentTop = Number.parseFloat(getComputedStyle(svg).top) || 0;
  svg.style.top = `${currentTop - renderedDotDiameter}px`;
}

function renderSlurOverlays(grid) {
  grid.querySelectorAll('.slur-overlay').forEach(svg => svg.remove());
  const starts = state.events.flatMap(event => slurs(event.note).filter(slur => slur.getAttribute('type') === 'start').map(slur => ({ event, number: slur.getAttribute('number') || '1' })));
  for (const start of starts) {
    const stop = state.events.slice(start.event.index + 1).find(event => slurs(event.note).some(slur => slur.getAttribute('type') === 'stop' && (slur.getAttribute('number') || '1') === start.number));
    if (!stop) continue;
    for (const measure of state.measures.filter(item => item.number >= start.event.measure && item.number <= stop.measure)) {
      const section = [...grid.querySelectorAll('.measure')].find(item => Number(item.querySelector('header').textContent.match(/\d+/)?.[0]) === measure.number);
      if (!section) continue;
      const x1 = measure.number === start.event.measure ? eventPercentInMeasure(start.event, measure) : 1;
      const x2 = measure.number === stop.measure ? eventPercentInMeasure(stop, measure) : 99;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'slur-overlay'); svg.dataset.slurNumber = start.number; svg.setAttribute('viewBox', '0 0 100 36'); svg.setAttribute('preserveAspectRatio', 'none');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'), baseline = 22; const rise = Math.min(10, Math.max(5, (x2 - x1) * .16)); path.setAttribute('d', `M ${x1} ${baseline} C ${x1 + (x2-x1)*.25} ${baseline-rise}, ${x1 + (x2-x1)*.75} ${baseline-rise}, ${x2} ${baseline}`); svg.append(path); section.append(svg);
      const endpointEvents = [measure.number === start.event.measure && start.event, measure.number === stop.measure && stop].filter(Boolean);
      if (!endpointEvents.length) endpointEvents.push(...measure.events.filter(event => event.isAttack));
      positionSlurFromRenderedDotSize(section, svg, endpointEvents);
    }
  }
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function chineseLyricHtml(value) {
  const match = String(value).match(/^(.*?)([，。！？；：、,.!?;:]*)$/u), text = match?.[1] || String(value), punctuation = match?.[2] || '';
  return `<span class="lyric-text"><span class="lyric-anchor">${escapeHtml(text)}</span>${punctuation ? `<span class="lyric-punctuation">${escapeHtml(punctuation)}</span>` : ''}</span>`;
}
function formatBeat(value) { return Number.isInteger(value) ? String(value) : String(Math.round(value * 100) / 100); }
function formatBeatPosition(value) {
  const whole = Math.floor(value), fraction = Math.round((value - whole) * 4) / 4;
  const suffix = fraction === .25 ? ' + ¼' : fraction === .5 ? ' + ½' : fraction === .75 ? ' + ¾' : '';
  return `beat ${whole}${suffix}`;
}
function measureForEvent(event) { return state.measures.find(measure => measure.number === event.measure); }
function measureUsedBeats(measure) { return measure.events.reduce((sum, item) => sum + item.duration, 0); }
function canAddBeats(event, delta) {
  const measure = measureForEvent(event); if (!measure) return false;
  const next = measureUsedBeats(measure) + delta;
  if (next > measure.expectedBeats + .001) { $('#status').textContent = `Operation blocked: measure ${measure.number} would contain ${formatBeat(next)} beats, but its limit is ${formatBeat(measure.expectedBeats)}.`; return false; }
  return true;
}
function render() {
  document.querySelectorAll('.language-tab').forEach(tab => { const active=tab.dataset.language===state.activeLanguage;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active)); });
  const englishMode = state.activeLanguage === '2';
  $('#chinese-sidebar-pane').classList.toggle('hidden', englishMode);
  $('#english-sidebar-pane').classList.toggle('hidden', !englishMode);
  (englishMode ? $('#english-sidebar-pane') : $('#chinese-sidebar-pane')).append($('#language-token-card'));
  $('#language-token-heading').textContent=englishMode?'English lyric tokens':'Chinese lyric tokens';
  $('#language-token-instructions').textContent=englishMode?'Select an English syllable, then select its Soprano note. Assigned syllables show a checkmark.':'Select a token in this palette, then select its Jianpu note. The selection clears after one assignment so later note clicks cannot replace lyrics accidentally. Assigned tokens show a checkmark.';
  $('#zh-input-label').classList.toggle('hidden', englishMode);
  $('#en-input-label').classList.toggle('hidden', !englishMode);
  $('#staff-treble-register').value = String(state.staffRegisters.treble);
  $('#staff-bass-register').value = String(state.staffRegisters.bass);
  $('#staff-entry-palette').classList.toggle('hidden', !englishMode);
  $('.symbol-command-bar').classList.toggle('hidden', englishMode);
  $('.workspace-heading h2').textContent = englishMode ? 'Compose SATB staff and align English' : 'Assign Chinese lyrics to Jianpu';
  $('.workspace>.instructions').textContent = englishMode
    ? 'Jianpu and Chinese are read-only references. Choose a SATB voice and notation symbol, then click the matching beat and pitch on the treble or bass staff.'
    : 'Select a note to edit it. Select a Chinese token and then choose its Jianpu note.';
  $('#score-grid').classList.toggle('chinese-mode', !englishMode);
  $('#score-grid').classList.toggle('english-mode', englishMode);
  $('#jianpu-entry-controls').classList.toggle('hidden', englishMode);
  $('#jianpu-input').contentEditable = englishMode ? 'false' : 'plaintext-only';
  $('#zh-input').readOnly = englishMode;
  $('#en-input').readOnly = !englishMode;
  const staffNote = selectedStaffNote();
  $('#selected-staff-note').textContent = staffNote ? `${STAFF_VOICES[staffNote.voice].name} · measure ${staffNote.measure} · beat ${formatBeat(staffNote.onset + 1)} · ${staffNote.rest ? 'rest' : `${staffNote.step}${staffNote.alter > 0 ? '♯' : staffNote.alter < 0 ? '♭' : ''}${staffNote.octave}`} · ${formatBeat(staffNote.duration)} beat` : 'No staff note selected.';
  $('#apply-staff-operation').disabled = !staffNote;
  $('#beam-staff-notes').classList.toggle('active', state.staffBeamMode === 'beam');
  $('#unbeam-staff-notes').classList.toggle('active', state.staffBeamMode === 'unbeam');
  updateFixedMeasureWidth(); renderPalette(); renderGrid();
  renderInspector(); validateScore();
  updateAllMeasureWidthControl();
  if (englishMode) $('#note-inspector').classList.add('hidden');
  updateGenericControls();
  $('#workspace-undo-button').disabled = !state.history.length;
  $('#workspace-redo-button').disabled = !state.future.length;
  updateUnsavedIndicator();
}

function undo() { if (!state.history.length) return; state.future.push(snapshot()); restore(state.history.pop()); }
function redo() { if (!state.future.length) return; state.history.push(snapshot()); restore(state.future.pop()); }

function selectEvent(eventId) { state.selectedEventId = eventId; state.selectedContinuation = null; render(); }

function selectedEvent() { return state.events.find(event => event.id === state.selectedEventId); }

function renderInspector() {
  const event = selectedEvent(), inspector = $('#note-inspector');
  inspector.classList.toggle('hidden', !event);
  const firstPositionControls = $('#first-note-position-controls');
  if (!event) { firstPositionControls.classList.add('hidden'); return; }
  const selectedPart = state.selectedContinuation?.eventId === event.id ? continuationParts(event)[state.selectedContinuation.index] : null;
  $('#selected-note-label').textContent = `${selectedPart ? selectedPart.name : event.isRest ? 'Pause 0' : `Jianpu ${jianpuForMidi(event.midi, (KEYS[state.fifths] || KEYS[0])[1])}`} · measure ${event.measure}, beat ${formatBeat(event.beat + (selectedPart?.offset || 0))}`;
  $('#selected-note-detail').textContent = `${formatBeat(event.duration)} beat${event.duration === 1 ? '' : 's'} · staff pitch retained internally`;
  $('#duration-select').value = String(event.duration);
  $('#insert-rest-button').disabled = event.isRest;
  $('#split-with-rest-button').disabled = event.isRest;
  $('#continuation-to-rest-button').disabled = !selectedPart || event.isRest;
  $('#tie-button').classList.toggle('active', hasConnectorStart(event.note));
  $('#tie-button').textContent = hasConnectorStart(event.note) ? 'Remove connector' : 'Add connector';
  const measure = measureForEvent(event), isFirst = measure?.events[0]?.id === event.id;
  firstPositionControls.classList.toggle('hidden', !isFirst);
  if (isFirst) {
    const offset = state.firstNoteOffsets.get(measure.number) || 0;
    $('#first-note-position-value').textContent = `First-note position: ${offset === 0 ? 'centered' : `${Math.abs(offset)} px ${offset < 0 ? 'left' : 'right'}`}`;
    $('#move-first-note-left').disabled = offset <= -32;
    $('#move-first-note-right').disabled = offset >= 32;
    $('#center-first-note').disabled = offset === 0;
  }
}

function adjustFirstNotePosition(delta = 0, center = false) {
  const event = selectedEvent(), measure = event && measureForEvent(event);
  if (!event || measure?.events[0]?.id !== event.id) { $('#status').textContent = 'Select the first numeric note in a measure before adjusting its position.'; return; }
  const current = state.firstNoteOffsets.get(measure.number) || 0;
  const next = center ? 0 : Math.max(-32, Math.min(32, current + delta));
  if (next === current) return;
  recordChange();
  if (next) state.firstNoteOffsets.set(measure.number, next); else state.firstNoteOffsets.delete(measure.number);
  $('#status').textContent = next === 0 ? `Measure ${measure.number} first note returned to center.` : `Measure ${measure.number} first note moved ${Math.abs(next)} px ${next < 0 ? 'left' : 'right'}.`;
  render();
}

function writeEventMidi(event, nextMidi) {
  const next = pitchFromMidi(nextMidi, state.fifths < 0), pitch = event.note.querySelector(':scope > pitch');
  pitch.querySelector('step').textContent = next.step;
  let alter = pitch.querySelector('alter');
  if (next.alter) { if (!alter) { alter = state.xml.createElement('alter'); pitch.insertBefore(alter, pitch.querySelector('octave')); } alter.textContent = String(next.alter); }
  else alter?.remove();
  pitch.querySelector('octave').textContent = String(next.octave);
  event.midi = nextMidi;
}

function setEventJianpuOctave(event, nextOctave) {
  const currentOctave = Number.isInteger(event.jianpuOctave) ? event.jianpuOctave : Math.floor((event.midi - tonicMidi()) / 12);
  writeEventMidi(event, event.midi + (nextOctave - currentOctave) * 12);
  event.jianpuOctave = nextOctave;
  event.note.setAttribute('hymn-play-jianpu-octave', String(nextOctave));
}

function setPitch(delta, octaveDelta = 0) {
  const event = selectedEvent(); if (!event || event.isRest) return;
  recordChange();
  if (octaveDelta) {
    const currentOctave = Number.isInteger(event.jianpuOctave) ? event.jianpuOctave : Math.floor((event.midi - tonicMidi()) / 12);
    setEventJianpuOctave(event, currentOctave + octaveDelta);
    $('#jianpu-input').value = directEntryTextFromScore();
    updateJianpuPairCheck();
  } else writeEventMidi(event, event.midi + delta);
  render();
}

function setDuration(beats) {
  const event = selectedEvent(), notation = musicXmlTypeForBeats(beats); if (!event || !notation) return;
  if (!canAddBeats(event, beats - event.duration)) { $('#duration-select').value = String(event.duration); return; }
  recordChange(); writeNoteDuration(event.note, beats, event.divisions);
  event.duration = beats; render();
}

function writeNoteDuration(note, beats, divisions) {
  const notation = musicXmlTypeForBeats(beats); if (!notation) return false;
  note.querySelector(':scope > duration').textContent = String(Math.round(beats * divisions));
  let type = note.querySelector(':scope > type');
  if (!type) { type = state.xml.createElement('type'); note.append(type); }
  type.textContent = notation.type;
  for (const dot of [...note.querySelectorAll(':scope > dot')]) dot.remove();
  for (let index = 0; index < notation.dots; index += 1) note.insertBefore(state.xml.createElement('dot'), type.nextSibling);
  return true;
}

function reparseKeepingAssignments(selectedNote = null) {
  const byNote = { 1: new Map(), 2: new Map() };
  for (const language of ['1', '2']) for (const event of state.events) {
    const tokenId = state.assignments[language].get(event.id);
    if (tokenId) byNote[language].set(event.note, tokenId);
  }
  Object.assign(state, parseScore(state.xml));
  for (const language of ['1', '2']) {
    state.assignments[language] = new Map(state.events.flatMap(event => byNote[language].has(event.note) ? [[event.id, byNote[language].get(event.note)]] : []));
  }
  if (selectedNote) state.selectedEventId = state.events.find(event => event.note === selectedNote)?.id || null;
}

function insertRest() {
  const event = selectedEvent(); if (!event || event.isRest) return;
  const beats = Number($('#rest-duration-select').value), notation = musicXmlTypeForBeats(beats);
  if (!notation) return;
  if (!canAddBeats(event, beats)) return;
  recordChange();
  const restNote = state.xml.createElement('note');
  restNote.append(state.xml.createElement('rest'));
  const duration = state.xml.createElement('duration'); duration.textContent = String(Math.round(beats * event.divisions)); restNote.append(duration);
  const voice = state.xml.createElement('voice'); voice.textContent = event.note.querySelector(':scope > voice')?.textContent || '1'; restNote.append(voice);
  const type = state.xml.createElement('type'); type.textContent = notation.type; restNote.append(type);
  for (let index = 0; index < notation.dots; index += 1) restNote.append(state.xml.createElement('dot'));
  const staff = state.xml.createElement('staff'); staff.textContent = event.note.querySelector(':scope > staff')?.textContent || '1'; restNote.append(staff);
  let anchor = event.note;
  while (anchor.querySelector(':scope > chord')) {
    let previous = anchor.previousElementSibling;
    while (previous && previous.tagName !== 'note') previous = previous.previousElementSibling;
    if (!previous) break; anchor = previous;
  }
  anchor.parentElement.insertBefore(restNote, anchor);
  reparseKeepingAssignments(restNote);
  $('#status').textContent = `${formatBeat(beats)}-beat pause inserted. Check the measure-duration warning before export.`;
  render();
}

function createRestNote(beats, divisions, sourceNote) {
  const notation = musicXmlTypeForBeats(beats); if (!notation) return null;
  const restNote = state.xml.createElement('note'); restNote.append(state.xml.createElement('rest'));
  const duration = state.xml.createElement('duration'); duration.textContent = String(Math.round(beats * divisions)); restNote.append(duration);
  const voice = state.xml.createElement('voice'); voice.textContent = sourceNote.querySelector(':scope > voice')?.textContent || '1'; restNote.append(voice);
  const type = state.xml.createElement('type'); type.textContent = notation.type; restNote.append(type);
  for (let index = 0; index < notation.dots; index += 1) restNote.append(state.xml.createElement('dot'));
  const staff = state.xml.createElement('staff'); staff.textContent = sourceNote.querySelector(':scope > staff')?.textContent || '1'; restNote.append(staff);
  return restNote;
}

function chordGroup(note) {
  let first = note;
  while (first.querySelector(':scope > chord')) {
    let previous = first.previousElementSibling;
    while (previous && previous.tagName !== 'note') previous = previous.previousElementSibling;
    if (!previous) break; first = previous;
  }
  const notes = [first]; let next = first.nextElementSibling;
  while (next?.tagName === 'note' && next.querySelector(':scope > chord')) { notes.push(next); next = next.nextElementSibling; }
  return notes;
}

function splitWithRestAfter() {
  const event = selectedEvent(); if (!event || event.isRest) return;
  const pauseBeats = Number($('#rest-duration-select').value), noteBeats = Math.round((event.duration - pauseBeats) * 1000) / 1000;
  if (noteBeats <= 0) { $('#status').textContent = 'The pause must be shorter than the selected note. Choose a shorter pause or select a longer note.'; return; }
  if (!musicXmlTypeForBeats(noteBeats)) { $('#status').textContent = `The remaining ${formatBeat(noteBeats)}-beat note is not a supported notation length. Adjust the note duration first.`; return; }
  recordChange();
  const group = chordGroup(event.note);
  for (const note of group) writeNoteDuration(note, noteBeats, event.divisions);
  const restNote = createRestNote(pauseBeats, event.divisions, event.note);
  group.at(-1).after(restNote);
  reparseKeepingAssignments(event.note);
  $('#status').textContent = `Selected note shortened to ${formatBeat(noteBeats)} beat${noteBeats === 1 ? '' : 's'}; a ${formatBeat(pauseBeats)}-beat pause was added after it. The measure total is unchanged.`;
  render();
}

function replaceWithRest() {
  const event = selectedEvent(); if (!event || event.isRest) return;
  recordChange();
  const pitch = event.note.querySelector(':scope > pitch');
  const rest = state.xml.createElement('rest'); pitch.replaceWith(rest);
  event.note.querySelector(':scope > accidental')?.remove();
  event.note.querySelector(':scope > stem')?.remove();
  for (const tie of [...event.note.querySelectorAll(':scope > tie')]) tie.remove();
  event.note.querySelector(':scope > notations')?.remove();
  for (const language of ['1', '2']) state.assignments[language].delete(event.id);
  reparseKeepingAssignments(event.note);
  $('#status').textContent = `${formatBeat(event.duration)}-beat note replaced with a pause at the same position. Its lyric token is now unassigned.`;
  render();
}

function mergeWithNext() {
  const event = selectedEvent(), next = event && state.events[event.index + 1];
  if (!event || event.isRest || !next || next.isRest || next.measure !== event.measure) {
    $('#status').textContent = 'Select a numbered note that has another numbered note after it in the same measure.'; return;
  }
  const tonicPc = (KEYS[state.fifths] || KEYS[0])[1];
  if (jianpuForMidi(event.midi, tonicPc) !== jianpuForMidi(next.midi, tonicPc)) {
    $('#status').textContent = 'The next event has a different numeric pitch. Merge is limited to matching Jianpu numbers.'; return;
  }
  const combined = Math.round((event.duration + next.duration) * 1000) / 1000;
  if (!musicXmlTypeForBeats(combined)) {
    $('#status').textContent = `The combined ${formatBeat(combined)}-beat duration is not currently supported.`; return;
  }
  recordChange();
  const currentGroup = chordGroup(event.note), nextGroup = chordGroup(next.note);
  for (const note of currentGroup) writeNoteDuration(note, combined, event.divisions);
  for (const note of nextGroup) note.remove();
  reparseKeepingAssignments(event.note);
  $('#status').textContent = `Matching notes merged into one ${formatBeat(combined)}-beat numeric note. Any lyric on the removed event is now unassigned.`;
  render();
}

function continuationToRest() {
  const event = selectedEvent();
  const part = event && state.selectedContinuation?.eventId === event.id ? continuationParts(event)[state.selectedContinuation.index] : null;
  if (!event || event.isRest || !part) return;
  const remaining = Math.round((event.duration - part.offset - part.duration) * 1000) / 1000;
  if (!musicXmlTypeForBeats(part.offset) || (remaining && !musicXmlTypeForBeats(remaining))) {
    $('#status').textContent = 'This sustain cannot yet be split into standard notation lengths.'; return;
  }
  recordChange();
  const group = chordGroup(event.note);
  const trailing = remaining ? group.map(note => {
    const clone = note.cloneNode(true);
    for (const lyric of [...clone.querySelectorAll(':scope > lyric')]) lyric.remove();
    for (const tie of [...clone.querySelectorAll(':scope > tie')]) tie.remove();
    clone.querySelector(':scope > notations')?.remove();
    writeNoteDuration(clone, remaining, event.divisions); return clone;
  }) : [];
  for (const note of group) writeNoteDuration(note, part.offset, event.divisions);
  const rest = createRestNote(part.duration, event.divisions, event.note);
  group.at(-1).after(rest, ...trailing);
  state.selectedContinuation = null;
  reparseKeepingAssignments(rest);
  $('#status').textContent = `${part.name} replaced by a ${formatBeat(part.duration)}-beat pause; the measure duration is unchanged.`;
  render();
}

function addFullSustain() {
  const event = selectedEvent(); if (!event || event.isRest) return;
  const duration = Math.round((event.duration + 1) * 1000) / 1000;
  if (duration > 4 || !musicXmlTypeForBeats(duration)) {
    $('#status').textContent = `A one-beat sustain cannot be added to this ${formatBeat(event.duration)}-beat note as a single standard duration.`; return;
  }
  if (!canAddBeats(event, 1)) return;
  recordChange();
  for (const note of chordGroup(event.note)) writeNoteDuration(note, duration, event.divisions);
  reparseKeepingAssignments(event.note);
  state.selectedContinuation = null;
  $('#status').textContent = `One full-beat prolongation line added. The note now lasts ${formatBeat(duration)} beats; check the measure total.`;
  render();
}

function replaceWithPreviousContinuation(event, requestedSymbol) {
  const previous = state.events[event.index - 1];
  if (!previous || previous.isRest || previous.measure !== event.measure) {
    $('#status').textContent = 'A continuation must follow a numbered note in the same measure.'; return;
  }
  const duration = Math.round((previous.duration + event.duration) * 1000) / 1000;
  const notation = musicXmlTypeForBeats(duration);
  if (!notation) {
    $('#status').textContent = `Replacing this symbol would make the preceding note ${formatBeat(duration)} beats, which is not currently supported.`; return;
  }
  if (requestedSymbol === 'dot' && notation.dots !== 1) {
    $('#status').textContent = `This position would make a ${formatBeat(duration)}-beat note, which is not written with a duration dot. Choose − (prolongation) instead.`; return;
  }
  recordChange();
  for (const note of chordGroup(previous.note)) writeNoteDuration(note, duration, previous.divisions);
  for (const note of chordGroup(event.note)) note.remove();
  reparseKeepingAssignments(previous.note);
  state.selectedContinuation = null;
  $('#status').textContent = `Selected symbol replaced with ${requestedSymbol === 'dot' ? 'a duration dot' : `a ${formatBeat(event.duration)}-beat prolongation`}. The measure total is unchanged.`;
  render();
}

function targetEvent() {
  const event = selectedEvent(); if (!event) return null;
  const offset = $('#symbol-target').value === 'previous' ? -1 : $('#symbol-target').value === 'next' ? 1 : 0;
  return state.events[event.index + offset] || null;
}

function writeEventPitch(event, degree) {
  const tonic = tonicMidi(), natural = tonic + [0, 2, 4, 5, 7, 9, 11][degree - 1];
  const reference = event.midi ?? tonic;
  const candidates = [natural - 12, natural, natural + 12, natural + 24];
  const value = candidates.toSorted((a, b) => Math.abs(a - reference) - Math.abs(b - reference))[0];
  let pitch = event.note.querySelector(':scope > pitch');
  if (!pitch) { event.note.querySelector(':scope > rest')?.remove(); pitch = state.xml.createElement('pitch'); event.note.insertBefore(pitch, event.note.firstChild); }
  pitch.replaceChildren();
  const valueParts = pitchFromMidi(value, state.fifths < 0);
  const step = state.xml.createElement('step'); step.textContent = valueParts.step; pitch.append(step);
  if (valueParts.alter) { const alter = state.xml.createElement('alter'); alter.textContent = String(valueParts.alter); pitch.append(alter); }
  const octave = state.xml.createElement('octave'); octave.textContent = String(valueParts.octave); pitch.append(octave);
}

function removeEvent(event) {
  for (const note of chordGroup(event.note)) note.remove();
  state.selectedContinuation = null; reparseKeepingAssignments(); state.selectedEventId = null;
}

function splitEvent(event) {
  const half = event.duration / 2;
  if (!musicXmlTypeForBeats(half)) { $('#status').textContent = `A ${formatBeat(event.duration)}-beat symbol cannot be split into supported equal durations.`; return false; }
  const group = chordGroup(event.note), clones = group.map(note => {
    const clone = note.cloneNode(true);
    for (const lyric of [...clone.querySelectorAll(':scope > lyric')]) lyric.remove();
    writeNoteDuration(clone, half, event.divisions); return clone;
  });
  for (const note of group) writeNoteDuration(note, half, event.divisions);
  group.at(-1).after(...clones); reparseKeepingAssignments(event.note); return true;
}

function applyLyricOperation(layer, operation) {
  state.activeLanguage = layer;
  const tokens = state.tokens[layer], anchorId = state.selectedTokenId || state.shiftAnchorTokenId;
  let index = anchorId ? tokens.findIndex(token => token.id === anchorId) : 0;
  if ($('#symbol-target').value === 'previous') index -= 1;
  if ($('#symbol-target').value === 'next') index += 1;
  index = Math.max(0, Math.min(tokens.length - 1, index));
  const token = tokens[index];
  if (token) state.shiftAnchorTokenId = token.id;
  if (operation === 'shift-left' || operation === 'shift-right') { shiftLyrics(operation === 'shift-left' ? -1 : 1); return; }
  if (!token && operation !== 'insert') { $('#status').textContent = 'Select a lyric operand first.'; return; }
  const input = $('#lyric-operand').value.trim();
  if (operation === 'remove') {
    recordChange(); state.tokens[layer].splice(index, 1);
    for (const [eventId, tokenId] of [...state.assignments[layer]]) if (tokenId === token.id) state.assignments[layer].delete(eventId);
    state.shiftAnchorTokenId = state.tokens[layer][index]?.id || state.tokens[layer][index - 1]?.id || null;
    $('#status').textContent = `${layer === '1' ? 'Chinese character' : 'English syllable'} removed.`; render(); return;
  }
  const parsed = layer === '1' ? tokenizeChinese(input) : tokenizeEnglish(input);
  if (parsed.length !== 1) { $('#status').textContent = `Enter exactly one ${layer === '1' ? 'Chinese character' : 'English syllable'} operand.`; return; }
  if (operation === 'replace') { recordChange(); Object.assign(token, parsed[0]); $('#status').textContent = 'Lyric operand replaced.'; render(); return; }
  if (operation === 'insert') {
    if (!canAddBeats(event, 1)) return;
    recordChange(); const inserted = { ...parsed[0], id: `${layer}-new-${Date.now()}` };
    const at = $('#symbol-target').value === 'next' ? index + 1 : index; state.tokens[layer].splice(at, 0, inserted); state.shiftAnchorTokenId = inserted.id;
    $('#status').textContent = 'Lyric operand inserted and left unassigned.'; render(); return;
  }
  $('#status').textContent = 'This lyric operation is not available in the first generic version.';
}

function applyNotationOperation(operation, symbol) {
  // Merge already describes the relative operand. It must be anchored to the
  // visibly selected symbol, regardless of the generic Target dropdown. Using
  // targetEvent() here moved the anchor once and then mergeWithNext() moved it
  // a second time, which made otherwise adjacent notes appear unmergeable.
  if (operation === 'merge-next') { mergeWithNext(); return; }
  if (operation === 'merge-previous') {
    const current = selectedEvent();
    const previous = current && state.events[current.index - 1];
    if (!current || !previous || previous.measure !== current.measure) {
      $('#status').textContent = 'Select a numbered note that has another numbered note before it in the same measure.'; return;
    }
    state.selectedEventId = previous.id;
    mergeWithNext();
    return;
  }
  const event = targetEvent(); if (!event) { $('#status').textContent = 'Select a numeric symbol first.'; return; }
  state.selectedEventId = event.id;
  if (['double-bar', 'repeat-start', 'repeat-end', 'final-bar'].includes(symbol)) {
    const measure = event.note.closest('measure');
    if (!['insert', 'replace', 'remove'].includes(operation)) { $('#status').textContent = 'Use Insert, Replace, or Remove for a barline.'; return; }
    recordChange();
    const location = symbol === 'repeat-start' ? 'left' : 'right';
    let barline = measure.querySelector(`:scope > barline[location="${location}"]`);
    if (operation === 'remove') barline?.remove();
    else {
      if (!barline) { barline = state.xml.createElement('barline'); barline.setAttribute('location', location); location === 'left' ? measure.prepend(barline) : measure.append(barline); }
      let style = barline.querySelector(':scope > bar-style'); if (!style) { style = state.xml.createElement('bar-style'); barline.prepend(style); }
      style.textContent = symbol === 'final-bar' || symbol === 'repeat-end' ? 'light-heavy' : symbol === 'repeat-start' ? 'heavy-light' : 'light-light';
      barline.querySelector(':scope > repeat')?.remove();
      if (symbol === 'repeat-start' || symbol === 'repeat-end') { const repeat = state.xml.createElement('repeat'); repeat.setAttribute('direction', symbol === 'repeat-start' ? 'forward' : 'backward'); barline.append(repeat); }
    }
    reparseKeepingAssignments(event.note);
    const label = symbol === 'final-bar' ? 'Final' : symbol === 'repeat-start' ? 'Repeat-start' : symbol === 'repeat-end' ? 'Repeat-end' : 'Section/verse double';
    $('#status').textContent = operation === 'remove' ? `Barline removed from measure ${event.measure}.` : `${label} barline set ${location === 'left' ? 'at the start' : 'at the end'} of measure ${event.measure}.`;
    render(); return;
  }
  if (['pitch-down', 'pitch-up', 'octave-down', 'octave-up'].includes(operation)) {
    const delta = operation === 'pitch-down' ? -1 : operation === 'pitch-up' ? 1 : operation === 'octave-down' ? -12 : 12;
    setPitch(delta, operation === 'octave-down' ? -1 : operation === 'octave-up' ? 1 : 0); return;
  }
  if (operation === 'split') { recordChange(); if (splitEvent(event)) { $('#status').textContent = 'Current symbol split into two equal rhythmic symbols.'; render(); } else state.history.pop(); return; }
  if (operation === 'remove') { recordChange(); removeEvent(event); $('#status').textContent = 'Symbol and its time removed; check the measure total.'; render(); return; }
  if (symbol === 'sustain') {
    if (operation === 'replace') replaceWithPreviousContinuation(event, 'sustain');
    else if (operation === 'insert') addFullSustain();
    else $('#status').textContent = 'Use Insert to add time or Replace to convert the selected symbol into a prolongation.';
    return;
  }
  if (symbol === 'dot') {
    if (operation === 'replace') { replaceWithPreviousContinuation(event, 'dot'); return; }
    const duration = event.duration * 1.5; if (!musicXmlTypeForBeats(duration)) { $('#status').textContent = 'A duration dot is not legal for this symbol length.'; return; }
    setDuration(duration); return;
  }
  if (operation === 'replace') {
    if (symbol === '0') { if (!event.isRest) replaceWithRest(); return; }
    recordChange(); writeEventPitch(event, Number(symbol)); reparseKeepingAssignments(event.note); $('#status').textContent = `Numeric symbol replaced with ${symbol}.`; render(); return;
  }
  if (operation === 'insert') {
    recordChange(); const inserted = createRestNote(1, event.divisions, event.note);
    if (symbol !== '0') { const temporary = { note: inserted, midi: event.midi, isRest: true }; writeEventPitch(temporary, Number(symbol)); }
    const group = chordGroup(event.note); if ($('#symbol-target').value === 'next') group.at(-1).after(inserted); else group[0].before(inserted);
    reparseKeepingAssignments(inserted); $('#status').textContent = `${symbol === '0' ? 'Pause' : `Numeric ${symbol}`} inserted; check the measure total.`; render(); return;
  }
  $('#status').textContent = 'Choose Insert or Replace when supplying a symbol.';
}

function applyGenericOperation() {
  const layer = $('#operation-layer').value, operation = $('#symbol-operation').value;
  if (layer === '1' || layer === '2') applyLyricOperation(layer, operation);
  else applyNotationOperation(operation, $('#symbol-value').value);
}

function updateGenericControls() {
  const englishMode = state.activeLanguage === '2';
  const layerSelect = $('#operation-layer');
  for (const option of layerSelect.options) option.disabled = englishMode ? option.value !== '2' : option.value === '2';
  if (englishMode) layerSelect.value = '2';
  else if (layerSelect.value === '2') layerSelect.value = 'notation';
  const lyric = layerSelect.value !== 'notation';
  const operationSelect = $('#symbol-operation');
  const lyricOperations = new Set(['insert', 'replace', 'remove', 'shift-left', 'shift-right']);
  const notationOperations = new Set(['insert', 'replace', 'remove', 'split', 'merge-previous', 'merge-next', 'pitch-down', 'pitch-up', 'octave-down', 'octave-up']);
  const allowedOperations = lyric ? lyricOperations : notationOperations;
  for (const option of operationSelect.options) option.disabled = !allowedOperations.has(option.value);
  if (!allowedOperations.has(operationSelect.value)) operationSelect.value = 'replace';

  const operation = operationSelect.value;
  const usesSymbol = !lyric && ['insert', 'replace'].includes(operation);
  const usesOperand = lyric && ['insert', 'replace'].includes(operation);
  const usesTarget = lyric
    ? ['insert', 'replace', 'remove', 'shift-left', 'shift-right'].includes(operation)
    : !['merge-previous', 'merge-next'].includes(operation);
  const setControlState = (control, enabled) => {
    control.disabled = !enabled;
    control.closest('label')?.classList.toggle('control-disabled', !enabled);
  };

  $('#symbol-value').parentElement.classList.toggle('hidden', lyric);
  $('#lyric-operand-label').classList.toggle('hidden', !lyric);
  setControlState($('#symbol-value'), usesSymbol);
  setControlState($('#lyric-operand'), usesOperand);
  setControlState($('#symbol-target'), usesTarget);
}

function applySpacing(measureWidth, symbolWidth, measuresPerLine = $('#measures-per-line').value) {
  const spacing = normalizeSpacingSettings({ measureWidth, symbolWidth, measuresPerLine });
  state.spacing = spacing;
  ({ measureWidth, symbolWidth, measuresPerLine } = spacing);
  document.documentElement.style.setProperty('--measure-width', `${measureWidth}px`);
  document.documentElement.style.setProperty('--symbol-width', `${symbolWidth}px`);
  updateFixedMeasureWidth();
  const fixedColumns = measuresPerLine !== 'auto';
  $('#score-grid').classList.toggle('fixed-columns', fixedColumns);
  if (fixedColumns) document.documentElement.style.setProperty('--measures-per-line', measuresPerLine);
  $('#measure-width-value').textContent = `${measureWidth} px`;
  $('#symbol-width-value').textContent = `${symbolWidth} px`;
  if (state.measures.length) scheduleStaffRealignment();
}

function currentSpacingSettings() {
  return { ...state.spacing };
}

function currentEnvironmentKey() {
  const display = window.screen, width = display?.width || window.innerWidth, height = display?.height || window.innerHeight;
  return `display-${width}x${height}@${window.devicePixelRatio || 1}`;
}

function legacyEnvironmentKey() {
  const display = window.screen, width = display?.availWidth || window.innerWidth, height = display?.availHeight || window.innerHeight;
  return `display-${width}x${height}@${window.devicePixelRatio || 1}`;
}

function legacyLayoutProfile(data) {
  if (Number(data?.schemaVersion) >= 7) return null;
  const hasLayout = data?.spacing || data?.containerSize || Array.isArray(data?.measureWidths) || Array.isArray(data?.firstNoteOffsets) || data?.staffRegisters;
  if (!hasLayout) return null;
  return { spacing: data.spacing, containerSize: data.containerSize, measureWidths: data.measureWidths, firstNoteOffsets: data.firstNoteOffsets, staffRegisters: data.staffRegisters };
}

function currentLayoutProfile() {
  return { spacing: currentSpacingSettings(), containerSize: state.containerSize, firstNoteOffsets: [...state.firstNoteOffsets], measureWidths: [...state.measureWidths], staffRegisters: { ...state.staffRegisters } };
}

function applyLoadedSpacing(saved = {}) {
  const { measureWidth, symbolWidth, measuresPerLine } = normalizeSpacingSettings(saved);
  $('#measure-width-slider').value = String(measureWidth); $('#symbol-width-slider').value = String(symbolWidth); $('#measures-per-line').value = measuresPerLine;
  $('#all-measure-width-slider').value = String(Math.min(500, measureWidth)); $('#all-measure-width-value').textContent = 'Default';
  applySpacing(measureWidth, symbolWidth, measuresPerLine);
}

function applyContainerSize(saved = null) {
  const workspace = $('.workspace'), width = Number(saved?.width), height = Number(saved?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    state.containerSize = null; workspace.style.width = ''; workspace.style.height = ''; return;
  }
  state.containerSize = { width: Math.max(320, Math.min(3000, Math.round(width))), height: Math.max(480, Math.min(3000, Math.round(height))) };
  workspace.style.width = `${state.containerSize.width}px`; workspace.style.height = `${state.containerSize.height}px`;
}

function loadSpacing() {
  applyLoadedSpacing();
}

function slurs(note) { return [...note.querySelectorAll(':scope > notations > slur')]; }
function hasConnectorStart(note) { return slurs(note).some(slur => slur.getAttribute('type') === 'start'); }
function ensureNotations(note) {
  let notations = note.querySelector(':scope > notations');
  if (!notations) { notations = state.xml.createElement('notations'); note.append(notations); }
  return notations;
}
function removeConnector(event) {
  const start = slurs(event.note).find(slur => slur.getAttribute('type') === 'start');
  if (!start) return;
  const number = start.getAttribute('number') || '1'; start.remove();
  for (const later of state.events.slice(event.index + 1)) {
    const stop = slurs(later.note).find(slur => slur.getAttribute('type') === 'stop' && (slur.getAttribute('number') || '1') === number);
    if (stop) { stop.remove(); break; }
  }
}
function connectorNumber() {
  for (let number = 1; number <= 6; number += 1) {
    if (!state.events.some(event => slurs(event.note).some(slur => (slur.getAttribute('number') || '1') === String(number)))) return String(number);
  }
  return '1';
}
function toggleTie() {
  const event = selectedEvent(); if (!event) return;
  if (event.isRest) { $('#status').textContent = 'Start a connector on a numbered note, not a pause.'; return; }
  if (hasConnectorStart(event.note)) { recordChange(); removeConnector(event); $('#status').textContent = 'Connector removed.'; render(); return; }
  const span = Number($('#connector-span-select').value);
  const end = state.events[event.index + span];
  if (!end) { $('#status').textContent = `Only ${state.events.length - event.index - 1} following notes remain. Choose a shorter connector.`; return; }
  recordChange();
  const number = connectorNumber();
  for (const [note, type] of [[event.note, 'start'], [end.note, 'stop']]) {
    const slur = state.xml.createElement('slur'); slur.setAttribute('type', type); slur.setAttribute('number', number);
    if (type === 'start') slur.setAttribute('placement', 'above');
    ensureNotations(note).append(slur);
  }
  $('#status').textContent = `Connector added through the next ${span} note${span === 1 ? '' : 's'}.`;
  render();
}

function validateScore() {
  const issues = [];
  if (!state.events.length) issues.push('No staff 1 / voice 1 melody notes found');
  const invalidDurations = state.events.filter(event => event.duration <= 0).length;
  if (invalidDurations) issues.push(`${invalidDurations} invalid note duration${invalidDurations === 1 ? '' : 's'}`);
  const overflowing = state.measures.filter(measure => measureUsedBeats(measure) > measure.expectedBeats + .001);
  if (overflowing.length) issues.push(`measure ${overflowing.map(measure => measure.number).join(', ')} exceeds its time signature`);
  const underfull = state.measures.filter(measure => !measure.isPickup && measureUsedBeats(measure) < measure.expectedBeats - .001);
  if (underfull.length) issues.push(`measure ${underfull.map(measure => measure.number).join(', ')} has fewer than ${underfull[0]?.expectedBeats || 4} beats`);
  for (const language of ['1', '2']) {
    const assigned = new Set([...state.assignments[language].values(), ...(language === '2' ? state.staffAssignments.values() : [])]);
    const unassigned = state.tokens[language].length - assigned.size;
    if (unassigned > 0) issues.push(`${unassigned} unassigned ${language === '1' ? 'Chinese' : 'English'} token${unassigned === 1 ? '' : 's'}`);
  }
  return issues;
}

function prepareEnglishSyllables() {
  if (state.tokens['2'].length && !confirm('Restart only the English syllable alignment? Staff notes and Chinese alignment will be preserved.')) return;
  recordChange(); state.tokens['2'] = tokenizeEnglish($('#en-input').value).map((token, index) => ({ ...token, id: `2-${index}` }));
  state.assignments['2'] = new Map(); state.staffAssignments = new Map(); state.selectedTokenId = state.tokens['2'][0]?.id || null; state.shiftAnchorTokenId = state.selectedTokenId;
  $('#status').textContent = `Prepared ${state.tokens['2'].length} English word/syllable tokens. Add hyphens in the English box where a word has multiple sung syllables.`; render();
}

function createLyric(xml, language, token) {
  const lyric = xml.createElement('lyric'); lyric.setAttribute('number', language); lyric.setAttribute('placement', 'below');
  lyric.setAttributeNS('http://www.w3.org/XML/1998/namespace', 'xml:lang', language === '1' ? 'zh-Hant' : 'en');
  const syllabic = xml.createElement('syllabic'); syllabic.textContent = token.syllabic || 'single'; lyric.append(syllabic);
  const text = xml.createElement('text'); text.textContent = token.text; lyric.append(text); return lyric;
}

function revisedXml() {
  const clone = state.xml.cloneNode(true); const reparsed = parseScore(clone);
  for (const note of clone.querySelectorAll('note')) for (const lyric of [...note.querySelectorAll(':scope > lyric')]) if (['1', '2'].includes(lyric.getAttribute('number'))) lyric.remove();
  for (const language of ['1', '2']) for (const event of reparsed.events) {
    const originalEvent = state.events[event.index];
    const tokenId = originalEvent && state.assignments[language].get(originalEvent.id); const token = state.tokens[language].find(item => item.id === tokenId);
    if (token) event.note.append(createLyric(clone, language, token));
  }
  writeEmbeddedLyricSources(clone);
  writeEmbeddedStaffLayer(clone);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone.documentElement)}\n`;
}

function reviewPayload() {
  return { schemaVersion: 7, source: state.filename, keyFifths: state.fifths, environment: currentEnvironmentKey(), sourceLyrics: { zhHant: $('#zh-input').value, en: $('#en-input').value }, layout: currentLayoutProfile(), satb: { notes: state.staffNotes, assignments: [...state.staffAssignments], englishTokens: state.tokens['2'], photoConflicts: state.photoConflicts }, assignments: state.events.map(event => ({ id: event.id, measure: event.measure, beat: event.beat, jianpu: event.isRest ? '0' : jianpuForEvent(event), durationBeats: event.duration, zhHant: assignmentFor('1', event.id)?.text || null, en: assignmentFor('2', event.id)?.text || null })) };
}
function selectedHymnLyrics() {
  const hymn = state.hymnRecord; if (!hymn) return null;
  const ordinal = Number($('#hymn-verse').value);
  const verse = hymn.sections.find(section => section.kind === 'verse' && section.ordinal === ordinal);
  const assignment = hymn.assignments?.find(item => item.verseSectionId === verse?.id);
  const chorus = assignment ? hymn.sections.find(section => section.id === assignment.chorusSectionId) : null;
  return { verse, chorus };
}

function fillSelectedHymnLyrics() {
  const selected = selectedHymnLyrics(); if (!selected?.verse) return;
  const lines = language => [...(selected.verse.lyrics?.[language] || []), ...(selected.chorus?.lyrics?.[language] || [])];
  const chineseLines = lines('zh-Hant'), englishLines = lines('en');
  $('#zh-input').value = chineseLines.join('\n');
  $('#en-input').value = englishLines.join('\n');
  const chorusLabel = selected.chorus ? ' with its assigned chorus' : '';
  $('#status').textContent = `Loaded Hymn ${state.hymnRecord.number}, Verse ${selected.verse.ordinal}${chorusLabel}: ${chineseLines.length} Chinese lines and ${englishLines.length} English lines. Hidden-language text remains loaded.`;
}

async function fillMissingImportedLyrics() {
  if ($('#zh-input').value.trim() && $('#en-input').value.trim()) return false;
  const number = Number($('#hymn-number').value);
  if (!Number.isInteger(number) || number < 1 || number > 848) return false;
  try {
    const response = await fetch(`/api/hymn/${number}`), hymn = await response.json();
    if (!response.ok) return false;
    state.hymnRecord = hymn;
    const zhTitle = hymn.titles?.['zh-Hant'] || '', enTitle = hymn.titles?.en || '';
    $('#hymn-title').textContent = [`Hymn ${hymn.number}`, zhTitle, enTitle].filter(Boolean).join(' · ');
    const verses = hymn.sections.filter(section => section.kind === 'verse');
    $('#hymn-verse').replaceChildren(...verses.map(section => { const option = document.createElement('option'); option.value = String(section.ordinal); option.textContent = `Verse ${section.ordinal}`; return option; }));
    const selected = selectedHymnLyrics(); if (!selected?.verse) return false;
    const lines = language => [...(selected.verse.lyrics?.[language] || []), ...(selected.chorus?.lyrics?.[language] || [])];
    if (!$('#zh-input').value.trim()) $('#zh-input').value = lines('zh-Hant').join('\n');
    if (!$('#en-input').value.trim()) $('#en-input').value = lines('en').join('\n');
    return true;
  } catch { return false; }
}

async function loadHymnFromDisplay() {
  const number = Number($('#hymn-number').value);
  if (!Number.isInteger(number) || number < 1 || number > 848) { $('#status').textContent = 'Enter a hymn number from 1 to 848.'; return; }
  try {
    const response = await fetch(`/api/hymn/${number}`), hymn = await response.json();
    if (!response.ok) throw new Error(hymn.error || 'Hymn could not be loaded.');
    state.hymnRecord = hymn;
    const zhTitle = hymn.titles?.['zh-Hant'] || '';
    const enTitle = hymn.titles?.en || '';
    $('#hymn-title').textContent = [`Hymn ${hymn.number}`, zhTitle, enTitle].filter(Boolean).join(' · ');
    const verses = hymn.sections.filter(section => section.kind === 'verse');
    $('#hymn-verse').replaceChildren(...verses.map(section => { const option = document.createElement('option'); option.value = String(section.ordinal); option.textContent = `Verse ${section.ordinal}`; return option; }));
    fillSelectedHymnLyrics();
    $('#editor').classList.remove('hidden');
  } catch (error) { $('#status').textContent = `Could not load Hymn Display lyrics: ${error.message}`; }
}

async function loadHymnCatalog() {
  try {
    const response = await fetch('/api/hymns');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Hymn catalog could not be loaded.');
    $('#hymn-number-list').replaceChildren(...result.hymns.map(hymn => {
      const option = document.createElement('option');
      option.value = String(hymn.number);
      option.label = [hymn.titles?.['zh-Hant'], hymn.titles?.en].filter(Boolean).join(' · ');
      return option;
    }));
  } catch (error) {
    $('#hymn-title').textContent = `Could not load the hymn list: ${error.message}`;
  }
}

function parseJianpuText(text) {
  const normalized = text.trim().replaceAll('｜', '|').replace(/(\{\s*\d+\s*\/\s*(?:2|4|8|16)\s*\})\s*\|(?=\s*(?:@|\{|s\(|[0-7#♯b♭]))/gu, '$1');
  const pieces = normalized.split(/(\|:|:\||\|\]|\|\||\|)/).filter(piece => piece !== '');
  const rawMeasures = []; let pendingRepeatStart = false;
  for (const piece of pieces) {
    if (!['|', '||', '|:', ':|', '|]'].includes(piece)) {
      if (piece.trim()) rawMeasures.push({ source: piece.trim(), repeatStart: pendingRepeatStart, rightMark: null });
      pendingRepeatStart = false; continue;
    }
    if (piece === '|:') { pendingRepeatStart = true; continue; }
    if (rawMeasures.length) rawMeasures.at(-1).rightMark = piece === '||' ? 'double' : piece === ':|' ? 'repeat-end' : piece === '|]' ? 'final' : rawMeasures.at(-1).rightMark;
  }
  if (!rawMeasures.length) throw new Error('Enter a Jianpu encoded stream with | between measures.');
  const parsed = [], groups = []; let slurNumber = 1, lastPitchedEvent = null, currentMeter = { beats: 4, beatType: 4 };
  for (let measureIndex = 0; measureIndex < rawMeasures.length; measureIndex += 1) {
    const { source, repeatStart, rightMark } = rawMeasures[measureIndex];
    const events = []; let newSystem = false, meterChanged = false;
    for (let index = 0; index < source.length;) {
      const char = source[index];
      if (/\s|[。；;]/u.test(char)) { index += 1; continue; }
      if (char === '@') {
        if (events.length) throw new Error(`Measure ${measureIndex + 1}: @ must appear at the beginning of a measure, immediately after a barline.`);
        newSystem = true; index += 1; continue;
      }
      if (char === '{') {
        if (events.length) throw new Error(`Measure ${measureIndex + 1}: a meter change must appear before its first timed symbol.`);
        const marker = parseJianpuMeterMarker(source.slice(index));
        if (!marker) throw new Error(`Measure ${measureIndex + 1}: use a meter marker such as {3/4}, {6/8}, or {2/2}.`);
        currentMeter = { beats: marker.beats, beatType: marker.beatType }; meterChanged = true; index += marker.length; continue;
      }
      if (source.startsWith('s(', index)) { groups.push({ type: 'slur', number: String(slurNumber++), started: false }); index += 2; continue; }
      if (char === '(') { groups.push({ type: 'beam', measureIndex, start: events.length }); index += 1; continue; }
      if (char === ')') {
        const group = groups.pop(); if (!group) throw new Error(`Measure ${measureIndex + 1}: unmatched closing parenthesis.`);
        if (group.type === 'slur') {
          if (!group.started || !lastPitchedEvent) throw new Error(`Measure ${measureIndex + 1}: an empty slur is not allowed.`);
          lastPitchedEvent.slurStop = group.number;
        } else {
          if (group.measureIndex !== measureIndex) throw new Error('Connected underline groups cannot cross a measure boundary.');
          const members = events.slice(group.start);
          if (members.length < 2 || members.some(event => event.duration >= 1)) throw new Error(`Measure ${measureIndex + 1}: an underline group needs at least two short notes.`);
          members.forEach((event, memberIndex) => { event.beam = memberIndex === 0 ? 'begin' : memberIndex === members.length - 1 ? 'end' : 'continue'; });
        }
        index += 1; continue;
      }
      if (char === '-' || char === '−') {
        if (!events.length) throw new Error(`Measure ${measureIndex + 1}: a prolongation must follow a note or pause.`);
        events.at(-1).duration += 1; index += 1; continue;
      }
      if (["'", '’', '′', ',', '，'].includes(char)) {
        const previous = events.at(-1);
        if (!previous || previous.degree === 0) throw new Error(`Measure ${measureIndex + 1}: an octave modifier must follow a numbered Jianpu note.`);
        applyJianpuOctaveModifier(previous, char); index += 1; continue;
      }
      let accidental = 0;
      if (char === '#' || char === '♯') { accidental = 1; index += 1; }
      else if (char === 'b' || char === '♭') { accidental = -1; index += 1; }
      const degree = source[index];
      if (!/[0-7]/.test(degree)) throw new Error(`Measure ${measureIndex + 1}: unsupported character “${source[index] || char}”. Use #4 or ♯4 to sharpen a note, and b7 or ♭7 to flatten one.`);
      if (accidental && degree === '0') throw new Error(`Measure ${measureIndex + 1}: a pause cannot be sharp or flat.`);
      const event = { degree: Number(degree), accidental, duration: 1, octave: 0 }; index += 1;
      let slashCount = 0, dotted = false;
      while (index < source.length) {
        const modifier = source[index];
        if (modifier === '/') { slashCount += 1; index += 1; continue; }
        if (modifier === '·' || modifier === '.' || modifier === '*') { dotted = true; index += 1; continue; }
        if (applyJianpuOctaveModifier(event, modifier)) { index += 1; continue; }
        break;
      }
      event.duration = 1 / (2 ** slashCount);
      if (dotted) event.duration *= 1.5;
      if (!musicXmlTypeForBeats(event.duration)) throw new Error(`Measure ${measureIndex + 1}: unsupported duration on ${char}.`);
      events.push(event);
      if (event.degree !== 0) {
        lastPitchedEvent = event;
        for (const group of groups) if (group.type === 'slur' && !group.started) { event.slurStart = group.number; group.started = true; }
      }
    }
    if (groups.some(group => group.type === 'beam')) throw new Error(`Measure ${measureIndex + 1}: close the connected underline group before the barline.`);
    parsed.push({ events, repeatStart, rightMark, newSystem, ...currentMeter, meterChanged: meterChanged || measureIndex === 0 });
  }
  if (groups.length) throw new Error('Close every s(…) slur with a right parenthesis.');
  return parsed;
}

function appendXmlText(xml, parent, name, value) { const element = xml.createElement(name); element.textContent = String(value); parent.append(element); return element; }

function remapEventId(oldId, oldEvents, newEvents) {
  const oldEvent = oldEvents.find(event => event.id === oldId); if (!oldEvent) return null;
  const exact = newEvents.find(event => event.measure === oldEvent.measure && Math.abs(event.beat - oldEvent.beat) < .001);
  return exact?.id || newEvents.find(event => event.id === oldId)?.id || null;
}

function setDirectEntryStatus(message, severity = false) {
  const localStatus = $('#jianpu-entry-status');
  localStatus.textContent = message;
  localStatus.classList.toggle('error', severity === true || severity === 'error');
  localStatus.classList.toggle('warning', severity === 'warning');
  $('#status').textContent = message;
}

function validateParsedJianpuRender(parsedMeasures) {
  const warnings = [], grid = $('#score-grid');
  grid.querySelectorAll('.render-warning').forEach(element => { element.classList.remove('render-warning'); element.removeAttribute('data-render-warning'); });
  const warn = (message, element) => {
    warnings.push(message);
    if (element) { element.classList.add('render-warning'); element.dataset.renderWarning = message; }
  };
  if (state.measures.length !== parsedMeasures.length) warn(`Expected ${parsedMeasures.length} measures but rendered ${state.measures.length}.`, grid);
  parsedMeasures.forEach((expectedMeasure, measureIndex) => {
    const actualMeasure = state.measures[measureIndex], section = grid.querySelector(`.measure[data-measure-number="${measureIndex + 1}"]`);
    if (!actualMeasure || !section) { warn(`Measure ${measureIndex + 1} is missing from the preview.`, grid); return; }
    const prefix = `Measure ${measureIndex + 1}`;
    if (actualMeasure.timeSignatureBeats !== expectedMeasure.beats || actualMeasure.beatType !== expectedMeasure.beatType) warn(`${prefix}: meter {${expectedMeasure.beats}/${expectedMeasure.beatType}} was not preserved.`, section);
    if (Boolean(actualMeasure.newSystem) !== Boolean(expectedMeasure.newSystem && measureIndex > 0)) warn(`${prefix}: @ system break was not preserved.`, section);
    if (Boolean(actualMeasure.repeatStart) !== Boolean(expectedMeasure.repeatStart)) warn(`${prefix}: repeat-start marker was not preserved.`, section);
    const expectedRight = expectedMeasure.rightMark || (measureIndex === parsedMeasures.length - 1 ? 'final' : null);
    const actualRight = actualMeasure.repeatEnd ? 'repeat-end' : actualMeasure.barStyle === 'light-light' ? 'double' : actualMeasure.barStyle === 'light-heavy' ? 'final' : null;
    if (actualRight !== expectedRight) warn(`${prefix}: ${expectedRight || 'ordinary'} ending barline rendered as ${actualRight || 'ordinary'}.`, section);
    if (actualMeasure.events.length !== expectedMeasure.events.length) warn(`${prefix}: expected ${expectedMeasure.events.length} timed symbols but rendered ${actualMeasure.events.length}.`, section);
    expectedMeasure.events.forEach((expected, eventIndex) => {
      const actual = actualMeasure.events[eventIndex], cell = section.querySelectorAll('.event')[eventIndex];
      if (!actual || !cell) { warn(`${prefix}, symbol ${eventIndex + 1} is missing.`, section); return; }
      const expectedDegree = `${expected.accidental > 0 ? '#' : expected.accidental < 0 ? 'b' : ''}${expected.degree}`;
      const renderedDegree = cell.querySelector('.degree')?.textContent || '';
      if (renderedDegree !== expectedDegree) warn(`${prefix}, symbol ${eventIndex + 1}: expected ${expectedDegree} but rendered ${renderedDegree || 'nothing'}.`, cell);
      const expectedMidi = expected.degree === 0 ? null : tonicMidi() + MAJOR_STEPS[expected.degree - 1] + expected.accidental + expected.octave * 12;
      if (expectedMidi !== actual.midi) warn(`${prefix}, symbol ${eventIndex + 1}: octave or accidental was not preserved.`, cell);
      if (expected.degree !== 0 && actual.jianpuOctave !== expected.octave) warn(`${prefix}, symbol ${eventIndex + 1}: encoded octave count was not preserved.`, cell);
      if (Math.abs(expected.duration - actual.duration) > .001) warn(`${prefix}, symbol ${eventIndex + 1}: duration was not preserved.`, cell);
      const upperCount = cell.querySelectorAll('.octave-mark.upper .octave-dot').length, lowerCount = cell.querySelectorAll('.octave-mark.lower .octave-dot').length;
      if (upperCount !== Math.max(0, expected.octave) || lowerCount !== Math.max(0, -expected.octave)) warn(`${prefix}, symbol ${eventIndex + 1}: octave mark was not rendered.`, cell);
      const expectedContinuations = continuationParts({ duration: expected.duration }).map(part => part.symbol).join('');
      const renderedContinuations = [...cell.querySelectorAll('.continuation')].map(mark => mark.textContent).join('');
      if (renderedContinuations !== expectedContinuations) warn(`${prefix}, symbol ${eventIndex + 1}: sustain or duration dot was not rendered.`, cell);
      if (Boolean(expected.beam) !== Boolean(cell.querySelector('.beam-link'))) warn(`${prefix}, symbol ${eventIndex + 1}: connected underline was not rendered.`, cell);
      if (expected.slurStart && !section.querySelector(`.slur-overlay[data-slur-number="${expected.slurStart}"]`)) warn(`${prefix}, symbol ${eventIndex + 1}: slur was not rendered.`, cell);
    });
    const beatUnit = 4 / Number(actualMeasure.beatType || 4), expectedGuides = Math.max(1, Math.round(actualMeasure.expectedBeats / beatUnit));
    if (section.querySelectorAll('.alignment-guide').length !== expectedGuides) warn(`${prefix}: meter beat guides were not rendered correctly.`, section);
  });
  return [...new Set(warnings)];
}

function updateJianpuPairCheck() {
  const input = $('#jianpu-input'), text = input.value, issues = jianpuParenthesisIssues(text), selection = window.getSelection();
  let caretOffset = null;
  if (document.activeElement === input && selection?.rangeCount) {
    const range = selection.getRangeAt(0), before = range.cloneRange(); before.selectNodeContents(input); before.setEnd(range.endContainer, range.endOffset); caretOffset = before.toString().length;
  }
  const invalid = issues.size > 0; input.classList.toggle('pair-error', invalid); input.setAttribute('aria-invalid', String(invalid));
  input.title = invalid ? [...new Set(issues.values())].join('; ') : '';
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < text.length; index += 1) {
    if (!issues.has(index)) { fragment.append(document.createTextNode(text[index])); continue; }
    const mark = document.createElement('mark'); mark.className = 'jianpu-pair-error'; mark.textContent = text[index]; mark.title = issues.get(index); fragment.append(mark);
  }
  input.replaceChildren(fragment);
  if (caretOffset !== null) {
    const walker = document.createTreeWalker(input, NodeFilter.SHOW_TEXT); let remaining = caretOffset, node = walker.nextNode(), target = input, offset = 0;
    while (node) { if (remaining <= node.data.length) { target = node; offset = remaining; break; } remaining -= node.data.length; node = walker.nextNode(); }
    const range = document.createRange(); range.setStart(target, offset); range.collapse(true); selection.removeAllRanges(); selection.addRange(range);
  }
  return !invalid;
}

function buildDirectEntryXml() {
  setDirectEntryStatus('');
  if (!updateJianpuPairCheck()) { setDirectEntryStatus('Correct the red pairing errors before updating the notation preview.', true); return; }
  const preserved = {
    events: state.events,
    tokens: { 1: state.tokens['1'], 2: state.tokens['2'] },
    assignments: { 1: new Map(state.assignments['1']), 2: new Map(state.assignments['2']) },
    staffNotes: state.staffNotes.map(note => ({ ...note })),
    staffAssignments: new Map(state.staffAssignments),
    photoConflicts: state.photoConflicts.map(conflict => ({ ...conflict })),
    staffRegisters: { ...state.staffRegisters },
    firstNoteOffsets: new Map(state.firstNoteOffsets),
    measureWidths: new Map(state.measureWidths),
    nextStaffNoteId: state.nextStaffNoteId,
  };
  if (!$('#entry-key').value) { setDirectEntryStatus($('#entry-key-display').value.startsWith('Unusual') ? 'This unusual key signature needs review before Jianpu can be generated.' : 'Match the printed key signature and choose Done before applying Jianpu.', true); return; }
  let measures;
  try { measures = parseJianpuText($('#jianpu-input').value); }
  catch (error) { setDirectEntryStatus(error.message, true); return; }
  const fifths = Number($('#entry-key').value), firstMeter = measures[0], beats = firstMeter.beats, beatType = firstMeter.beatType;
  const pickupCount = Number($('#entry-pickup-count').value), pickupNoteValue = Number($('#entry-pickup-type').value);
  const pickupCheck = validatePickupDuration(pickupCount, pickupNoteValue, beats, beatType);
  if (!pickupCheck.valid) { setDirectEntryStatus(pickupCheck.error, true); return; }
  const pickup = pickupDurationInQuarterNotes(pickupCount, pickupNoteValue), measureCapacity = measureCapacityInQuarterNotes(beats, beatType);
  const tempoText = $('#entry-tempo-text').value, tempoValue = $('#entry-tempo').value.trim(), tempo = tempoValue ? Number(tempoValue) : null;
  if (tempo !== null && (!Number.isFinite(tempo) || tempo < 20 || tempo > 300)) { setDirectEntryStatus('Quarter-note BPM must be between 20 and 300, or left blank.', true); return; }
  const hymnNumber = Number($('#hymn-number').value) || 'new';
  const xml = new DOMParser().parseFromString('<?xml version="1.0"?><score-partwise version="4.0"><work><work-title/></work><identification><encoding><software>Hymn Play Jianpu Encoding Rules</software></encoding></identification><part-list><score-part id="P1"><part-name>Melody</part-name><midi-instrument id="P1-I1"><midi-channel>1</midi-channel><midi-program>1</midi-program></midi-instrument></score-part></part-list><part id="P1"/></score-partwise>', 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('The internal MusicXML template is malformed.');
  xml.querySelector('work-title').textContent = `Hymn ${hymnNumber} - Jianpu encoded source`;
  const part = xml.querySelector('score-partwise > part[id="P1"]');
  if (!part) throw new Error('The generated MusicXML melody part could not be created.');
  const [, tonicPc] = KEYS[fifths] || KEYS[0];
  const tonicMidiValue = 60 + ((tonicPc - 0 + 12) % 12);
  measures.forEach((measureData, measureIndex) => {
    const entries = measureData.events;
    let rhythmicCursor = 0;
    for (let index = 0; index < entries.length; index += 1) {
      const current = entries[index], next = entries[index + 1];
      if (!current.beam && !next?.beam && current.duration === .5 && next?.duration === .5 && Math.abs(rhythmicCursor - Math.round(rhythmicCursor)) < .001) { current.beam = 'begin'; next.beam = 'end'; }
      rhythmicCursor += current.duration;
    }
    const measure = xml.createElement('measure'); measure.setAttribute('number', String(measureIndex + 1));
    if (measureData.newSystem && measureIndex > 0) { const print = xml.createElement('print'); print.setAttribute('new-system', 'yes'); measure.append(print); }
    if (measureIndex === 0 && pickup > 0) measure.setAttribute('implicit', 'yes');
    if (measureIndex === 0 || measureData.meterChanged) {
      const attributes = xml.createElement('attributes'); appendXmlText(xml, attributes, 'divisions', 4);
      if (measureIndex === 0) { const key = xml.createElement('key'); appendXmlText(xml, key, 'fifths', fifths); attributes.append(key); }
      const time = xml.createElement('time'); appendXmlText(xml, time, 'beats', measureData.beats); appendXmlText(xml, time, 'beat-type', measureData.beatType); attributes.append(time);
      if (measureIndex === 0) { appendXmlText(xml, attributes, 'staves', 1); const clef = xml.createElement('clef'); appendXmlText(xml, clef, 'sign', 'G'); appendXmlText(xml, clef, 'line', 2); attributes.append(clef); }
      measure.append(attributes);
      if (measureIndex === 0) {
      if (tempoText || tempo !== null) {
        const direction = xml.createElement('direction'), directionType = xml.createElement('direction-type');
        if (tempoText) appendXmlText(xml, directionType, 'words', tempoText);
        if (tempo !== null) { const metronome = xml.createElement('metronome'); appendXmlText(xml, metronome, 'beat-unit', 'quarter'); appendXmlText(xml, metronome, 'per-minute', tempo); directionType.append(metronome); }
        direction.append(directionType);
        if (tempo !== null) { const sound = xml.createElement('sound'); sound.setAttribute('tempo', String(tempo)); direction.append(sound); }
        measure.append(direction);
      }
      }
    }
    if (measureData.repeatStart) { const barline = xml.createElement('barline'); barline.setAttribute('location', 'left'); appendXmlText(xml, barline, 'bar-style', 'heavy-light'); const repeat = xml.createElement('repeat'); repeat.setAttribute('direction', 'forward'); barline.append(repeat); measure.append(barline); }
    for (const entry of entries) {
      const note = xml.createElement('note');
      if (entry.degree === 0) note.append(xml.createElement('rest'));
      else {
        note.setAttribute('hymn-play-jianpu-octave', String(entry.octave));
        const pitch = xml.createElement('pitch'); const natural = tonicMidiValue + MAJOR_STEPS[entry.degree - 1] + entry.accidental + entry.octave * 12; const value = pitchFromMidi(natural, entry.accidental < 0 || (entry.accidental === 0 && fifths < 0));
        appendXmlText(xml, pitch, 'step', value.step); if (value.alter) appendXmlText(xml, pitch, 'alter', value.alter); appendXmlText(xml, pitch, 'octave', value.octave); note.append(pitch);
      }
      appendXmlText(xml, note, 'duration', Math.round(entry.duration * 4)); appendXmlText(xml, note, 'voice', 1);
      const notation = musicXmlTypeForBeats(entry.duration); appendXmlText(xml, note, 'type', notation.type); for (let dot = 0; dot < notation.dots; dot += 1) note.append(xml.createElement('dot')); appendXmlText(xml, note, 'staff', 1); measure.append(note);
      if (entry.beam) appendXmlText(xml, note, 'beam', entry.beam).setAttribute('number', '1');
      if (entry.slurStart || entry.slurStop) {
        const notations = xml.createElement('notations');
        if (entry.slurStart) { const slur = xml.createElement('slur'); slur.setAttribute('type', 'start'); slur.setAttribute('number', entry.slurStart); slur.setAttribute('placement', 'above'); notations.append(slur); }
        if (entry.slurStop) { const slur = xml.createElement('slur'); slur.setAttribute('type', 'stop'); slur.setAttribute('number', entry.slurStop); notations.append(slur); }
        note.append(notations);
      }
    }
    const rightMark = measureData.rightMark || (measureIndex === measures.length - 1 ? 'final' : null);
    if (rightMark) {
      const barline = xml.createElement('barline'); barline.setAttribute('location', 'right');
      appendXmlText(xml, barline, 'bar-style', rightMark === 'double' ? 'light-light' : 'light-heavy');
      if (rightMark === 'repeat-end') { const repeat = xml.createElement('repeat'); repeat.setAttribute('direction', 'backward'); barline.append(repeat); }
      measure.append(barline);
    }
    part.append(measure);
  });
  const rebuilt = parseScore(xml);
  Object.assign(state, { xml, filename: `hymn-${hymnNumber}-jianpu.musicxml`, ...rebuilt, history: [], future: [], selectedTokenId: null, shiftAnchorTokenId: null, selectedEventId: null, selectedContinuation: null });
  measures.forEach((parsedMeasure, measureIndex) => parsedMeasure.events.forEach((parsedEvent, eventIndex) => {
    const rebuiltEvent = state.measures[measureIndex]?.events[eventIndex];
    if (rebuiltEvent && !rebuiltEvent.isRest) setEventJianpuOctave(rebuiltEvent, parsedEvent.octave);
  }));
  state.tokens = preserved.tokens;
  state.assignments = { 1: new Map(), 2: new Map() };
  for (const language of ['1', '2']) for (const [oldEventId, tokenId] of preserved.assignments[language]) {
    const newEventId = remapEventId(oldEventId, preserved.events, state.events); if (newEventId) state.assignments[language].set(newEventId, tokenId);
  }
  state.staffNotes = preserved.staffNotes;
  for (const note of state.staffNotes) if (note.sourceEventId) note.sourceEventId = remapEventId(note.sourceEventId, preserved.events, state.events);
  state.staffAssignments = preserved.staffAssignments; state.photoConflicts = preserved.photoConflicts; state.staffRegisters = preserved.staffRegisters; state.firstNoteOffsets = preserved.firstNoteOffsets; state.measureWidths = preserved.measureWidths; state.nextStaffNoteId = preserved.nextStaffNoteId; state.selectedStaffNoteId = null;
  const restoredChineseAlignment = restoreChineseAlignmentIfMissing();
  const [keyName] = KEYS[fifths] || KEYS[0]; $('#key-label').textContent = `1 = ${keyName}`; $('#file-summary').textContent = `${state.filename} · ${state.measures.length} measures · direct entry`; $('#editor').classList.remove('hidden');
  const keptChinese = state.assignments['1'].size, keptEnglish = state.assignments['2'].size, staffMessage = state.staffNotes.length ? ' Existing staff notes were kept; regenerate Soprano if the melody changed.' : '';
  const successMessage = `Jianpu preview updated. ${restoredChineseAlignment ? 'Restored' : 'Preserved'} ${keptChinese} Chinese and preserved ${keptEnglish} Jianpu English assignment${keptEnglish === 1 ? '' : 's'}.${staffMessage}`;
  render();
  const renderWarnings = validateParsedJianpuRender(measures);
  setDirectEntryStatus(renderWarnings.length ? `Warning: ${renderWarnings.join(' ')}` : successMessage, renderWarnings.length ? 'warning' : false);
}

function updateNotationPreviewFromJianpu() {
  setDirectEntryStatus('Reading the Jianpu Encoded Stream…');
  try {
    buildDirectEntryXml();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setDirectEntryStatus(`Update failed after parsing the Jianpu stream: ${message}`, true);
    console.error('Jianpu preview update failed', error);
  }
}

function autoApplyChineseLyrics() {
  if (!state.xml) { $('#status').textContent = 'Build or open a score first.'; return; }
  const tokens = tokenizeChinese($('#zh-input').value).map((token, index) => ({ ...token, id: `1-${index}` }));
  const candidates = state.events.map(event => ({ ...event, slurStop: slurs(event.note).some(slur => slur.getAttribute('type') === 'stop') }));
  const choice = chooseChineseLyricAnchors(candidates, tokens.length), anchors = choice.anchors;
  if (choice.mode === 'mismatch') { $('#status').textContent = `Chinese auto-alignment found ${tokens.length} characters, ${choice.noteCount} note anchors, or ${choice.connectedGroupCount} anchors when connected underlines are grouped. Add connectors or correct the tune first.`; return; }
  recordChange(); state.tokens['1'] = tokens; state.assignments['1'] = new Map(anchors.map((event, index) => [event.id, tokens[index].id])); state.activeLanguage = '1'; state.selectedTokenId = null; state.shiftAnchorTokenId = null;
  $('#status').textContent = choice.mode === 'connected-group'
    ? `Applied ${tokens.length} Chinese characters. Each connected-underlined group was treated as one sung-character position.`
    : `Applied ${tokens.length} Chinese characters sequentially. Connector stop notes were treated as lyric extensions.`;
  render();
}

function restoreChineseAlignmentIfMissing() {
  if (!state.xml || state.assignments['1'].size || !$('#zh-input').value.trim()) return false;
  const tokens = tokenizeChinese($('#zh-input').value).map((token, index) => ({ ...token, id: `1-${index}` }));
  const candidates = state.events.map(event => ({ ...event, slurStop: slurs(event.note).some(slur => slur.getAttribute('type') === 'stop') }));
  const choice = chooseChineseLyricAnchors(candidates, tokens.length);
  if (choice.mode === 'mismatch') return false;
  state.tokens['1'] = tokens;
  state.assignments['1'] = new Map(choice.anchors.map((event, index) => [event.id, tokens[index].id]));
  return true;
}

let staffPhotoReviewData = null;

function staffPhotoMetrics(imageData) {
  const { data, width, height } = imageData, step = Math.max(1, Math.floor(Math.sqrt(width * height / 300000)));
  let count=0,sum=0,sumSquares=0,gradient=0,gradientCount=0,minX=width,minY=height,maxX=-1,maxY=-1;
  const rowInk = new Uint32Array(Math.ceil(height / step));
  for (let y=0,row=0;y<height;y+=step,row+=1) for (let x=0;x<width;x+=step) {
    const offset=(y*width+x)*4, gray=.2126*data[offset]+.7152*data[offset+1]+.0722*data[offset+2];
    count+=1; sum+=gray; sumSquares+=gray*gray;
    if (gray<185) { minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); rowInk[row]+=1; }
    if (x>=step) { const left=(y*width+x-step)*4, leftGray=.2126*data[left]+.7152*data[left+1]+.0722*data[left+2]; gradient+=Math.abs(gray-leftGray); gradientCount+=1; }
  }
  const mean=sum/Math.max(1,count), deviation=Math.sqrt(Math.max(0,sumSquares/Math.max(1,count)-mean*mean));
  const samplesPerRow=Math.ceil(width/step), strongRows=[...rowInk].filter(value=>value/samplesPerRow>.035).length;
  const pageCoverage=maxX>=0 ? ((maxX-minX+step)*(maxY-minY+step))/(width*height) : 0;
  return {
    width,height,pageCoverage:Math.min(1,pageCoverage),
    staffLineConfidence:Math.min(1,strongRows/18),
    blurScore:Math.min(1,(gradient/Math.max(1,gradientCount))/14),
    contrastScore:Math.min(1,deviation/55),perspectiveSkewDegrees:0,croppedMusicalContent:false,
  };
}

function showStaffPhotoDecision(quality, file, width, height) {
  const panel=$('#staff-photo-decision'), labels={ accept:'Automatic quality check: Passed', warning:'Automatic quality check: Passed with warnings', reject:'Automatic quality check: Failed' };
  panel.className=`photo-review-decision ${quality.decision}`;
  const details=[...(quality.reasons||[]),...(quality.recommendations||[])];
  panel.innerHTML=`<strong>${labels[quality.decision]}</strong><div>${escapeHtml(file.name)} · ${width} × ${height}px · ${escapeHtml(file.type||'image')}</div>${details.length?`<ul>${details.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:''}`;
  $('#accept-staff-photo').disabled=quality.decision==='reject';
  $('#accept-staff-photo').textContent='Continue: Extract Staff Layout';
}

function drawStaffPhotoReview() {
  if (!staffPhotoReviewData) return;
  const canvas=$('#staff-photo-canvas'), context=canvas.getContext('2d');
  canvas.width=staffPhotoReviewData.width; canvas.height=staffPhotoReviewData.height;
  context.putImageData(staffPhotoReviewData.cleaned,0,0);
  if (!staffPhotoReviewData.extraction||!$('#show-staff-regions').checked) return;
  const confidenceColor=confidence=>{const percent=(Number(confidence)||0)*100;return percent>=95?'#0b5d3b':percent>=85?'#00a9b8':percent>=65?'#e07a00':'#c62828';};
  context.save(); context.lineWidth=Math.max(2,Math.round(canvas.width/700)); context.font=`${Math.max(16,Math.round(canvas.width/70))}px system-ui`;
  for (const [index,system] of staffPhotoReviewData.extraction.systems.entries()) {
    const { y,height }=system.bbox,x=Number.isFinite(system.contentX1)?system.contentX1:system.bbox.x,right=Number.isFinite(system.contentX2)?system.contentX2:system.bbox.x+system.bbox.width,width=Math.max(1,right-x); context.strokeStyle=confidenceColor(system.confidence); context.fillStyle=confidenceColor(system.confidence); context.setLineDash([12,8]); context.strokeRect(x+2,y+2,width-4,height-4); context.setLineDash([]); context.fillText(`System ${index+1} · ${Math.round(system.confidence*100)}%`,x+10,y+Math.max(22,canvas.width/65));
  }
  context.lineWidth=Math.max(2,Math.round(canvas.width/850));
  for (const staff of staffPhotoReviewData.extraction.staffs) { const system=staffPhotoReviewData.extraction.systems.find(item=>item.staffIds.includes(staff.id)),left=system?.contentX1??0,right=system?.contentX2??canvas.width;context.strokeStyle=confidenceColor(staff.confidence); for (const y of staff.lines) { context.beginPath(); context.moveTo(left,y); context.lineTo(right,y); context.stroke(); } }
  for(const boundary of staffPhotoReviewData.extraction.boundaries||[]){const system=staffPhotoReviewData.extraction.systems.find(item=>item.id===boundary.systemId),staffs=system?.staffIds.map(id=>staffPhotoReviewData.extraction.staffs.find(item=>item.id===id));if(!staffs?.every(Boolean))continue;context.strokeStyle=confidenceColor(boundary.confidence);context.lineWidth=Math.max(boundary.kind==='stop-or-repeat'?3:2,Math.round(canvas.width/900));const spans=boundary.kind==='measure'?staffs.map(staff=>[staff.lines[0],staff.lines[4]]):[[staffs[0].lines[0],staffs.at(-1).lines[4]]];for(const [top,bottom] of spans){context.beginPath();context.moveTo(boundary.x,top);context.lineTo(boundary.x,bottom);context.stroke();}}
  context.restore();
}

function showStaffRegionExtraction(extraction) {
  const panel=$('#staff-region-result'), success=extraction.systems.length>0;
  const confidenceMeter='<div class="confidence-meter" aria-label="Extraction confidence colors"><span class="confidence-high">High<br><small>95–100%</small></span><span class="confidence-middle">Middle<br><small>85–94%</small></span><span class="confidence-low">Low<br><small>65–84%</small></span><span class="confidence-none">No confidence<br><small>0–64%</small></span></div>';
  panel.className=`staff-region-result ${success?'accept':'reject'}`;
  panel.innerHTML=`<strong>${success?`${extraction.systems.length} hymn system${extraction.systems.length===1?'':'s'} extracted`:'Staff-region extraction failed'}</strong><div>${extraction.staffs.length} five-line staff region${extraction.staffs.length===1?'':'s'} · ${(extraction.boundaries||[]).length} vertical boundaries · ${Math.round(extraction.confidence*100)}% geometry confidence</div>${confidenceMeter}${extraction.warnings.length?`<ul>${extraction.warnings.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:''}<div class="photo-stage-note">System boxes, staff guides, and extracted measure/system/stop boundaries use the confidence colors above. Horizontal guides stop at the detected outer bars. No notes or MusicXML were created.</div>`;
  panel.classList.remove('hidden');$('#show-staff-regions-control').classList.toggle('hidden',!success);$('#show-staff-regions').disabled=!success; $('#show-staff-regions').checked=success;
}

async function loadStaffPhoto(file) {
  const dialog=$('#staff-photo-review');
  $('#staff-photo-review-title').textContent=`Review ${file.name}`;
  $('#staff-photo-editor-result').classList.add('hidden');
  $('#staff-photo-progress').classList.remove('hidden'); $('#staff-photo-review-content').classList.add('hidden');
  if (!dialog.open) dialog.showModal();
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  try {
    const bitmap=await createImageBitmap(file), canvas=document.createElement('canvas');
    canvas.width=bitmap.width; canvas.height=bitmap.height; const context=canvas.getContext('2d',{willReadFrequently:true}); context.drawImage(bitmap,0,0); bitmap.close();
    const original=context.getImageData(0,0,canvas.width,canvas.height), metrics=staffPhotoMetrics(original), quality=assessStaffPhotoQuality(metrics);
    const cleaned=new ImageData(new Uint8ClampedArray(original.data),canvas.width,canvas.height);
    staffPhotoReviewData={ file,width:canvas.width,height:canvas.height,original,cleaned,quality,metrics,cleanup:{skipped:true,reason:'accepted-working-image'},extraction:null };
    $('#staff-region-result').classList.add('hidden');$('#show-staff-regions-control').classList.add('hidden'); $('#show-staff-regions').checked=false; $('#show-staff-regions').disabled=true;
    showStaffPhotoDecision(quality,file,canvas.width,canvas.height); drawStaffPhotoReview();
    $('#staff-photo-progress').classList.add('hidden'); $('#staff-photo-review-content').classList.remove('hidden');
  } catch (error) {
    staffPhotoReviewData=null; $('#staff-photo-progress').classList.add('hidden'); $('#staff-photo-review-content').classList.remove('hidden');
    $('#staff-photo-decision').className='photo-review-decision reject'; $('#staff-photo-decision').innerHTML='<strong>Photo rejected</strong><div>This browser could not decode the file. Export HEIC/HEIF or TIFF as a full-resolution PNG or high-quality JPEG and try again.</div>';
    $('#accept-staff-photo').disabled=true; console.error(error);
  }
}

function acceptStaffPhoto() {
  if (!staffPhotoReviewData||staffPhotoReviewData.quality.decision==='reject') return;
  if (staffPhotoReviewData.committed) { $('#staff-photo-review').close(); return; }
  if (!staffPhotoReviewData.extraction) {
    const { cleaned,width,height }=staffPhotoReviewData;
    const extraction=extractStaffRegions(cleaned.data,width,height); staffPhotoReviewData.extraction=extraction;
    showStaffRegionExtraction(extraction); drawStaffPhotoReview();
    $('#accept-staff-photo').disabled=!extraction.systems.length; $('#accept-staff-photo').textContent=extraction.systems.length?'Use Extracted Staff Layout':'Extraction failed';
    return;
  }
  const { file,width,height,quality,metrics,cleanup,cleaned,extraction }=staffPhotoReviewData;
  state.staffPhoto={ name:file.name,type:file.type,width,height,quality,metrics,cleanup,cleaned,extraction,acceptedAt:new Date().toISOString(),stage:extraction.stage };
  projectSession.processing.layout={status:'accepted',updatedAt:new Date().toISOString(),data:extraction};projectSession.processing.recognition={status:'not-started',updatedAt:null};projectSession.processing.review={status:'not-started',updatedAt:null};saveProcessingState().catch(error=>console.error(error));updatePipelineAvailability();
  $('#staff-photo-status').textContent=`${file.name}: ${extraction.systems.length} staff system${extraction.systems.length===1?'':'s'} extracted${extraction.warnings.length?' with warnings':''}.`;
  $('#staff-photo-editor-summary').textContent=`${extraction.systems.length} systems · ${extraction.staffs.length} staffs · ${(extraction.boundaries||[]).length} vertical bars · ${Math.round(extraction.confidence*100)}% confidence`;
  $('#staff-photo-editor-meter').innerHTML='<span class="confidence-high">95–100%</span><span class="confidence-middle">85–94%</span><span class="confidence-low">65–84%</span><span class="confidence-none">0–64%</span>';
  $('#staff-photo-editor-result').classList.remove('hidden'); $('#recognize-source-content').disabled=false; staffPhotoReviewData.committed=true;
  const review=$('#source-recognition-summary');
  review.classList.add('has-result');
  review.innerHTML=`<strong>${escapeHtml(file.name)} · staff layout staged</strong><span>${extraction.systems.length} systems · ${extraction.staffs.length} staffs · ${(extraction.boundaries||[]).length} vertical boundaries · ${Math.round(extraction.confidence*100)}% confidence</span>${extraction.warnings.length?`<ul>${extraction.warnings.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:'<span>No layout-extraction warnings.</span>'}<span>These results remain provisional. No photo-derived notes were written to MusicXML.</span>`;
  showSourcePanel('recognition');
  $('#status').textContent='Staff regions are staged in memory for symbol recognition. No photo-derived notes have been written to MusicXML.';
  $('#staff-photo-review').close();
}

function reviewExtractedStaffRegions() {
  if (!staffPhotoReviewData?.extraction) return;
  $('#staff-photo-progress').classList.add('hidden'); $('#staff-photo-review-content').classList.remove('hidden');
  $('#accept-staff-photo').disabled=false; $('#accept-staff-photo').textContent='Close region review';
  $('#show-staff-regions-control').classList.remove('hidden');$('#show-staff-regions').checked=true; showStaffRegionExtraction(staffPhotoReviewData.extraction); drawStaffPhotoReview();
  const dialog=$('#staff-photo-review'); if(!dialog.open)dialog.showModal();
}

const emptyProcessingState=()=>({schemaVersion:1,activeInput:null,workingImage:null,preparation:{status:'not-started',updatedAt:null},layout:{status:'not-started',updatedAt:null,data:null},recognition:{status:'not-started',updatedAt:null},review:{status:'not-started',updatedAt:null}});
let projectSession={name:null,handle:null,parentHandle:null,savedSnapshot:null,sources:[],savedSources:[],activeSource:null,processing:emptyProcessingState(),preparationDirty:false,requiresInitialInput:false,addControlsVisible:false};
function projectHasUnsavedWork(){return Boolean(projectSession.name&&(projectSession.preparationDirty||state.history.length||JSON.stringify(manifestSources())!==JSON.stringify(projectSession.savedSources)||(state.xml&&projectSession.savedSnapshot===null)));}
function updateUnsavedIndicator(){const save=$('#project-save'),message=$('#project-save-message'),dirty=projectHasUnsavedWork();if(save){save.classList.toggle('dirty',dirty);save.setAttribute('aria-label',dirty?'Unsaved changes. Save project files':'Save project files');}if(message)message.textContent=dirty?'Unsaved changes. Click here to save.':'Save updates the working MusicXML, revised MusicXML, alignment JSON, and project state.';}
let sourcePreviewUrl=null;
let deleteParentHandle=null;
let deleteProjectTargets=new Map();
const preparedPhotoRequests=new Map();

function showProjectInputDialog(){
  $('#close-project-input').disabled=projectSession.requiresInitialInput;
  const dialog=$('#project-input-dialog');if(!dialog.open)dialog.showModal();
}

function setProjectWorkspaceVisible(visible){
  $('#project-launcher').classList.toggle('hidden',visible);
  $('#project-open-actions').classList.toggle('hidden',!visible);
  $('#file-level-actions').classList.toggle('hidden',!visible);
  $('#major-tabs').classList.toggle('hidden',!visible);
  if(!visible){$('#source-processing-tab').classList.add('hidden');$('#editor-tab').classList.add('hidden');}
  updateUnsavedIndicator();
}

function showMajorTab(name) {
  if(name==='editor'&&projectSession.requiresInitialInput)return;
  document.querySelectorAll('.major-tab').forEach(button=>{const active=button.dataset.majorTab===name;button.classList.toggle('active',active);button.setAttribute('aria-selected',String(active));});
  document.querySelectorAll('.source-file-action').forEach(button=>button.classList.toggle('tab-inapplicable',name!=='source'));
  $('#source-processing-tab').classList.toggle('hidden',name!=='source'); $('#editor-tab').classList.toggle('hidden',name!=='editor');
}

function selectPipelineOperation(name){document.querySelectorAll('.pipeline-operation').forEach(button=>{const active=button.id===name;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});}

function showSourcePanel(name){
  $('#photo-preparation-panel').classList.toggle('hidden',name!=='preparation');
  $('#document-source-panel').classList.toggle('hidden',name!=='document');
  $('#recognition-review-panel').classList.toggle('hidden',name!=='recognition');
  if(name==='preparation')selectPipelineOperation('prepare-photo');
  else if(name==='document')selectPipelineOperation('');
}

function activateProject(name,{handle=null,parentHandle=null,requiresInitialInput=false}={}) {
  projectSession={name,handle,parentHandle,savedSnapshot:state.xml?snapshot():null,sources:[],savedSources:[],activeSource:null,processing:emptyProcessingState(),preparationDirty:false,requiresInitialInput,addControlsVisible:requiresInitialInput};
  $('#project-name-display').textContent=name;
  setProjectWorkspaceVisible(!requiresInitialInput);
  if(!requiresInitialInput)showMajorTab('source'); refreshSourceFileList();
}

function clearProjectSession() {
  projectSession={name:null,handle:null,parentHandle:null,savedSnapshot:null,sources:[],savedSources:[],activeSource:null,processing:emptyProcessingState(),preparationDirty:false,requiresInitialInput:false,addControlsVisible:false};
  $('#project-open-actions').classList.add('hidden');$('#file-level-actions').classList.add('hidden'); $('#major-tabs').classList.add('hidden'); $('#source-processing-tab').classList.add('hidden'); $('#editor-tab').classList.add('hidden'); $('#project-launcher').classList.remove('hidden');
}

function clearProjectWorkspace() {
  Object.assign(state,{xml:null,filename:'',events:[],measures:[],fifths:0,activeLanguage:'1',tokens:{1:[],2:[]},assignments:{1:new Map(),2:new Map()},staffNotes:[],staffAssignments:new Map(),photoConflicts:[],staffPhoto:null,staffRegisters:{treble:0,bass:0},spacing:{measureWidth:320,symbolWidth:56,measuresPerLine:'auto'},containerSize:null,layoutProfiles:{},firstNoteOffsets:new Map(),measureWidths:new Map(),nextStaffNoteId:1,selectedStaffNoteId:null,staffBeamMode:null,staffBeamStartId:null,selectedTokenId:null,shiftAnchorTokenId:null,selectedEventId:null,selectedContinuation:null,history:[],future:[]});
  projectSession.sources=[]; projectSession.savedSources=[]; projectSession.activeSource=null;projectSession.processing=emptyProcessingState();projectSession.preparationDirty=false;projectSession.requiresInitialInput=true;projectSession.addControlsVisible=true; projectSession.savedSnapshot=null; staffPhotoReviewData=null;
  $('#file-input').value=''; $('#source-photo-input').value=''; $('#source-musicxml-input').value=''; $('#source-reference-input').value='';
  $('#jianpu-input').value=''; updateJianpuPairCheck(); $('#zh-input').value=''; $('#en-input').value=''; $('#file-summary').textContent='No score loaded'; $('#editor').classList.add('hidden');
  $('#staff-photo-status').textContent='Choose a photo above to begin.'; $('#staff-photo-editor-result').classList.add('hidden');$('#extract-staff-layout').disabled=true;$('#recognize-source-content').disabled=true;$('#review-recognition').disabled=true;selectPipelineOperation('prepare-photo');
  const review=$('#source-recognition-summary'); review.className='source-empty-preview'; review.innerHTML='<strong>Recognition results will appear after analysis</strong><span>Staff-photo recognition remains provisional and does not modify MusicXML.</span>';
  const frame=$('#photo-cleaner-frame'); frame.src=frame.src; refreshSourceFileList(); showMajorTab('source'); showSourcePanel('preparation');
}

async function projectFileHandle(directory,name,{confirmReplace=false}={}){
  let exists=false;try{await directory.getFileHandle(name);exists=true;}catch(error){if(error.name!=='NotFoundError')throw error;}
  if(exists&&confirmReplace&&!confirm(`${name} already exists. Replace it?`))return null;
  return directory.getFileHandle(name,{create:true});
}

async function writeProjectFile(directory,name,content,type='application/json',options={}) {
  const fileHandle=await projectFileHandle(directory,name,options);if(!fileHandle)return null;const writable=await fileHandle.createWritable();await writable.write(new Blob([content],{type}));await writable.close();return fileHandle;
}

async function ensureProjectFolders(handle){const structure={input:['photos','pdf','musicxml','text'],working:['photos','layout','recognition','review','draft'],output:['musicxml','pdf','images','reports']};for(const [root,children] of Object.entries(structure)){const directory=await handle.getDirectoryHandle(root,{create:true});for(const child of children)await directory.getDirectoryHandle(child,{create:true});}}

const sourceFolders={Photo:'photos',PDF:'pdf',MusicXML:'musicxml',Text:'text'};

async function materializePendingProject(){
  if(projectSession.handle)return projectSession.handle;
  if(!projectSession.parentHandle||!projectSession.name)throw new Error('Choose a project parent folder before adding the first input.');
  const handle=await projectSession.parentHandle.getDirectoryHandle(projectSession.name,{create:true});
  await ensureProjectFolders(handle);
  await writeProjectFile(handle,'hymn-project.json',JSON.stringify({schemaVersion:1,name:projectSession.name,createdAt:new Date().toISOString(),inputs:[],stage:'new'},null,2)+'\n');
  projectSession.handle=handle;
  return handle;
}

async function copySourceIntoProject(file,kind){const projectHandle=await materializePendingProject();const folder=sourceFolders[kind]||'text',input=await projectHandle.getDirectoryHandle('input',{create:true}),directory=await input.getDirectoryHandle(folder,{create:true}),fileHandle=await projectFileHandle(directory,file.name,{confirmReplace:true});if(!fileHandle)return null;const writable=await fileHandle.createWritable();await writable.write(file);await writable.close();return fileHandle;}

async function discoverProjectInputs(handle){
  const input=await handle.getDirectoryHandle('input',{create:true}),sources=[],kindForName=name=>{const extension=name.split('.').pop()?.toLowerCase();if(['png','jpg','jpeg','tif','tiff','webp','heic','heif'].includes(extension))return'Photo';if(extension==='pdf')return'PDF';if(['musicxml','xml','mxl'].includes(extension))return'MusicXML';if(['txt','md','rtf'].includes(extension))return'Text';return null;};
  async function scan(directory,prefix){for await(const entry of directory.values()){const path=`${prefix}/${entry.name}`;if(entry.kind==='directory')await scan(entry,path);else{const kind=kindForName(entry.name);if(kind)sources.push({name:entry.name,kind,path,handle:entry});}}}
  await scan(input,'input');
  return sources.sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name));
}

function manifestSources(){return projectSession.sources.map(({name,kind,path})=>({name,kind,path:path||`input/${sourceFolders[kind]||'text'}/${name}`}));}

function sendPhotoToPreparation(file,{markDirty=true,sourcePath=null}={}){projectSession.preparationSourcePath=sourcePath;showMajorTab('source');showSourcePanel('preparation');const frame=$('#photo-cleaner-frame'),send=()=>frame.contentWindow?.postMessage({type:'hymn-photo-load',file,markDirty},location.origin);if(frame.contentDocument?.readyState==='complete')send();else frame.addEventListener('load',send,{once:true});}

async function showActivePhotoPreparation(){const source=projectSession.sources.find(item=>item.path===projectSession.activeSource&&item.kind==='Photo');if(!source?.handle){showSourcePanel('preparation');return;}if(projectSession.preparationDirty&&projectSession.preparationSourcePath===source.path){showSourcePanel('preparation');return;}const working=projectSession.processing.activeInput===source.path?await currentWorkingImage():null;sendPhotoToPreparation(working||await source.handle.getFile(),{markDirty:!working,sourcePath:source.path});}

function requestPreparedPhoto(){return new Promise((resolve,reject)=>{const requestId=crypto.randomUUID(),timer=setTimeout(()=>{preparedPhotoRequests.delete(requestId);reject(new Error('Photo preparation did not respond.'));},30000);preparedPhotoRequests.set(requestId,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});$('#photo-cleaner-frame').contentWindow?.postMessage({type:'hymn-photo-get-prepared',requestId},location.origin);});}

async function savePreparedPhotoFiles(payload){
  if(!projectSession.handle)throw new Error('Open a project folder before saving prepared files.');
  if(projectSession.preparationSourcePath!==projectSession.activeSource)throw new Error('The displayed preview is not the photo chosen for processing. Select “Use this file” first.');
  const working=await projectSession.handle.getDirectoryHandle('working',{create:true}),photos=await working.getDirectoryHandle('photos',{create:true}),name=`${projectSession.name}-working.png`;let exists=false;
  try{await photos.getFileHandle(name);exists=true;}catch(error){if(error.name!=='NotFoundError')throw error;}
  if(exists&&!confirm(`${name} already exists. Replace it with the latest prepared image?`))return false;
  const changed=projectSession.preparationDirty||projectSession.processing.activeInput!==projectSession.activeSource;await writeProjectFile(photos,name,payload.cleaned,'image/png');projectSession.processing=changed?{...emptyProcessingState(),activeInput:projectSession.activeSource,workingImage:`working/photos/${name}`,preparation:{status:'complete',updatedAt:new Date().toISOString()}}:{...projectSession.processing,workingImage:`working/photos/${name}`,preparation:{status:'complete',updatedAt:new Date().toISOString()}};projectSession.preparationDirty=false;await saveProcessingState();updatePipelineAvailability();return true;
}

async function saveProcessingState(){if(!projectSession.handle)return;const working=await projectSession.handle.getDirectoryHandle('working',{create:true});await writeProjectFile(working,'workbench-state.json',JSON.stringify(projectSession.processing,null,2)+'\n');}

async function loadProcessingState(){if(!projectSession.handle)return;try{const working=await projectSession.handle.getDirectoryHandle('working'),file=await(await working.getFileHandle('workbench-state.json')).getFile(),saved=JSON.parse(await file.text());projectSession.processing={...emptyProcessingState(),...saved};if(saved.activeInput&&projectSession.sources.some(source=>source.path===saved.activeInput))projectSession.activeSource=saved.activeInput;}catch(error){if(error.name!=='NotFoundError')console.warn('Could not restore workbench state',error);}}

async function currentWorkingImage(){if(!projectSession.handle||!projectSession.processing.workingImage)return null;try{const working=await projectSession.handle.getDirectoryHandle('working'),photos=await working.getDirectoryHandle('photos'),handle=await photos.getFileHandle(projectSession.processing.workingImage.split('/').pop());return await handle.getFile();}catch{return null;}}

async function loadProjectEditorDraft(){
  if(!projectSession.handle)return false;
  try{
    const working=await projectSession.handle.getDirectoryHandle('working'),draft=await working.getDirectoryHandle('draft'),handle=await draft.getFileHandle(`${projectSession.name}-working.musicxml`),file=await handle.getFile();
    await loadMusicXmlFile(file);
    projectSession.savedSnapshot=snapshot();
    return true;
  }catch(error){
    if(error.name!=='NotFoundError')console.warn('Could not restore the saved Hymn Editor working file',error);
    return false;
  }
}

window.addEventListener('message',async event=>{
  if(event.source!==$('#photo-cleaner-frame').contentWindow||event.origin!==location.origin)return;
  if(event.data?.type==='hymn-ui-zoom'){changeUiZoom(event.data.direction);return;}
  if(event.data?.type==='hymn-photo-dirty'){projectSession.preparationDirty=true;projectSession.processing.layout={status:'stale',updatedAt:projectSession.processing.layout.updatedAt,data:projectSession.processing.layout.data};projectSession.processing.recognition={status:'stale',updatedAt:projectSession.processing.recognition.updatedAt};projectSession.processing.review={status:'stale',updatedAt:projectSession.processing.review.updatedAt};updatePipelineAvailability();updateUnsavedIndicator();return;}
  if(event.data?.type==='hymn-photo-prepared-error'){const pending=preparedPhotoRequests.get(event.data.requestId);if(pending){preparedPhotoRequests.delete(event.data.requestId);pending.reject(new Error(event.data.message));}return;}
  if(event.data?.type!=='hymn-photo-prepared')return;
  const pending=preparedPhotoRequests.get(event.data.requestId);if(pending){preparedPhotoRequests.delete(event.data.requestId);pending.resolve(event.data);return;}
  try{const saved=await savePreparedPhotoFiles(event.data);event.source.postMessage({type:'hymn-photo-save-result',message:saved?'Saved the latest working image in working/photos.':'Save cancelled; the existing working image was not changed.'},location.origin);}catch(error){event.source.postMessage({type:'hymn-photo-save-result',message:`Could not save the working image: ${error.message}`},location.origin);}
});

async function openProjectSource(source,{select=false}={}){
  if(!source.handle){alert(`${source.name} is listed in the older project manifest but was not found in its input folder.`);return;}
  const file=await source.handle.getFile();if(select){const changed=projectSession.activeSource!==source.path;projectSession.activeSource=source.path;projectSession.requiresInitialInput=false;projectSession.addControlsVisible=false;if($('#project-input-dialog').open)$('#project-input-dialog').close();setProjectWorkspaceVisible(true);if(changed&&source.kind==='Photo'){staffPhotoReviewData=null;state.staffPhoto=null;$('#staff-photo-editor-result').classList.add('hidden');$('#recognize-source-content').disabled=true;$('#review-recognition').disabled=true;$('#staff-photo-status').textContent=`${source.name} is chosen. Extract its staff layout when ready.`;}refreshSourceFileList();}
  if(source.kind==='MusicXML'){await loadMusicXmlFile(file);showMajorTab('editor');return;}
  if(source.kind==='Photo'){sendPhotoToPreparation(file,{sourcePath:source.path});return;}
  showMajorTab('source');showSourcePanel('document');$('#document-source-title').textContent=source.name;
  $('#document-source-description').textContent=source.kind==='PDF'?'PDF reference · available only in Source Processing.':'Text reference · available only in Source Processing.';
  if(sourcePreviewUrl){URL.revokeObjectURL(sourcePreviewUrl);sourcePreviewUrl=null;}
  $('#pdf-source-preview').classList.toggle('hidden',source.kind!=='PDF');$('#text-source-preview').classList.toggle('hidden',source.kind!=='Text');
  if(source.kind==='PDF'){sourcePreviewUrl=URL.createObjectURL(file);$('#pdf-source-preview').src=sourcePreviewUrl;}else $('#text-source-preview').textContent=await file.text();
}

async function createProjectFromDialog(event) {
  event.preventDefault(); const input=$('#new-project-name'),name=input.value.trim();
  if(!/^[A-Za-z0-9_-]+$/.test(name)){input.setCustomValidity('Use letters, numbers, hyphens, or underscores.');input.reportValidity();return;} input.setCustomValidity('');
  let parentHandle=null;
  try {
    if(window.showDirectoryPicker){parentHandle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});try{await parentHandle.getDirectoryHandle(name);alert(`${name} already exists in that folder. Open the existing project or choose a different project name.`);return;}catch(error){if(error.name!=='NotFoundError')throw error;}}
    activateProject(name,{parentHandle,requiresInitialInput:true}); $('#new-project-dialog').close();showProjectInputDialog();
  } catch(error){if(error.name!=='AbortError')alert(`Could not create the project folder: ${error.message}`);}
}

async function openProjectFolder() {
  try {
    if(!window.showDirectoryPicker){const name=prompt('Project folder name','Hymn-001');if(name)activateProject(name);return;}
    const handle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});let name=handle.name;
    let manifest;
    try{const manifestHandle=await handle.getFileHandle('hymn-project.json');manifest=JSON.parse(await (await manifestHandle.getFile()).text());name=manifest.name||name;}catch{alert('This folder does not contain hymn-project.json.');return;}
    await ensureProjectFolders(handle);
    activateProject(name,{handle});
    const discovered=await discoverProjectInputs(handle);
    projectSession.sources=discovered.length?discovered:(Array.isArray(manifest.inputs)?manifest.inputs:[]);
    projectSession.activeSource=manifest.activeInput&&projectSession.sources.some(source=>source.path===manifest.activeInput)?manifest.activeInput:null;
    await loadProcessingState();
    if(!projectSession.activeSource&&projectSession.sources.length===1)projectSession.activeSource=projectSession.sources[0].path;
    projectSession.requiresInitialInput=projectSession.sources.length===0;
    projectSession.addControlsVisible=projectSession.requiresInitialInput;
    projectSession.savedSources=structuredClone(manifestSources());
    setProjectWorkspaceVisible(!projectSession.requiresInitialInput);
    refreshSourceFileList();
    if(projectSession.requiresInitialInput){showProjectInputDialog();return;}
    const active=projectSession.sources.find(source=>source.path===projectSession.activeSource);
    if(!active){showMajorTab('source');return;}
    if(active.kind==='Photo')await showActivePhotoPreparation();else await openProjectSource(active);
    const restoredEditor=await loadProjectEditorDraft();
    if(restoredEditor&&manifest.stage==='editor-working')showMajorTab('editor');
  } catch(error){if(error.name!=='AbortError')alert(`Could not open the project: ${error.message}`);}
}

function refreshSourceFileList(){
  updateUnsavedIndicator();
  const list=$('#source-file-list'),has=kind=>projectSession.sources.some(source=>source.kind===kind);
  const active=projectSession.sources.find(source=>source.path===projectSession.activeSource),activeCard=$('#source-active-file');activeCard.innerHTML=active?`<small>Selected input</small><strong>${escapeHtml(active.name)} · ${escapeHtml(active.kind)}</strong>`:'<small>Selected input</small><strong>None selected</strong>';
  $('#initial-input-prompt').classList.toggle('hidden',!projectSession.requiresInitialInput);document.querySelector('.major-tab[data-major-tab="editor"]').disabled=projectSession.requiresInitialInput;
  updatePipelineAvailability();
  $('#source-photo-action').textContent=has('Photo')?'Add another photo':'Add photo';$('#source-musicxml-action').textContent=has('MusicXML')?'Add another MusicXML':'Add MusicXML';$('#source-reference-action').textContent=has('PDF')||has('Text')?'Add another PDF or text':'Add PDF or text';
  const candidates=projectSession.sources.filter(source=>source.path!==projectSession.activeSource);if(!candidates.length){list.replaceChildren(Object.assign(document.createElement('span'),{textContent:'No other project inputs.'}));return;}
  list.replaceChildren(...candidates.map(source=>{const row=document.createElement('div');row.className='source-file-row';const label=document.createElement('span');label.textContent=`${source.name} · ${source.kind}`;row.append(label);return row;}));
}

function showChangeInputDialog(){
  const candidates=projectSession.sources.filter(source=>source.path!==projectSession.activeSource&&source.handle);
  if(!candidates.length){alert('There are no other project inputs yet. Use Add Input to add another photo, MusicXML, PDF, or text file.');return;}
  const select=$('#change-input-selection');select.replaceChildren(...candidates.map(source=>Object.assign(document.createElement('option'),{value:source.path,textContent:`${source.name} · ${source.kind}`})));
  $('#change-input-dialog').showModal();
}

function showDeleteInputDialog(){
  if(projectSession.sources.length<=1){alert('The project’s only original input cannot be deleted. Add another input first.');return;}
  const candidates=projectSession.sources.filter(source=>source.path!==projectSession.activeSource&&source.handle);
  if(!candidates.length){alert('The currently open input cannot be deleted. Change Input first.');return;}
  $('#delete-input-selection').replaceChildren(...candidates.map(source=>Object.assign(document.createElement('option'),{value:source.path,textContent:`${source.name} · ${source.kind}`})));
  $('#delete-input-confirmation').checked=false;$('#delete-input-dialog').showModal();
}

async function deleteSelectedInput(){
  const path=$('#delete-input-selection').value,source=projectSession.sources.find(item=>item.path===path);
  if(!source||source.path===projectSession.activeSource||projectSession.sources.length<=1||!$('#delete-input-confirmation').checked){alert('Choose an inactive input and confirm its deletion.');return;}
  const parts=source.path.split('/'),filename=parts.pop();let directory=projectSession.handle;for(const part of parts)directory=await directory.getDirectoryHandle(part);await directory.removeEntry(filename);
  projectSession.sources=projectSession.sources.filter(item=>item.path!==path);projectSession.savedSources=projectSession.savedSources.filter(item=>item.path!==path);
  const manifest={schemaVersion:1,name:projectSession.name,savedAt:new Date().toISOString(),inputs:manifestSources(),activeInput:projectSession.activeSource,stage:state.xml?'editor-working':'source-processing'};await writeProjectFile(projectSession.handle,'hymn-project.json',JSON.stringify(manifest,null,2)+'\n');
  $('#delete-input-dialog').close();refreshSourceFileList();
}

function updatePipelineAvailability(){const active=projectSession.sources.find(source=>source.path===projectSession.activeSource),matching=projectSession.processing.activeInput===projectSession.activeSource;$('#extract-staff-layout').disabled=active?.kind!=='Photo'||(!active.handle&&!matching)||(!projectSession.preparationDirty&&projectSession.processing.preparation.status!=='complete'&&!active.handle);$('#recognize-source-content').disabled=!(matching&&projectSession.processing.layout.status==='accepted');$('#review-recognition').disabled=!(matching&&projectSession.processing.recognition.status==='complete');}

async function extractChosenStaffLayout(){
  const source=projectSession.sources.find(item=>item.path===projectSession.activeSource&&item.kind==='Photo');
  if(!source?.handle){alert('Choose a photo with “Use this file” before extracting its staff layout.');return;}
  let workingFile;if(projectSession.preparationDirty&&projectSession.preparationSourcePath===projectSession.activeSource){const prepared=await requestPreparedPhoto(),saved=await savePreparedPhotoFiles(prepared);if(!saved)return;workingFile=new File([prepared.cleaned],`${projectSession.name}-working.png`,{type:'image/png'});}else workingFile=await currentWorkingImage();
  if(!workingFile){alert('Open Photo Preparation and save the current working image before extracting its layout.');return;}
  selectPipelineOperation('extract-staff-layout');$('#source-stage-title').textContent='Staff layout extraction';$('#source-stage-description').textContent='Quality decisions, page-layout confidence, staff lines, and boundaries appear here.';showMajorTab('source');showSourcePanel('recognition');await loadStaffPhoto(workingFile);
}

async function saveProjectSession() {
  const active=projectSession.sources.find(source=>source.path===projectSession.activeSource);
  if(active?.kind==='Photo'&&projectSession.preparationDirty&&projectSession.preparationSourcePath===projectSession.activeSource){const prepared=await requestPreparedPhoto(),saved=await savePreparedPhotoFiles(prepared);if(!saved)return false;}
  let savedEditorPath='',savedOutputPath='',savedReviewPath='';
  if(state.xml){
    if(!projectSession.handle)throw new Error('The project folder is not available. Reopen the project and save again.');
    const working=await projectSession.handle.getDirectoryHandle('working',{create:true}),draft=await working.getDirectoryHandle('draft',{create:true}),draftName=`${projectSession.name}-working.musicxml`;
    const saved=await writeProjectFile(draft,draftName,revisedXml(),'application/vnd.recordare.musicxml+xml',{confirmReplace:true});
    if(!saved){$('#status').textContent='Save cancelled; the existing project working MusicXML was not changed.';return false;}
    savedEditorPath=`working/draft/${draftName}`;
    const output=await projectSession.handle.getDirectoryHandle('output',{create:true}),musicxml=await output.getDirectoryHandle('musicxml',{create:true}),reports=await output.getDirectoryHandle('reports',{create:true});
    const outputName=`${projectSession.name}-revised.musicxml`,reviewName=`${projectSession.name}-alignment.json`;
    await writeProjectFile(musicxml,outputName,revisedXml(),'application/vnd.recordare.musicxml+xml');
    await writeProjectFile(reports,reviewName,JSON.stringify(reviewPayload(),null,2)+'\n','application/json');
    savedOutputPath=`output/musicxml/${outputName}`;savedReviewPath=`output/reports/${reviewName}`;
  }
  await saveProcessingState();
  if(projectSession.handle){const manifest={schemaVersion:1,name:projectSession.name,savedAt:new Date().toISOString(),inputs:manifestSources(),activeInput:projectSession.activeSource,stage:state.xml?'editor-working':'source-processing'};await writeProjectFile(projectSession.handle,'hymn-project.json',JSON.stringify(manifest,null,2)+'\n');}
  projectSession.savedSnapshot=state.xml?snapshot():null; projectSession.savedSources=structuredClone(manifestSources());state.history=[];state.future=[];updateUnsavedIndicator();
  $('#status').textContent=savedEditorPath?`Saved ${savedEditorPath}, ${savedOutputPath}, and ${savedReviewPath}.`:'Project source-processing state saved.';
  return true;
}

async function chooseProjectToDelete(){
  if(!window.showDirectoryPicker){alert('This browser cannot choose and delete project folders.');return;}
  try{deleteParentHandle=await window.showDirectoryPicker({mode:'readwrite',startIn:'documents'});deleteProjectTargets=new Map();
    let selectedFolderIsProject=false;try{await deleteParentHandle.getFileHandle('hymn-project.json');selectedFolderIsProject=true;}catch{}
    if(selectedFolderIsProject)deleteProjectTargets.set(deleteParentHandle.name,{handle:deleteParentHandle,name:deleteParentHandle.name,direct:true});
    async function scan(directory,prefix='',depth=0){if(depth>4)return;for await(const entry of directory.values())if(entry.kind==='directory'){const path=prefix?`${prefix}/${entry.name}`:entry.name;let isProject=false;try{await entry.getFileHandle('hymn-project.json');isProject=true;}catch{}if(isProject)deleteProjectTargets.set(path,{parent:directory,handle:entry,name:entry.name});else await scan(entry,path,depth+1);}}
    if(!selectedFolderIsProject)await scan(deleteParentHandle);
    const projects=[...deleteProjectTargets.keys()].sort();if(!projects.length){alert('No Hymn Workbench projects were found. Choose either an individual hymn project folder or the collection folder that contains your hymn projects.');return;}
    const plural=projects.length>1;$('#delete-project-title').textContent=plural?'Delete Projects':'Delete Project';$('#delete-project-message').textContent=plural?`The selected folder contains ${projects.length} hymn projects. Continuing will permanently delete all of the hymn projects listed below. The selected collection folder and unrelated files will remain.`:'Continuing will permanently delete the hymn project listed below, including its input, working, and output files.';$('#delete-project-list').replaceChildren(...projects.map(path=>Object.assign(document.createElement('div'),{textContent:path})));$('#delete-project-confirmation-text').textContent=plural?'I understand that all listed hymn projects will be permanently deleted.':'I understand that the listed hymn project will be permanently deleted.';$('#confirm-project-delete').textContent=plural?`Delete All ${projects.length} Projects`:'Delete Project';$('#delete-project-confirmation').checked=false;$('#delete-project-dialog').showModal();
  }catch(error){if(error.name!=='AbortError')alert(`Could not inspect that folder: ${error.message}`);}
}

async function deleteProjectSession(){const targets=[...deleteProjectTargets.values()];if(!targets.length||!$('#delete-project-confirmation').checked){alert('Confirm permanent deletion of the listed hymn project or projects.');return;}const direct=targets.find(target=>target.direct&&typeof target.handle.remove!=='function');if(direct)throw new Error('This browser cannot delete a directly selected folder. Select its project collection folder instead.');let deletingOpenProject=false;for(const target of targets){if(projectSession.handle){try{deletingOpenProject=deletingOpenProject||await target.handle.isSameEntry(projectSession.handle);}catch{deletingOpenProject=deletingOpenProject||target.name===projectSession.name;}}if(target.direct)await target.handle.remove({recursive:true});else await target.parent.removeEntry(target.name,{recursive:true});}$('#delete-project-dialog').close();if(deletingOpenProject)location.reload();}

async function loadMusicXmlFile(file) {
  if (!file) return;
  const xml = new DOMParser().parseFromString(await file.text(), 'application/xml');
  if (xml.querySelector('parsererror') || !xml.querySelector('score-partwise')) { $('#file-summary').textContent = 'This is not valid partwise MusicXML.'; return; }
  Object.assign(state, { xml, filename: file.name, ...parseScore(xml), history: [], future: [], selectedTokenId: null, shiftAnchorTokenId: null, selectedEventId: null });
  loadExistingAssignments(); loadEmbeddedStaffLayer(); reflectImportedScore(file.name); const [key] = KEYS[state.fifths] || KEYS[0];
  const restoredMissingLyrics = await fillMissingImportedLyrics();
  const restoredChineseAlignment = restoreChineseAlignmentIfMissing();
  $('#key-label').textContent = `1 = ${key}`; $('#file-summary').textContent = `${file.name} · ${state.measures.length} measures · ${state.events.length} melody events · 1 = ${key}`;
  $('#editor').classList.remove('hidden'); render();
  if (restoredMissingLyrics || restoredChineseAlignment) $('#status').textContent = `${restoredMissingLyrics ? 'Missing Chinese or English text was restored from the Hymn Display database. ' : ''}${restoredChineseAlignment ? 'Chinese lyrics were aligned to the existing Jianpu. ' : ''}Save the working copy again to preserve the restored layers.`;
}
$('#file-input').addEventListener('change', event => loadMusicXmlFile(event.target.files[0]));
$('#source-musicxml-input').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const handle=await copySourceIntoProject(file,'MusicXML');if(!handle)return;const source={name:file.name,kind:'MusicXML',path:`input/musicxml/${file.name}`,handle};projectSession.sources.push(source);await openProjectSource(source,{select:true});}catch(error){alert(`Could not add ${file.name}: ${error.message}`);}});
$('#source-reference-input').addEventListener('change',async event=>{let firstAdded=null;for(const file of event.target.files){const kind=file.type==='application/pdf'?'PDF':'Text';try{const handle=await copySourceIntoProject(file,kind);if(!handle)continue;const source={name:file.name,kind,path:`input/${sourceFolders[kind]}/${file.name}`,handle};projectSession.sources.push(source);firstAdded||=source;}catch(error){alert(`Could not add ${file.name}: ${error.message}`);}}refreshSourceFileList();if(firstAdded)await openProjectSource(firstAdded,{select:projectSession.requiresInitialInput});});
$('#source-photo-input').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{const handle=await copySourceIntoProject(file,'Photo');if(!handle)return;const existing=projectSession.sources.find(source=>source.name===file.name&&source.kind==='Photo'),source=existing||{name:file.name,kind:'Photo'};Object.assign(source,{handle,path:`input/photos/${file.name}`});if(!existing)projectSession.sources.push(source);await openProjectSource(source,{select:true});}catch(error){alert(`Could not add ${file.name}: ${error.message}`);}});
$('#prepare-photo').addEventListener('click',()=>showActivePhotoPreparation().catch(error=>alert(`Could not open Photo Preparation: ${error.message}`)));
$('#confirm-change-input').addEventListener('click',async()=>{const source=projectSession.sources.find(item=>item.path===$('#change-input-selection').value);if(!source)return;try{await openProjectSource(source,{select:true});$('#change-input-dialog').close();}catch(error){alert(`Could not change input: ${error.message}`);}});
$('#extract-staff-layout').addEventListener('click',()=>extractChosenStaffLayout().catch(error=>alert(`Could not extract the staff layout: ${error.message}`)));
$('#recognize-source-content').addEventListener('click',()=>{selectPipelineOperation('recognize-source-content');$('#source-stage-title').textContent='Source-content recognition';$('#source-stage-description').textContent='Recognition results, confidence, and warnings will appear here.';showSourcePanel('recognition');const review=$('#source-recognition-summary');review.classList.add('has-result');review.innerHTML='<strong>Staff layout accepted; symbol recognition is ready</strong><span>The symbol-recognition engine is the next implementation stage. No notes, lyrics, or other symbols have been inferred or written yet.</span>';});
document.querySelectorAll('.major-tab').forEach(button=>button.addEventListener('click',()=>showMajorTab(button.dataset.majorTab)));
$('#new-project').addEventListener('click',()=>$('#new-project-dialog').showModal());
$('#open-project').addEventListener('click',openProjectFolder);
$('#delete-project-launcher').addEventListener('click',chooseProjectToDelete);
$('#create-project').addEventListener('click',createProjectFromDialog);
$('#project-add-input').addEventListener('click',showProjectInputDialog);
$('#project-change-input').addEventListener('click',showChangeInputDialog);
$('#project-delete-input').addEventListener('click',showDeleteInputDialog);
$('#confirm-delete-input').addEventListener('click',()=>deleteSelectedInput().catch(error=>alert(`Could not delete the input: ${error.message}`)));
$('#project-input-dialog').addEventListener('cancel',event=>{if(projectSession.requiresInitialInput)event.preventDefault();});
$('#project-save').addEventListener('click',async()=>{const button=$('#project-save');button.disabled=true;try{await saveProjectSession();}catch(error){alert(`Could not save the project: ${error.message}`);}finally{button.disabled=false;}});
$('#project-quit').addEventListener('click',()=>{
  const hasUnsavedWork=projectHasUnsavedWork();
  if(hasUnsavedWork&&!confirm('Close this project and return to Open Project / New Project? Any work not saved in the project manifest or working copy will be discarded.'))return;
  location.reload();
});
$('#confirm-project-delete').addEventListener('click',()=>deleteProjectSession().catch(error=>alert(`Could not delete the project: ${error.message}`)));
$('#start-entry-button').addEventListener('click', () => { $('#editor').classList.remove('hidden'); $('#jianpu-input').focus(); });
$('#load-hymn-button').addEventListener('click', loadHymnFromDisplay);
$('#hymn-verse').addEventListener('change', fillSelectedHymnLyrics);
loadHymnCatalog();
$('#apply-jianpu-button').addEventListener('click', updateNotationPreviewFromJianpu);
$('#jianpu-input').addEventListener('input', updateJianpuPairCheck);
updateJianpuPairCheck();
$('#prepare-english-button').addEventListener('click', prepareEnglishSyllables);
$('#show-staff-regions').addEventListener('change',drawStaffPhotoReview);
$('#accept-staff-photo').addEventListener('click',acceptStaffPhoto);
$('#generate-soprano-button').addEventListener('click', generateSopranoFromJianpu);
$('#apply-staff-operation').addEventListener('click', applyStaffOperation);
$('#beam-staff-notes').addEventListener('click', () => beginStaffBeamOperation('beam'));
$('#unbeam-staff-notes').addEventListener('click', () => beginStaffBeamOperation('unbeam'));
for (const clef of ['treble', 'bass']) $(`#staff-${clef}-register`).addEventListener('change', event => {
  recordChange(); state.staffRegisters[clef] = Number(event.target.value);
  $('#status').textContent = `${clef === 'treble' ? 'Treble' : 'Bass'} staff now shows the ${event.target.selectedOptions[0].textContent.toLowerCase()}. Existing pitches were not transposed.`;
  render();
});
document.querySelectorAll('.language-tab').forEach(tab => tab.addEventListener('click', () => { state.activeLanguage = tab.dataset.language; state.staffBeamMode = null; state.staffBeamStartId = null; state.selectedTokenId = null; state.shiftAnchorTokenId = null; render(); }));
$('#photo-conflict-popover').addEventListener('mouseenter', () => clearTimeout(photoConflictHideTimer));
$('#photo-conflict-popover').addEventListener('mouseleave', () => { photoConflictHideTimer = setTimeout(() => hidePhotoConflictPopover(), 180); });
document.addEventListener('click', event => { if (!event.target.closest('.photo-conflict-popover,.photo-conflict-indicator')) hidePhotoConflictPopover(true); });
$('#workspace-undo-button').addEventListener('click', undo);
$('#workspace-redo-button').addEventListener('click', redo);
$('#duration-select').addEventListener('change', event => setDuration(Number(event.target.value)));
$('#insert-rest-button').addEventListener('click', insertRest);
$('#split-with-rest-button').addEventListener('click', splitWithRestAfter);
$('#continuation-to-rest-button').addEventListener('click', continuationToRest);
$('#tie-button').addEventListener('click', toggleTie);
$('#move-first-note-left').addEventListener('click', () => adjustFirstNotePosition(-4));
$('#center-first-note').addEventListener('click', () => adjustFirstNotePosition(0, true));
$('#move-first-note-right').addEventListener('click', () => adjustFirstNotePosition(4));
$('#operation-layer').addEventListener('change', updateGenericControls);
$('#symbol-operation').addEventListener('change', updateGenericControls);
$('#apply-symbol-operation').addEventListener('click', applyGenericOperation);
updateGenericControls();
const keySignaturePicker = setupKeySignaturePicker();
$('#measure-width-slider').addEventListener('input', () => {
  state.measureWidths.clear(); allMeasureWidthChanging = false; $('#all-measure-width-value').textContent = 'Default'; $('#all-measure-width-slider').value = $('#measure-width-slider').value;
  applySpacing(Number($('#measure-width-slider').value), Number($('#symbol-width-slider').value)); if (state.measures.length) render();
});
$('#symbol-width-slider').addEventListener('input', () => { applySpacing(Number($('#measure-width-slider').value), Number($('#symbol-width-slider').value)); if (state.measures.length) render(); });
$('#measures-per-line').addEventListener('change', () => { applySpacing(Number($('#measure-width-slider').value), Number($('#symbol-width-slider').value)); if (state.measures.length) render(); });
$('#reset-spacing-button').addEventListener('click', () => {
  if (state.measureWidths.size) recordChange();
  state.measureWidths.clear(); allMeasureWidthChanging = false;
  $('#measure-width-slider').value = '320'; $('#all-measure-width-slider').value = '320'; $('#all-measure-width-value').textContent = 'Default';
  $('#symbol-width-slider').value = '56'; $('#measures-per-line').value = 'auto'; state.containerSize = null; $('.workspace').style.width = ''; $('.workspace').style.height = '';
  applySpacing(320, 56, 'auto');
  if (state.measures.length) render();
  $('#status').textContent = 'Spacing reset, including all individual measure-window widths.';
});
$('#all-measure-width-slider').addEventListener('input', event => { applyAllMeasureWidths(Number(event.target.value)); if (state.measures.length) render(); });
$('#all-measure-width-slider').addEventListener('change', () => { allMeasureWidthChanging = false; render(); });
loadSpacing();
new ResizeObserver(entries => {
  const workspace = entries[0]?.target; positionWorkspaceResizeHandle();
  if (!workspace?.style.width && !workspace?.style.height) return;
  const box = workspace.getBoundingClientRect(); state.containerSize = { width: Math.round(box.width), height: Math.round(box.height) };
  if (state.measures.length) scheduleStaffRealignment();
}).observe($('.workspace'));
function resizeWorkspaceTo(width, height) {
  applyContainerSize({ width, height });
  if (state.measures.length) scheduleStaffRealignment();
  requestAnimationFrame(positionWorkspaceResizeHandle);
}
const workspaceResizeHandle = $('#workspace-resize-handle');
// Keep the fixed control outside the Editor's overflow clipping boundary.
document.body.append(workspaceResizeHandle);
function positionWorkspaceResizeHandle() {
  const editor = $('#editor'), workspace = $('.workspace');
  if (!editor || !workspace || editor.classList.contains('hidden')) { workspaceResizeHandle.hidden = true; return; }
  const editorBox = editor.getBoundingClientRect(), workspaceBox = workspace.getBoundingClientRect();
  const visibleRight = Math.min(workspaceBox.right, editorBox.right, window.innerWidth);
  const visibleBottom = Math.min(workspaceBox.bottom, window.innerHeight);
  const visibleLeft = Math.max(workspaceBox.left, editorBox.left, 0), visibleTop = Math.max(workspaceBox.top, 0);
  const renderedHandleSize = 28 * uiZoom, renderedInset = 4 * uiZoom;
  workspaceResizeHandle.hidden = visibleRight - visibleLeft < renderedHandleSize || visibleBottom - visibleTop < renderedHandleSize;
  if (workspaceResizeHandle.hidden) return;
  workspaceResizeHandle.style.left = `${(visibleRight - renderedHandleSize - renderedInset) / uiZoom}px`;
  workspaceResizeHandle.style.top = `${(visibleBottom - renderedHandleSize - renderedInset) / uiZoom}px`;
}
workspaceResizeHandle.addEventListener('pointerdown', event => {
  event.preventDefault();
  const workspace = $('.workspace');
  const start = { x: event.clientX, y: event.clientY, width: workspace.offsetWidth, height: workspace.offsetHeight };
  workspaceResizeHandle.setPointerCapture(event.pointerId);
  const move = pointer => resizeWorkspaceTo(start.width + (pointer.clientX - start.x) / uiZoom, start.height + (pointer.clientY - start.y) / uiZoom);
  const finish = pointer => {
    workspaceResizeHandle.removeEventListener('pointermove', move);
    workspaceResizeHandle.removeEventListener('pointerup', finish);
    workspaceResizeHandle.removeEventListener('pointercancel', finish);
    if (workspaceResizeHandle.hasPointerCapture(pointer.pointerId)) workspaceResizeHandle.releasePointerCapture(pointer.pointerId);
  };
  workspaceResizeHandle.addEventListener('pointermove', move);
  workspaceResizeHandle.addEventListener('pointerup', finish);
  workspaceResizeHandle.addEventListener('pointercancel', finish);
});
workspaceResizeHandle.addEventListener('keydown', event => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const workspace = $('.workspace'), step = event.shiftKey ? 50 : 10;
  resizeWorkspaceTo(workspace.offsetWidth + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), workspace.offsetHeight + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0));
});
$('#editor').addEventListener('scroll', positionWorkspaceResizeHandle, { passive:true });
window.addEventListener('scroll', positionWorkspaceResizeHandle, { passive:true });
window.addEventListener('resize', () => { scheduleStaffRealignment(); positionWorkspaceResizeHandle(); });
requestAnimationFrame(positionWorkspaceResizeHandle);
document.addEventListener('keydown', event => {
  if (state.activeLanguage !== '2' || !state.selectedStaffNoteId || !['Delete', 'Backspace'].includes(event.key) || event.target.matches('input, textarea, select, [contenteditable]')) return;
  const note = selectedStaffNote(); if (!note) return; event.preventDefault(); recordChange(); removeStaffNote(note); $('#status').textContent = 'Selected staff note deleted.'; render();
});
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'z') return;
  if (event.target.matches('textarea, input, [contenteditable]')) return;
  event.preventDefault();
  event.shiftKey ? redo() : undo();
});
