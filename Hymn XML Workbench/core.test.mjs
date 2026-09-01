import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseChineseLyricAnchors, chooseStaffBeamRange, clampMeasureWidth, durationClass, jianpuDurationSuffix, jianpuForMidi, jianpuForSpelledPitch, measureCapacityInQuarterNotes, measureCapacityMeter, measureContentScale, musicXmlTypeForBeats, normalizeSpacingSettings, pickupControlsForDuration, pickupDurationInQuarterNotes, pitchFromMidi, tokenizeChinese, tokenizeEnglish, validatePickupDuration } from './core.mjs';

test('Chinese punctuation stays with its preceding character', () => assert.deepEqual(tokenizeChinese('愛救了我！').map(x => x.text), ['愛','救','了','我！']));
test('English hyphens create syllabic roles', () => assert.deepEqual(tokenizeEnglish('Love lift-ed').map(x => [x.text,x.syllabic]), [['Love','single'],['lift','begin'],['ed','end']]));
test('Bb major pitch classes become movable-do degrees', () => { assert.equal(jianpuForMidi(65,10),'5'); assert.equal(jianpuForMidi(67,10),'6'); assert.equal(jianpuForMidi(64,10),'#4'); });
test('written chromatic spelling is preserved in jianpu', () => {
  assert.equal(jianpuForSpelledPitch(66, 0, 'F', 'C'), '#4');
  assert.equal(jianpuForSpelledPitch(70, 0, 'B', 'C'), 'b7');
  assert.equal(jianpuForSpelledPitch(63, 10, 'E', 'B'), '4');
});
test('rhythm classes are stable', () => { assert.equal(durationClass(.5),'eighth'); assert.equal(durationClass(1),'quarter'); assert.equal(durationClass(2),'sustained'); });
test('MIDI converts to writable MusicXML pitch spelling', () => {
  assert.deepEqual(pitchFromMidi(61), { step: 'C', alter: 1, octave: 4 });
  assert.deepEqual(pitchFromMidi(61, true), { step: 'D', alter: -1, octave: 4 });
});
test('beat lengths map to notation types', () => {
  assert.deepEqual(musicXmlTypeForBeats(1.5), { type: 'quarter', dots: 1 });
  assert.deepEqual(musicXmlTypeForBeats(.25), { type: '16th', dots: 0 });
});
test('time signatures convert to quarter-note capacity', () => {
  assert.equal(measureCapacityInQuarterNotes(4, 4), 4);
  assert.equal(measureCapacityInQuarterNotes(6, 8), 3);
  assert.equal(measureCapacityInQuarterNotes(2, 2), 4);
});
test('pickup duration uses an independent note value', () => {
  assert.equal(pickupDurationInQuarterNotes(3, .5), 1.5);
  assert.equal(validatePickupDuration(0, 1, 4, 4).valid, true);
  assert.equal(validatePickupDuration(1, 1, 4, 4).valid, true);
  assert.equal(validatePickupDuration(4, 1, 4, 4).valid, false);
  assert.equal(validatePickupDuration(6, .5, 6, 8).valid, false);
});
test('saved pickup duration maps back to editable controls', () => {
  assert.deepEqual(pickupControlsForDuration(0), { noteValue: 1, count: 0 });
  assert.deepEqual(pickupControlsForDuration(1), { noteValue: 1, count: 1 });
  assert.deepEqual(pickupControlsForDuration(1.5), { noteValue: .5, count: 3 });
  assert.deepEqual(pickupControlsForDuration(.75), { noteValue: .25, count: 3 });
});
test('MusicXML durations convert back to Direct-Entry suffixes', () => {
  assert.equal(jianpuDurationSuffix(.25), '//');
  assert.equal(jianpuDurationSuffix(.5), '/');
  assert.equal(jianpuDurationSuffix(.75), '/·');
  assert.equal(jianpuDurationSuffix(1), '');
  assert.equal(jianpuDurationSuffix(1.5), '·');
  assert.equal(jianpuDurationSuffix(3), '−−');
  assert.throws(() => jianpuDurationSuffix(1.25));
});
test('Chinese alignment can collapse connected underline groups when the counts match', () => {
  const events = [
    { id: '1', isRest: false, slurStop: false, beam: null },
    { id: '2', isRest: false, slurStop: false, beam: 'begin' },
    { id: '3', isRest: false, slurStop: false, beam: 'end' },
    { id: '4', isRest: false, slurStop: false, beam: null },
  ];
  assert.equal(chooseChineseLyricAnchors(events, 4).mode, 'note');
  assert.deepEqual(chooseChineseLyricAnchors(events, 3).anchors.map(event => event.id), ['1', '2', '4']);
  assert.equal(chooseChineseLyricAnchors(events, 2).mode, 'mismatch');
});
test('staff beam range includes consecutive notes between either endpoint order', () => {
  const notes = [
    { id: 'a', measure: 1, voice: 'S', onset: 0, duration: .5, rest: false },
    { id: 'b', measure: 1, voice: 'S', onset: .5, duration: .25, rest: false },
    { id: 'c', measure: 1, voice: 'S', onset: .75, duration: .25, rest: false },
  ];
  assert.deepEqual(chooseStaffBeamRange(notes, 'c', 'a').members.map(note => note.id), ['a', 'b', 'c']);
});
test('staff beam range rejects long notes, gaps, mixed voices, and barlines', () => {
  const base = { measure: 1, voice: 'S', duration: .5, rest: false };
  assert.match(chooseStaffBeamRange([{ ...base, id: 'a', onset: 0 }, { ...base, id: 'b', onset: .5, duration: 1 }], 'a', 'b').error, /eighth notes/);
  assert.match(chooseStaffBeamRange([{ ...base, id: 'a', onset: 0 }, { ...base, id: 'b', onset: 1 }], 'a', 'b').error, /gap/);
  assert.match(chooseStaffBeamRange([{ ...base, id: 'a', onset: 0 }, { ...base, id: 'b', onset: .5, voice: 'A' }], 'a', 'b').error, /same voice/);
  assert.match(chooseStaffBeamRange([{ ...base, id: 'a', onset: 0 }, { ...base, id: 'b', onset: .5, measure: 2 }], 'a', 'b').error, /barline/);
});
test('individual measure widths stay within usable limits', () => {
  assert.equal(clampMeasureWidth(80), 120);
  assert.equal(clampMeasureWidth(120), 120);
  assert.equal(clampMeasureWidth(455.4), 455);
  assert.equal(clampMeasureWidth(1200), 900);
});
test('measure content scales with its window within readable limits', () => {
  assert.equal(measureContentScale(120), .65);
  assert.equal(measureContentScale(320), 1);
  assert.equal(measureContentScale(480), 1.5);
  assert.equal(measureContentScale(900), 2);
});
test('saved spacing restores valid controls and defaults invalid or missing values', () => {
  assert.deepEqual(normalizeSpacingSettings({ measureWidth: 418.6, symbolWidth: 37.8, measuresPerLine: 5 }), { measureWidth: 419, symbolWidth: 38, measuresPerLine: '5' });
  assert.deepEqual(normalizeSpacingSettings({ measureWidth: 999, symbolWidth: -4, measuresPerLine: 12 }), { measureWidth: 640, symbolWidth: 0, measuresPerLine: 'auto' });
  assert.deepEqual(normalizeSpacingSettings(), { measureWidth: 320, symbolWidth: 56, measuresPerLine: 'auto' });
});
test('measure capacity meter preserves beat divisions and scales mistakes proportionally', () => {
  assert.deepEqual(measureCapacityMeter(4, 4, 1), { status: 'complete', correctPercent: 100, issueStartPercent: 100, issuePercent: 0, dividers: [25, 50, 75] });
  assert.deepEqual(measureCapacityMeter(4, 3.5, 1), { status: 'under', correctPercent: 87.5, issueStartPercent: 87.5, issuePercent: 12.5, dividers: [25, 50, 75, 87.5] });
  assert.deepEqual(measureCapacityMeter(4, 5, 1), { status: 'over', correctPercent: 100, issueStartPercent: 100, issuePercent: 25, dividers: [25, 50, 75, 100] });
  assert.deepEqual(measureCapacityMeter(4, 6, 1), { status: 'over', correctPercent: 100, issueStartPercent: 100, issuePercent: 50, dividers: [25, 50, 75, 100, 125] });
});
