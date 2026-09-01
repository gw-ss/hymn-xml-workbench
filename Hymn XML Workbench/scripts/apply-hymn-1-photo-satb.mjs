#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { assessPhotoBeamDirections } from '../core.mjs';

const [sourceArg, outputArg, reviewArg] = process.argv.slice(2);

if (!sourceArg || !outputArg) {
  console.error('Usage: node scripts/apply-hymn-1-photo-satb.mjs SOURCE.musicxml OUTPUT.musicxml [REVIEW.json]');
  process.exit(1);
}

const source = await readFile(sourceArg, 'utf8');
const beamFixture = JSON.parse(await readFile(new URL('../test-fixtures/hymn-1-photo-beams.json', import.meta.url), 'utf8'));
const fieldPattern = /(<miscellaneous-field\s+name="hymn-play-satb-json">)([\s\S]*?)(<\/miscellaneous-field>)/;
const fieldMatch = source.match(fieldPattern);

if (!fieldMatch) throw new Error('The source file has no hymn-play-satb-json field.');

const workbench = JSON.parse(fieldMatch[2]);
const soprano = workbench.notes.filter(note => note.voice === 'S').toSorted((a, b) => a.measure - b.measure || a.onset - b.onset);

if (soprano.length !== 68) throw new Error(`Expected the 68-note Hymn 1 Soprano stream; found ${soprano.length}.`);

// First-pass transcription from the processed Hymn 1 photograph dated
// 2026-09-01. Alto follows the printed treble-staff rhythm. Tenor and Bass are
// represented at the photographed quarter-beat harmonic positions; the final
// chord of each phrase is a half note. The review file lists the few pitches
// that deserve comparison with a clearer source if one becomes available.
const altoPitches = {
  1: ['D4', 'D4', 'Eb4', 'F4'],
  2: ['F4', 'E4', 'F4', 'E4', 'D4'],
  3: ['F4', 'Eb4', 'F4', 'Eb4'],
  4: ['D4', 'C4', 'D4', 'Bb3'],
  5: ['D4', 'D4', 'Eb4', 'F4'],
  6: ['F4', 'E4', 'F4', 'E4', 'D4'],
  7: ['Eb4', 'G4', 'F4', 'F4'],
  8: ['F4', 'Eb4', 'F4', 'D4'],
  9: ['D4', 'G4', 'E4!', 'F4'],
  10: ['Eb4', 'D4', 'Eb4', 'D4', 'Bb3'],
  11: ['F4', 'G4', 'Bb4', 'F4'],
  12: ['F4', 'E4!', 'F4', 'C4'],
  13: ['D4', 'D4', 'Eb4', 'F4'],
  14: ['F4', 'E4', 'F4', 'E4', 'D4'],
  15: ['Eb4', 'G4', 'F4', 'F4'],
  16: ['F4', 'Eb4', 'F4', 'D4'],
};

const tenorPitches = {
  1: ['Bb3', 'Bb3', 'Bb3', 'A3'],
  2: ['Bb3', 'G3', 'Bb3', 'G3'],
  3: ['C4', 'C4', 'D4', 'C4'],
  4: ['Bb3', 'G3', 'Bb3'],
  5: ['Bb3', 'Bb3', 'Bb3', 'A3'],
  6: ['Bb3', 'A3', 'F#3!', 'G3'],
  7: ['Bb3', 'C4', 'Bb3', 'F3'],
  8: ['C4', 'C4', 'C4'],
  9: ['F3', 'Eb4', 'G3', 'C4'],
  10: ['C4', 'C4', 'A3', 'Bb3'],
  11: ['F3', 'G3', 'G3', 'F3'],
  12: ['A3', 'G3', 'F3'],
  13: ['Bb3', 'Bb3', 'Bb3', 'A3'],
  14: ['Bb3', 'A3', 'F#3!', 'G3'],
  15: ['Bb3', 'C4', 'Bb3', 'F3'],
  16: ['C4', 'C4', 'C4'],
};

const bassPitches = {
  1: ['Bb2', 'Bb2', 'Eb3', 'D3'],
  2: ['Bb2', 'C3', 'Bb2', 'C3'],
  3: ['F3', 'C3', 'Bb2', 'C3'],
  4: ['Bb2', 'C3', 'Bb2'],
  5: ['Bb2', 'Bb2', 'Eb3', 'F3'],
  6: ['Bb2', 'D3', 'D3', 'Eb3'],
  7: ['Eb3', 'C3', 'Bb2', 'D3'],
  8: ['F3', 'C3', 'Bb2'],
  9: ['Bb2', 'G2', 'C3', 'F3'],
  10: ['C3', 'F3', 'D3', 'G3'],
  11: ['Bb2', 'G2', 'Eb3', 'Bb2'],
  12: ['F3', 'C3', 'Bb2'],
  13: ['Bb2', 'Bb2', 'Eb3', 'D3'],
  14: ['Bb2', 'D3', 'D3', 'Eb3'],
  15: ['Eb3', 'C3', 'Bb2', 'D3'],
  16: ['F3', 'C3', 'Bb2'],
};

// Beam side is transcribed from the photograph rather than inferred from the
// usual SATB voice defaults. Every visible short-note group in this Hymn 1
// treble source is beamed above the staff for both printed parts.
const photoBeamStemDirections = {
  A: Object.fromEntries([2, 4, 6, 8, 10, 12, 14, 16].map(measure => [measure, 'up'])),
};

const parsePitch = value => {
  const match = value.match(/^([A-G])(b|#)?(\d)(!)?$/);
  if (!match) throw new Error(`Invalid transcription pitch: ${value}`);
  return {
    step: match[1],
    alter: match[2] === 'b' ? -1 : match[2] === '#' ? 1 : 0,
    octave: Number(match[3]),
    // Key-signature spellings such as B-flat and E-flat are not explicit
    // accidentals. `!` marks a symbol printed in the photographed measure,
    // including a natural cancellation when the stored alteration is zero.
    explicitAccidental: Boolean(match[4]),
  };
};

let nextId = Math.max(0, ...workbench.notes.map(note => Number(String(note.id).match(/\d+/)?.[0]) || 0)) + 1;

const makeNote = (measure, voice, onset, duration, pitch, extra = {}) => ({
  id: `satb-${nextId++}`,
  measure,
  voice,
  clef: voice === 'A' ? 'treble' : 'bass',
  onset,
  duration,
  rest: false,
  ...parsePitch(pitch),
  stem: 'auto',
  sourceEventId: null,
  beam: null,
  beamGroup: null,
  ...extra,
});

const transcription = [];

for (let measure = 1; measure <= 16; measure += 1) {
  const sourceNotes = soprano.filter(note => note.measure === measure);
  const alto = altoPitches[measure];
  if (alto.length !== sourceNotes.length) throw new Error(`Alto count mismatch in measure ${measure}.`);
  let beamNumber = 0;
  for (let index = 0; index < sourceNotes.length; index += 1) {
    const sourceNote = sourceNotes[index];
    let beamGroup = null;
    if (sourceNote.beam) {
      if (sourceNote.beam === 'begin') beamNumber += 1;
      beamGroup = `photo-A-m${measure}-b${beamNumber}`;
    }
    transcription.push(makeNote(measure, 'A', sourceNote.onset, sourceNote.duration, alto[index], {
      beam: sourceNote.beam || null,
      beamGroup,
      stem: sourceNote.beam ? photoBeamStemDirections.A[measure] || 'auto' : 'auto',
    }));
  }

  const lowerDurations = tenorPitches[measure].length === 3 ? [1, 1, 2] : [1, 1, 1, 1];
  for (const [index, pitch] of tenorPitches[measure].entries()) transcription.push(makeNote(measure, 'T', index, lowerDurations[index], pitch));
  for (const [index, pitch] of bassPitches[measure].entries()) transcription.push(makeNote(measure, 'B', index, lowerDurations[index], pitch));
}

workbench.notes = [...soprano, ...transcription];
workbench.photoConflicts = transcription
  .filter(note => note.voice === 'A' && [2, 6, 14].includes(note.measure) && note.step === 'E' && note.alter === 0)
  .map((note, index) => ({
    id: `hymn1-alto-natural-${index + 1}`,
    measure: note.measure,
    voice: note.voice,
    onset: note.onset,
    noteId: note.id,
    ocrValue: `E♮${note.octave}`,
    inferredValue: `E♭${note.octave}`,
    confidence: .72,
    reason: 'The key signature supplies E-flat, but the transcription contains E-natural and the processed photo does not clearly show a natural sign.',
    resolution: null,
  }));
const beamDirectionAssessment = assessPhotoBeamDirections(beamFixture.groups.map(group => {
  const members = transcription.filter(note => note.beamGroup === group.id);
  const directions = new Set(members.map(note => note.stem).filter(direction => ['up', 'down'].includes(direction)));
  return { ...group, renderedDirection: directions.size === 1 ? [...directions][0] : null };
}));
if (beamDirectionAssessment.decision === 'reject') throw new Error(`Photo beam-direction validation rejected this transcription:\n${beamDirectionAssessment.reasons.join('\n')}`);
if (beamDirectionAssessment.decision === 'warning') console.warn(`Photo beam-direction validation needs review:\n${beamDirectionAssessment.reasons.join('\n')}`);
workbench.photoTranscription = {
  status: 'draft-needs-visual-review',
  hymnNumber: 1,
  source: 'Screenshot 2026-09-01 at 12.48.42 PM.png',
  created: '2026-09-01',
  retainedSopranoFromJianpu: true,
  transcribedVoices: ['A', 'T', 'B'],
  beamDirectionAssessment,
  photoConflicts: workbench.photoConflicts,
};

const noteText = 'Photo transcription draft: Alto, Tenor, and Bass were read from the processed Hymn 1 photograph. Review highlighted scan ambiguities before treating it as a final transcription.';
let output = source.replace(fieldPattern, `$1${JSON.stringify(workbench)}$3`);
const reviewField = `<miscellaneous-field name="hymn-play-satb-transcription-note">${noteText}</miscellaneous-field>`;
output = output.includes('</miscellaneous>') ? output.replace('</miscellaneous>', `${reviewField}</miscellaneous>`) : output;
await writeFile(outputArg, output, 'utf8');

const review = {
  schemaVersion: 1,
  source: path.basename(sourceArg),
  output: path.basename(outputArg),
  status: 'draft-needs-visual-review',
  summary: 'Soprano retained from corrected Jianpu; Alto, Tenor, and Bass transcribed from the processed photograph.',
  counts: Object.fromEntries(['S', 'A', 'T', 'B'].map(voice => [voice, workbench.notes.filter(note => note.voice === voice).length])),
  beamDirectionAssessment,
  photoConflicts: workbench.photoConflicts,
  reviewItems: [
    'Measures 2 and 6/14: confirm inner-voice passing tones and the printed bass-staff sharp.',
    'Measures 7 and 8/15 and 16: confirm Tenor and Bass chord spacing at the cadence.',
    'Measures 9 and 10: confirm the printed natural/secondary-dominant accidentals.',
    'Measure 12: confirm the Alto natural and the final inner-voice movement/tie.',
    'Confirm whether lower voices sustain quarter notes across Soprano eighth-note pairs; the draft follows the photographed quarter-note harmonic rhythm.',
  ],
};

if (reviewArg) await writeFile(reviewArg, `${JSON.stringify(review, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputArg}`);
if (reviewArg) console.log(`Wrote ${reviewArg}`);
console.log(`Staff entries: ${JSON.stringify(review.counts)}`);
