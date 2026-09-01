export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];

export function measureCapacityInQuarterNotes(beats, beatType) {
  return Number(beats) * 4 / Number(beatType);
}

export function pickupDurationInQuarterNotes(count, noteValue) {
  return Number(count) * Number(noteValue);
}

export function validatePickupDuration(count, noteValue, beats, beatType) {
  const duration = pickupDurationInQuarterNotes(count, noteValue);
  const capacity = measureCapacityInQuarterNotes(beats, beatType);
  if (!Number.isFinite(duration) || duration < 0 || !Number.isInteger(Number(count))) return { valid: false, duration, capacity, error: 'Pickup count must be a whole number of notes.' };
  if (duration >= capacity && duration > 0) return { valid: false, duration, capacity, error: 'A pickup must be shorter than one complete measure.' };
  return { valid: true, duration, capacity, error: '' };
}

export function pickupControlsForDuration(duration) {
  const total = Number(duration);
  if (!Number.isFinite(total) || total <= 0) return { noteValue: 1, count: 0 };
  for (const noteValue of [4, 2, 1, .5, .25]) {
    const count = total / noteValue;
    if (Number.isInteger(count) && count <= 12) return { noteValue, count };
  }
  return { noteValue: .25, count: Math.round(total / .25) };
}

export function jianpuDurationSuffix(duration) {
  const value = Number(duration);
  if (value === .25) return '//';
  if (value === .5) return '/';
  if (value === .75) return '/·';
  if (value === 1) return '';
  if (value === 1.5) return '·';
  if (Number.isInteger(value) && value >= 2 && value <= 4) return '−'.repeat(value - 1);
  throw new Error(`The ${value}-beat duration cannot be represented by the current Jianpu Direct-Entry Rules.`);
}

export function chooseChineseLyricAnchors(events, tokenCount) {
  const explicit = events.filter(event => !event.isRest && !event.slurStop);
  if (explicit.length === tokenCount) return { anchors: explicit, mode: 'note' };
  const connectedGroups = explicit.filter(event => !['continue', 'end'].includes(event.beam));
  if (connectedGroups.length === tokenCount) return { anchors: connectedGroups, mode: 'connected-group' };
  return { anchors: [], mode: 'mismatch', noteCount: explicit.length, connectedGroupCount: connectedGroups.length };
}

export function chooseStaffBeamRange(notes, startId, endId) {
  const start = notes.find(note => note.id === startId), end = notes.find(note => note.id === endId);
  if (!start || !end) return { members: [], error: 'Choose both the first and last staff note.' };
  if (start.voice !== end.voice) return { members: [], error: 'Beam Notes must start and end in the same voice.' };
  if (start.measure !== end.measure) return { members: [], error: 'Beam Notes cannot cross a barline. Beam one measure at a time.' };
  const voiceNotes = notes
    .filter(note => note.measure === start.measure && note.voice === start.voice)
    .toSorted((a, b) => a.onset - b.onset || a.id.localeCompare(b.id));
  const firstIndex = voiceNotes.findIndex(note => note.id === startId), lastIndex = voiceNotes.findIndex(note => note.id === endId);
  const low = Math.min(firstIndex, lastIndex), high = Math.max(firstIndex, lastIndex);
  const members = voiceNotes.slice(low, high + 1);
  if (members.length < 2) return { members: [], error: 'Choose two or more staff notes to create a beam.' };
  if (members.some(note => note.rest)) return { members: [], error: 'A Beam Notes range cannot include a rest.' };
  if (members.some(note => Number(note.duration) >= 1)) return { members: [], error: 'Only eighth notes and shorter values can be beamed.' };
  for (let index = 1; index < members.length; index += 1) {
    const previous = members[index - 1], current = members[index];
    if (Math.abs(Number(previous.onset) + Number(previous.duration) - Number(current.onset)) > .001) {
      return { members: [], error: 'Beam Notes requires consecutive notes without a rhythmic gap.' };
    }
  }
  return { members, error: '' };
}

export function clampMeasureWidth(width) {
  return Math.max(120, Math.min(900, Math.round(Number(width) || 0)));
}

export function measureContentScale(width) {
  return Math.max(.65, Math.min(2, Number(width) / 320));
}

export function normalizeSpacingSettings(settings = {}) {
  const rawMeasureWidth = Number(settings.measureWidth), rawSymbolWidth = Number(settings.symbolWidth);
  const measureWidth = Math.max(120, Math.min(640, Math.round(Number.isFinite(rawMeasureWidth) && rawMeasureWidth > 0 ? rawMeasureWidth : 320)));
  const symbolWidth = Math.max(0, Math.min(100, Math.round(Number.isFinite(rawSymbolWidth) ? rawSymbolWidth : 56)));
  const measuresPerLine = ['1', '2', '3', '4', '5', '6'].includes(String(settings.measuresPerLine)) ? String(settings.measuresPerLine) : 'auto';
  return { measureWidth, symbolWidth, measuresPerLine };
}

export function measureCapacityMeter(expected, used, beatUnit = 1) {
  const capacity = Math.max(0, Number(expected) || 0), content = Math.max(0, Number(used) || 0), unit = Math.max(.001, Number(beatUnit) || 1);
  const scale = Math.max(capacity, unit), tolerance = .001;
  const status = content > capacity + tolerance ? 'over' : content < capacity - tolerance ? 'under' : 'complete';
  const dividers = [];
  const dividerLimit = status === 'over' ? content : capacity;
  for (let position = unit; position < dividerLimit - tolerance; position += unit) dividers.push(position / scale * 100);
  if (status === 'under' && content > tolerance && Math.abs(content / unit - Math.round(content / unit)) > tolerance) dividers.push(content / scale * 100);
  return {
    status,
    correctPercent: Math.min(content, capacity) / scale * 100,
    issueStartPercent: status === 'over' ? capacity / scale * 100 : content / scale * 100,
    issuePercent: Math.abs(content - capacity) / scale * 100,
    dividers: [...new Set(dividers.map(value => Number(value.toFixed(4))))].sort((a, b) => a - b),
  };
}

export function tokenizeChinese(text) {
  const tokens = [];
  for (const char of text.normalize('NFC')) {
    if (/\s/u.test(char)) continue;
    if (/[，。！？；：、,.!?;:]/u.test(char) && tokens.length) tokens.at(-1).text += char;
    else tokens.push({ text: char, syllabic: 'single' });
  }
  return tokens;
}

export function tokenizeEnglish(text) {
  const words = text.trim().split(/\s+/u).filter(Boolean);
  const tokens = [];
  for (const word of words) {
    const syllables = word.split('-').filter(Boolean);
    syllables.forEach((syllable, index) => {
      let syllabic = 'single';
      if (syllables.length > 1) syllabic = index === 0 ? 'begin' : index === syllables.length - 1 ? 'end' : 'middle';
      tokens.push({ text: syllable, syllabic });
    });
  }
  return tokens;
}

export function jianpuForMidi(midi, tonicPitchClass) {
  const relative = (midi - tonicPitchClass + 120) % 12;
  const choices = MAJOR_STEPS.map((pitch, index) => {
    let delta = relative - pitch;
    if (delta > 6) delta -= 12;
    if (delta < -6) delta += 12;
    return { distance: Math.abs(delta), delta, degree: index + 1 };
  }).sort((a, b) => a.distance - b.distance || a.degree - b.degree);
  const best = choices[0];
  return `${best.delta === 1 ? '#' : best.delta === -1 ? 'b' : ''}${best.degree}`;
}

export function jianpuForSpelledPitch(midi, tonicPitchClass, noteStep, tonicStep) {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const noteIndex = letters.indexOf(noteStep), tonicIndex = letters.indexOf(tonicStep);
  if (noteIndex < 0 || tonicIndex < 0) return jianpuForMidi(midi, tonicPitchClass);
  const degree = (noteIndex - tonicIndex + 7) % 7 + 1;
  const relative = (midi - tonicPitchClass + 120) % 12;
  let delta = relative - MAJOR_STEPS[degree - 1];
  if (delta > 6) delta -= 12;
  if (delta < -6) delta += 12;
  if (delta === 0) return String(degree);
  if (delta === 1) return `#${degree}`;
  if (delta === -1) return `b${degree}`;
  return jianpuForMidi(midi, tonicPitchClass);
}

export function durationClass(beats) {
  if (beats <= .25) return 'sixteenth';
  if (beats < 1) return 'eighth';
  if (beats === 1.5) return 'dotted';
  if (beats >= 2) return 'sustained';
  return 'quarter';
}

export function pitchFromMidi(midi, preferFlats = false) {
  const sharpNames = [['C', 0], ['C', 1], ['D', 0], ['D', 1], ['E', 0], ['F', 0], ['F', 1], ['G', 0], ['G', 1], ['A', 0], ['A', 1], ['B', 0]];
  const flatNames = [['C', 0], ['D', -1], ['D', 0], ['E', -1], ['E', 0], ['F', 0], ['G', -1], ['G', 0], ['A', -1], ['A', 0], ['B', -1], ['B', 0]];
  const [step, alter] = (preferFlats ? flatNames : sharpNames)[((midi % 12) + 12) % 12];
  return { step, alter, octave: Math.floor(midi / 12) - 1 };
}

export function musicXmlTypeForBeats(beats) {
  if (beats === 4) return { type: 'whole', dots: 0 };
  if (beats === 3) return { type: 'half', dots: 1 };
  if (beats === 2) return { type: 'half', dots: 0 };
  if (beats === 1.5) return { type: 'quarter', dots: 1 };
  if (beats === 1) return { type: 'quarter', dots: 0 };
  if (beats === .75) return { type: 'eighth', dots: 1 };
  if (beats === .5) return { type: 'eighth', dots: 0 };
  if (beats === .25) return { type: '16th', dots: 0 };
  return null;
}
