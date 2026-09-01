# Hymn XML Workbench — Feature and Manual Notes

Last consolidated: September 1, 2026

This file is the durable source outline for a future user manual. It records the
features, terminology, workflow decisions, and layout invariants established
during development. It is not intended to replace task-based user instructions.
Preferred component names are maintained in
[`COMPONENT-TERMINOLOGY.md`](COMPONENT-TERMINOLOGY.md).

## Recommended hymn-production workflow

1. Open/import the MusicXML hymn and confirm its hymn number, key signature,
   time signature, pickup, tempo, and numeric notation.
2. Correct the Jianpu first. It is the authoritative melody and horizontal
   alignment layer for the editor.
3. Load the Chinese verse and automatically align it, then correct any lyric
   assignments. Chinese alignment must not rebuild or replace the Jianpu.
4. Generate Soprano from the corrected Jianpu. Regeneration replaces Soprano
   only and preserves Alto, Tenor, and Bass.
5. Review/correct Soprano and enter or finish the remaining staff voices.
6. Prepare the English verse with hyphens at sung syllable boundaries and
   assign English syllables to Soprano notes.
7. Validate measure durations and assignments, then save/export MusicXML and,
   when useful, an alignment-review file.

English work may begin once the corrected Jianpu and generated Soprano are
stable; it does not technically require Alto, Tenor, and Bass to be complete.
Finishing the staff notation first is usually the safer route because later
melody/rhythm corrections can otherwise require English realignment.

## Editing modes and visible layers

- Chinese mode permits Jianpu and Chinese editing. English and SATB remain
  visible but read-only.
- English mode permits English and SATB editing. Jianpu and Chinese remain
  visible together but read-only.
- Tabs control editing permission, not which notation layers exist.
- English mode collapses the large Jianpu direct-entry area to make room for
  staff entry, while hymn and verse selection remain available.
- The fixed vertical order inside every measure is:
  1. Jianpu numeric notation
  2. Treble-clef staff
  3. Chinese lyrics
  4. English lyrics
  5. Bass-clef staff

## Jianpu entry and correction

- Direct entry supports ordinary degrees, `0` rests, `-` sustain/prolongation,
  duration dots, octave marks, sharps/flats, measure separators, new-system
  markers, repeat bars, double bars, and final bars.
- `@` after the beginning or a bar separator starts an explicit new system.
- `:|` creates a backward repeat.
- Parentheses such as `(2/3/)` create one continuous connected underline.
- Connected underlines must render as one straight, uniformly weighted stroke;
  no short dark/thick patch may appear at either endpoint.
- Numeric editing includes insert, replace, remove, split, merge, octave and
  semitone changes, rest conversion/insertion, sustain operations, connectors,
  barlines, and undo/redo.
- A selected first note can be moved left, centered, or moved right in 4 px
  steps for exceptional measure openings. Remaining room is redistributed.
- Jianpu rests retain the same duration-mark rules as notes.
- The validator blocks over-capacity editing operations and flags underfull
  measures. Pickup measures use the configured pickup duration.

## Staff notation and Soprano generation

- **Generate Soprano from corrected Jianpu** copies measure, onset, duration,
  rest/note state, pitch, accidental, octave, and compatible beam information.
- Staff entry supports Soprano, Alto, Tenor, and Bass, including notes, rests,
  erasing, durations, accidentals, pitch movement, stem direction, split,
  merge, delete, and dragging to a rhythmic/pitch grid.
- Use **Beam Notes** for staff notation: choose the operation, click the first
  note, then the last note. All consecutive eligible notes in that same voice
  and measure are connected. The range cannot contain rests, gaps, quarter-or-
  longer notes, mixed voices, or a barline. **Remove Beam** uses the same range
  interaction.
- Staff beaming is required as an operation because Jianpu direct-entry grouping
  rules do not govern independently edited staff voices.
- Treble and bass each offer Lower, Center, and Upper staff groups. These move
  the visible five-line range by an octave without transposing notes. Notes just
  outside the staff receive ledger lines.
- Key-signature accidentals are not redundantly printed on generated staff
  notes. When an explicit accidental is required, the accidental sits left of
  the alignment guide and the notehead sits right of it, with the pair centered
  on the Jianpu anchor.

## Alignment rules — do not regress

- The rendered center of each Jianpu number is the authoritative horizontal
  anchor.
- Generated Soprano noteheads and Chinese characters use that same anchor.
- Very thin, faint dotted guides pass through each Jianpu-note center to make
  alignment errors visible.
- The first Chinese character of a measure must align with the first Jianpu
  number just as all subsequent characters do. Lyric rows must not introduce a
  clef gutter or independent side margin.
- Chinese punctuation stays attached to the preceding character without moving
  that character away from its note.
- A connected/slurred group with one Chinese character places it at the first
  note, where the syllable begins.
- English syllables attach to Soprano rhythmic positions.
- Measure width, per-measure resizing, symbol spacing, container resizing, and
  scrolling must never break these shared anchors.

## Chinese and English lyric behavior

- Chinese auto-alignment normally assigns one character per eligible note and
  excludes explicit connector-stop notes.
- If counts differ, a connected-underlined group may count as one sung position
  only when doing so produces an exact match. Otherwise alignment stops and
  reports the counts rather than silently shifting later characters.
- Lyric assignment is explicit: select a palette token and then its note.
- Selecting an already assigned lyric sets the anchor for shifting that lyric
  and all following assignments. Clearing uses the small `×` control.
- Chinese and English source text are stored independently, even when only one
  language is actively being edited.
- English uses sung syllables as operands; write hyphens at syllable boundaries,
  for example `lift-ed`.

## Measure endings and special symbols

- Final, double, and repeat marks are drawn independently for Jianpu and each
  staff.
- A Jianpu ending symbol belongs only to the numeric-notation layer. It must not
  extend through Chinese or English lyrics.
- Ending measures reserve a narrow right gutter so a sustain mark or final note
  cannot overlap an end/repeat symbol. This gutter is not a beat and should not
  enlarge the measure window.

## Measure capacity meter

- The former green stripe at the upper-left of a measure has been replaced by a
  segmented meter on the right side of the measure heading.
- The heading shows the measure number (and pickup status when applicable), but
  no longer repeats text such as `4/4 beats`; the meter is the compact visual
  representation. Its exact entered/allowed beat counts remain available in an
  accessible label and hover tooltip.
- Correct/entered duration is bright green.
- Missing duration is orange.
- Excess duration extends proportionally in red beyond the normal green width.
- Thin white divisions mark each expected beat in the green portion. They also
  continue through proportional extra beats, including fractional endpoints.
- A full 4/4 measure therefore shows a green bar divided by three internal white
  lines. A five-beat 4/4 measure shows the complete divided green 4/4 portion
  plus a proportional one-beat red extension.
- A legitimate five-beat measure should use the appropriate time signature;
  five beats entered into a 4/4 measure normally indicates a correction is
  needed.

## Measure windows and score navigation

- Every measure has a lower-right grab handle for individual horizontal resize.
- Individual measure widths support 120–900 px.
- **All measure windows**, beside **Measures per line**, adjusts every current
  measure over 120–500 px in 1 px increments for fine control.
- **Default measure width** remains the starting automatic-layout width.
- **Minimum symbol space** controls the minimum readable room per event; crowded
  measures scroll instead of overlapping.
- Notation, lyric, header, staff, and symbol sizes scale with a resized measure
  window within readable limits; resizing is not merely a larger empty frame.
- Forced **Measures per line** arrangements may extend horizontally instead of
  compressing measures. Selecting a count preserves all current slider values.
- Moving any layout control starts from the complete in-memory working values;
  it must not reset another control or jump **Measures per line** to Automatic.
- The measure group lives in a two-axis scroll/pan viewport. Trackpads and
  scrollbars move vertically or horizontally; Shift-wheel supports horizontal
  movement.
- Editing operations and options remain outside the scrolling measure area, so
  they remain reachable while working on the final measure.
- The outer editor container itself is resizable.
- **Reset spacing** clears per-measure widths, the all-measure override,
  container dimensions, and other score-specific spacing overrides, returning
  to responsive defaults for the current display.

## Layout state and persistence

- Layout controls operate on one coherent in-memory working state while a score
  is open. They are saved only when the user saves/exports the file.
- There is no cross-hymn browser preference that should overwrite values loaded
  from the current MusicXML file.
- Saved layout includes default measure width, minimum symbol space, measures
  per line, individual widths, first-note offsets, staff range groups, the
  all-measure slider's derived value, and outer container dimensions.
- Layout is embedded in the Workbench MusicXML metadata and alignment JSON.
- Layout profiles are keyed by available screen dimensions and display scale,
  without storing a machine name or user account.
- A recognized display environment restores its saved profile.
- An unknown display environment starts from clean defaults for all adjustable
  values so a file shared to another person/screen remains usable. Saving after
  adjustment adds that environment's profile without deleting the original.
- New hymns or files without Workbench layout metadata use 320 px measure width,
  56 px minimum symbol space, Automatic measures per line, centered staff
  groups, no individual widths/offsets, and a responsive container.
- Older single-layout Workbench files are restored compatibly and upgraded to
  multi-environment profiles on their next save.

## Import, save, and export

- Loading MusicXML restores musical settings, both lyric source texts, Jianpu,
  SATB/assignment data, and the matching layout profile when available.
- The Workbench metadata field is named `hymn-play-satb-json`.
- Saving/exporting always creates output files; the imported original is not
  overwritten.
- Output MusicXML is written under `output/musicxml`; alignment-review files are
  written under `output/alignment`.
- A hymn number in the filename can be used to restore missing lyric text from
  the local Hymn Display data when older files lack embedded text.

## Manual-writing cautions

- Use the term **bass clef**, not “base clef.”
- Clearly distinguish **Default measure width**, **All measure windows**, and an
  individual measure handle; they affect related but different values.
- Explain that staff Lower/Center/Upper changes the viewport, not note pitch.
- Explain that the capacity meter diagnoses entered duration; it is not a
  playback/progress or health meter.
- Do not describe the obsolete upper-left green completion stripe as current UI.
- Do not show repeated beat-count text beside the capacity meter in current
  measure-header screenshots.
- Do not say a resize forces **Measures per line** back to Automatic; current
  layout operations preserve the selected count and other working values.
- Refresh screenshots for the current layer order, lyric alignment, segmented
  capacity meter, 120 px minimum measure width, and scrollable editor viewport.

## Verification checklist for future changes

- First and last Jianpu, Soprano, and Chinese anchors coincide at multiple
  measure widths, including 120 px.
- Connected Jianpu underlines remain straight and uniformly weighted.
- Explicit staff accidentals do not hide behind noteheads.
- Sustain marks do not collide with final/repeat barlines.
- Capacity meter beat divisions remain visible for correct, missing, excess,
  fractional, and pickup measures.
- Fixed measures-per-line and all-window resizing preserve all current controls.
- A saved file restores the same layout on the same display and defaults safely
  on an unknown display.
- Operation controls remain reachable after panning to the last measure.
