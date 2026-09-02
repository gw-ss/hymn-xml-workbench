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
- Staff beams follow their notes' pitch contour with a restrained slope. Stem
  Up, Stem Down, or Stem Automatic applies to the complete connected beam group
  so its direction remains coherent and can match a photographed source.
- For a photo transcription, the photographed beam side (above/up-stem or
  below/down-stem) is authoritative source data and is saved with the beam
  group. SATB voice defaults are used only when no source direction is known.
- Compatible SATB beam groups on the same staff are drawn as one shared beam
  when their onset/duration sequence and Beam side match. Upward shared beams
  use the upper photographed voice for height and slope; downward shared beams
  use the lower photographed voice. All participating stems terminate at that
  single line. Opposite Beam sides or different rhythms remain separate.
- Photo beam-direction validation has three decisions: Accept when every
  recognized group matches at sufficient confidence; Warning when directions
  match but one or more groups are only reviewably clear; Reject when clarity
  is too low, a direction is unknown, or the rendered direction disagrees with
  the photo. Manually entered confidence is used until staff-photo OCR supplies
  recognition confidence.
- The development-mode photo-recognition pipeline separates page-level image
  quality from localized symbol uncertainty. A whole photograph is rejected
  only when it cannot be registered reliably (for example, missing staff lines,
  cropped music, insufficient page coverage, severe perspective distortion, or
  unusably low resolution). Blur, contrast, and isolated uncertain symbols
  produce review notices attached to their locations instead of rejecting the
  complete page.
- Every recognized symbol is stored as evidence with its source, confidence,
  measure, onset, voice, bounding box, and optional crop reference. Independent
  agreement may strengthen confidence; disagreement remains a visible conflict.
  Musical inference verifies photo evidence but cannot create a missing
  Alto/Tenor/Bass item. The emission gate passes corroborated evidence, sends
  weaker single-reader evidence to localized review, and blocks unresolved
  conflicts without blocking unrelated measures.
- The Hymn Photo Dust Cleaner is a separate, non-destructive preparation tool.
  It converts the preview to black and white, finds connected dark components,
  and removes a component only when both its pixel area and bounding dimensions
  are below the adjustable limits. A red inspection mode displays every pixel
  scheduled for removal before the cleaned PNG is exported.
  Before classifying connected components, it recognizes supported horizontal,
  vertical, and shallow sloped segments and reconstructs adjustable gaps. This
  protects staff lines, measure barlines, thick system-opening lines,
  end/repeat lines, stems, beams, Jianpu underlines, and sustain lines. Thick
  lines are reconstructed across their component columns. The changes preview
  colors removals red, horizontal reconstruction green, vertical boundary
  reconstruction blue, and sloped reconstruction purple. The tool reports the
  recognized boundary and horizontal-structure counts before export.
- Measures containing unresolved photo/OCR-versus-verification conflicts receive
  a red outline and a conflict-count badge in the Measure header. Hover previews
  a floating conflict popover; clicking pins it; clicking elsewhere dismisses
  it. Each item identifies voice, beat, photo/OCR reading, verification result,
  confidence, and reason, and can focus the affected staff note. Confirming the
  photo reading or marking the entry corrected resolves the warning and is
  saved with the working score.
- Two voices at the same onset and exact pitch share one completely overlapping
  notehead while retaining their independent upward/downward stems. All staff
  voices at the same rhythmic onset use the exact same horizontal Jianpu anchor,
  even when their pitches differ; no voice receives a collision offset.
- Treble and bass each offer Lower, Center, and Upper staff groups. These move
  the visible five-line range by an octave without transposing notes. Notes just
  outside the staff receive ledger lines.
- Key-signature accidentals are not redundantly printed on generated staff
  notes. When an explicit accidental is required, it sits to the left of the
  alignment guide without shifting the notehead away from the Jianpu anchor.
- An explicit natural is displayed when a note cancels the key signature.

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

## Photo cleaner and neural recognition

- The source photograph is never overwritten; cleanup and neural inputs are
  derived files.
- The cleaner toolbar uses two panes: **Image file operations** on the left
  contains loading, preview selection, and vertically stacked export buttons;
  **Image operations** on the right places processing checkboxes at the top and
  straightening controls at the bottom. Export labels omit decorative ellipses.
- The left pane is a single vertical flow so a long loaded filename cannot
  collide with Preview. Native file input text is constrained to the pane and
  truncates visually when necessary.
- **Image file operations** is divided into an upper **Load and preview**
  subpane and a lower **Export files** subpane. The export actions remain
  vertically stacked.
- Preview appears above Photo in the left cleaner pane. On the Workbench opening
  panel, **Choose MusicXML**, **Enter Jianpu directly**, and **Clean a hymn
  photo** have equal widths/heights, zero inherited label margins, and uniform
  spacing.
- **Export cleaned PNG…** opens the operating-system Save chooser with the
  generated filename and Downloads as the initial directory. Browsers without
  File System Access support fall back to their configured Downloads location
  and report that behavior in the status line.
- After loading, **Rotate left 0.2°**, **Rotate right 0.2°**, and **Reset** straighten
  a derived photo before cleanup. Rotation is limited to ±45° and expands a
  white canvas around the page so corners are not cropped. Both the
  straightened original and straightened cleaned image have separate PNG Save
  operations; the camera source is never overwritten.
- The former automatic **Trim gray rotation borders** option was replaced by a
  manual white eraser. Users can choose a circular or square 8–96 px brush,
  drag over gray page borders, dust, or unwanted black spots, and undo up to 20
  eraser strokes. Strokes edit both working previews directly and do not rerun
  adaptive background normalization, so gray thresholds cannot shift elsewhere.
  The native pointer is replaced by a live circle or square outline matching
  the selected shape and scaled brush size while it is over the image. Turning
  Eraser off immediately hides the outline, ends any active gesture, and
  restores the normal arrow cursor.
  Erasing changes only the straightened working copy; changing rotation clears
  eraser history because the pixel coordinates change.
- **Remove uneven paper background** is enabled when a photo is loaded. It
  estimates low-frequency illumination and local paper tone, whitens the
  background, and retains locally detected notation/lyric ink in grayscale.
  It can be disabled to compare against the untouched paper background.
- Background normalization applies a conservative 0.25%–99.7% percentile
  contrast stretch after illumination correction. This matches the development
  result and whitens residual gray edge shading without imposing a global
  music-symbol threshold.
- **Preserve original symbol detail** is enabled by default. It retains the
  source grayscale and antialiased pixels for clefs, accidentals, noteheads,
  rests, ties, lyrics, and other surviving content. Only confirmed dust is
  whitened and recognized line gaps are redrawn in black.
- Strict black-and-white conversion remains available by turning symbol-detail
  protection off, but it can make fine printed symbols look rougher.
- Interactive line repair was removed from the browser cleaner. Even a 1 px
  repair can mistake dense lyric or symbol strokes for a broken line and can
  contaminate neural recognition. The cleaner always preserves the original
  staff, beam, barline, lyric, and symbol geometry for Oemer and later stages.
- Changing a cleanup control immediately invalidates the previous result and
  disables export until the new preview has finished, preventing a stale
  nonzero line-repair result from being downloaded after the slider reaches 0.
- The former black/white threshold, maximum dust area, and maximum dust size
  sliders and the **Removed dust** preview were removed. Automatic local
  background separation already covers their useful role, while global manual
  values had little visible effect and could become unsafe. A fixed conservative
  4-pixel/3-by-3 micro-dust rejection runs internally after normalization.
- Oemer supplies neural evidence masks; it is not yet the browser cleaner and
  its legacy end-to-end MusicXML postprocessor is not authoritative.
- Workbench geometry, corrected Jianpu/Soprano timing, photo evidence,
  inference verification, and user conflict resolution govern XML emission.
- English mode includes **Load Staff Photo**. PNG and high-quality JPEG are
  preferred; TIFF, WebP, HEIC, and HEIF are accepted when the browser can
  decode them.
- Loading opens an integrated **Staff Photo Review** dialog with a busy state,
  Original/Cleaned comparison, page dimensions/type, and explicit accept,
  warning, or rejection reasons. Rejected photos cannot be accepted.
- The processing indicator is hidden immediately after cleaning completes and
  does not remain visible during or after staff-region review.
- Accepted cleaned pixels and their quality/cleanup manifest are staged only
  in the current in-memory session with status
  `cleaned-awaiting-staff-region-recognition` until extraction begins.
- **Staff-region extraction** detects regular five-line staffs, pairs adjacent
  treble/bass regions into SATB hymn systems, and presents confidence-coded
  system boxes and staff-line guides for visual review: dark green is high
  (95–100%), cyan is middle (85–94%), orange is low (65–84%), and red is no
  confidence (0–64%). A four-band meter explains these colors. The extraction manifest
  (staff lines, crop rectangles, confidence, and warnings) is kept in memory
  with status `staff-regions-extracted`. It does not recognize symbols or write
  photo-derived notes to MusicXML.
- Region extraction also detects vertical measure bars, strong system-start
  bars, and stop/repeat boundary pairs by matching full-height lines in the
  treble and bass staffs. Horizontal staff guides are clipped to the detected
  outer bars instead of running across the entire photograph.
- After **Use extracted regions**, the Editor retains a visible system/staff
  count and confidence summary with **Review extracted regions**, which reopens
  the confidence-red overlay. Measure viewports remain unchanged until the
  separate measure-registration stage.
