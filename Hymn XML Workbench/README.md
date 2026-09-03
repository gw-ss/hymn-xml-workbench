# Hymn XML Workbench

See [`FEATURE-NOTES.md`](FEATURE-NOTES.md) for the consolidated feature history,
workflow decisions, layout invariants, and future user-manual checklist.
See [`COMPONENT-TERMINOLOGY.md`](COMPONENT-TERMINOLOGY.md) for the living,
standard vocabulary for interface components, musical objects, and saved state.

Offline browser editor for attaching Traditional Chinese characters and English syllables to a MusicXML melody without editing XML by hand.

## Photo-recognition development mode

The development pipeline is evidence-first. It evaluates page-level
registration quality separately from individual symbol confidence, reconciles a
primary OMR reading with an independent visual reading, checks photographed
items against musical inference, and prevents inference-only Alto, Tenor, or
Bass notes from entering the score. Uncertain symbols create localized review
items; they do not reject an otherwise usable page.

Run the deterministic development fixture with:

```sh
node scripts/run-photo-recognition-dev.mjs test-fixtures/photo-recognition-development.json /tmp/photo-recognition-report.json
```

The report preserves evidence, conflicts, confidence, and the emission decision
for every item. Automatic score writing remains outside this development runner
until the evidence gate has been validated with additional hymn photographs.

Open `photo-cleaner.html` from the Workbench start screen to prepare a derived
copy of a hymn photograph without overwriting the camera source. The cleaner
automatically normalizes uneven paper illumination, preserves grayscale symbol
detail, and rejects only microscopic dust. It deliberately does not redraw
staff lines or other music geometry before neural recognition.

The cleaner supports 0.2-degree straightening, stable circular or square manual
erasers, Original/Cleaned comparison, undoable eraser strokes, and separate PNG
exports for the straightened original and cleaned image. Both exports use the
system Save chooser when the browser supports it.

In English mode, **Load Staff Photo** opens an integrated quality-review dialog
with processing feedback, Original/Cleaned previews, and explicit acceptance,
warning, or rejection reasons. Accepted pixels are staged in memory for the
future staff-region/Oemer provider and are not written to MusicXML during the
intake step.

Direct entry uses an exact-position key-signature picker. Choose a flat or sharp,
move the treble or bass window among its lower, middle, and upper five-line
groups, and click the printed line or space. **Done** accepts an empty staff as
the valid no-sharps/no-flats signature, recognizes conventional signatures by
their affected note names, and flags mixed or nonstandard signatures for review.
Click an entered accidental to highlight it, then press Delete on Windows or
Delete/Backspace (⌫) on macOS to remove only that symbol.

Time-signature beat units support half, quarter, eighth, and sixteenth notes.
Pickup duration is independent: set its note value and a whole-number count,
or set the count to zero for no pickup. The pickup must be shorter than a full
measure, and the first entered measure must match the selected duration.
Tempo can be stored as a conventional textual marking (such as *Andante* or
*Moderato*), an optional quarter-note BPM, both, or unknown when nothing is
printed in the source hymn.

The first workbench version also supports note selection, semitone and octave pitch correction, common note lengths, multi-note connectors, undo/redo, visible jianpu octave marks, and basic score validation. Export always creates a new MusicXML file.

For a curved connector, select its first numeric note, choose **Next 1 note**, **Next 2 notes**, and so on, then choose **Add connector**. This exports as a MusicXML slur and may span notes with different pitches. Select the starting note again to remove it.

Direct Jianpu accepts `#4` or `♯4` for a sharpened degree and `b7` or `♭7`
for a flattened degree. Put `@` at the beginning of a measure, immediately
after `|`, to start that measure on a new system. `:|` writes a backward repeat
barline. Parentheses such as `(2/3/)` draw one connected underline without
duplicating an individual underline beneath each note.

Lyric assignment is deliberately explicit: select a token in the lyric palette and then select one numeric note. The token selection clears immediately afterward. Clicking a lyric already displayed under a note sets a shift anchor but does not arm note assignment, delete, move, or replace anything by itself. The next shift operation affects that character and everything following it. Use the small `×` specifically to clear an assignment.

MusicXML rests in staff 1 / voice 1 appear as numeric `0` events with the same duration marks as notes. To add a missing pause, select the following note, choose the pause length under **Pause before**, and choose **Insert 0**. The validator warns if the insertion makes the measure longer than its time signature; adjust a nearby duration before export when necessary.

When optical recognition produced a note where the paper copy has a pause, select that numeric note and choose **Replace note with 0**. This preserves the onset and duration, so a half-beat note becomes `0` with one underline and a one-beat note becomes a plain `0` without disturbing the 4/4 measure. Any lyric on the replaced note becomes unassigned so it can be shifted or realigned.

The normal correction for a pause inside a full measure is **Add 0 after note (keep 4/4)**. Select the note that currently occupies too much time and choose the pause duration. The workbench shortens the selected note by that amount, inserts the pause immediately after it, and leaves all later notes and the total measure duration unchanged. For example, a one-beat note plus a half-beat correction becomes a half-beat note followed by an underlined half-beat `0`.

Use **Merge with next** when optical recognition split one held numeric note into two adjacent events with the same Jianpu number. Their durations are added, the second XML event is removed, and the measure total stays unchanged. For Hymn 705 measure 4, merging the one-beat `3` with the following half-beat `3` produces the intended dotted 1½-beat `3·`. A lyric attached to the removed event becomes unassigned rather than being silently discarded. Half-beat notes use an underline; the dot is reserved for dotted durations.

Sustain or prolongation lines (`−`) and dotted-duration marks are individually selectable. Select one and choose **Change selected sustain to 0** to replace only that portion of the duration with an equal-length pause. The original note is shortened, any duration after the new pause becomes a new note event, and the measure total remains unchanged.

Choose **Add full sustain (+1 beat)** to extend the selected number by one beat. Selecting either the number or one of its existing prolongation lines targets the same held note. A two-beat note with one line becomes a three-beat note with two separate, selectable lines. The measure validator reports an overflow if other durations still need correction.

## Generic operation bar

The generic operation bar has three editing layers: **Numeric notation**, **Chinese lyrics**, and **English lyrics**. Choose an operation, a relative target (previous/current/next), and an operand, then apply it. Numeric operands are `0` through `7`, prolongation `−`, and duration dot `·`; an asterisk is accepted only in conversation and is never displayed by the application. The first generic version supports numeric insertion/replacement/removal/splitting/merging/octave changes and language-specific lyric insertion/replacement/removal/left shift/right shift. English operands are sung syllables rather than individual letters.

Both lyric text boxes and every notation layer remain visible in either editing
mode. The tabs control editing permission rather than visibility.

The tabs are editing modes. In Chinese mode, Jianpu and Chinese lyrics are
editable while English and the SATB staff layer are read-only. In English
mode, English lyrics and the SATB staff layer are editable while Jianpu
and Chinese remain together and read-only, with each Chinese character directly
beneath its Jianpu note. English mode disables direct Jianpu rebuilding,
note-inspector editing, and numeric operations, but still permits selecting an
English token and assigning it to an existing rhythmic position.

Loading a hymn always loads both Chinese and English verse text. The inactive
language stays populated while its box is hidden, and the load status reports
the number of lines loaded for each language.

Saving or exporting MusicXML embeds the complete Chinese and English source
text in standard MusicXML `identification/miscellaneous` fields, independently
of whether individual tokens have been assigned to notes. The alignment JSON
also carries both source texts. When an older saved file lacks this metadata,
the Workbench uses a hymn number found in its filename to restore any missing
language from the local Hymn Display database; saving once more upgrades it.

English mode collapses the complete left-side Jianpu-entry block: key-signature
staffs, score basics, meter, pickup, tempo, Direct-Entry text, rule legend, and
the Apply Jianpu action. Hymn selection and the verse selector remain visible
so that area can be used by the English SATB staff-entry palette.

Undo and Redo appear only beside the generic operation bar. They control the
same session-wide history for notation and lyric edits; the duplicate pair in
the save card was removed.

The legacy **Prepare tokens and restart alignment** action was removed because
it reset Chinese and English together and violated the independent editing-mode
rules. English preparation will belong to the SATB staff workflow instead.

English mode provides the first interactive SATB entry layer. Choose Soprano or
Alto for the treble staff, Tenor or Bass for the bass staff, then choose note,
rest, erase, duration, and accidental before clicking a beat and pitch. Voices
may share an onset to form a chord, and absent voices remain empty. English
tokens are prepared independently and attach to Soprano notes. Staff notes,
tokens, and assignments are preserved in a `hymn-play-satb-json` MusicXML
miscellaneous field and in alignment JSON without changing Jianpu or Chinese.
This first persistence layer is Workbench-readable; conversion into ordinary
four-voice MusicXML note streams remains a separate export step.

**Generate Soprano from corrected Jianpu** converts every corrected melody event
into a Soprano staff entry with the same measure, onset, duration, rest, written
pitch, accidental, and octave. Regeneration replaces only Soprano after a
confirmation and preserves the other three voices. Palette choices combine a
musical symbol with text. A selected staff note supports delete, equal split,
adjacent merge, diatonic staff-step movement, semitone movement, octave movement,
and automatic/up/down stem direction. Notes can also be dragged horizontally to
a quarter-beat grid and vertically to another line or space.

Generated Soprano noteheads use the actual rendered centers of their source
Jianpu symbols, rather than a separate fixed staff scale. Numeric notation and
staff notation therefore remain vertically aligned when symbol spacing, measure
width, window width, or horizontal scrolling changes. Staff alignment does not
reserve a clef-sized gutter in the Jianpu row, so all measure width remains
available to the numeric notes.

Chinese lyric characters are likewise anchored to the rendered center of the
Jianpu number itself. They remain aligned even when prolongation marks or other
symbols make the numeric note's surrounding layout cell asymmetrical.
Each numeric note also draws a very thin, faint dotted vertical guide through
its measure so the Jianpu number, Chinese character, and generated staff anchor
can be checked against the same centerline.

To adjust an unusual measure opening, select that measure's first Jianpu note
and use **Move left**, **Center**, or **Move right** in the note inspector. Each
step changes the opening by four pixels and redistributes the remaining measure
room. The corresponding generated Soprano anchor follows the numeric note. The
per-measure adjustments are saved in the workbench's embedded layout data.

Use **Beam Notes** when two or more consecutive eighth or sixteenth notes in one
voice need connected stems. Choose the operation, click the first note, and then
click the last note; every note in the inclusive range receives a shared beam.
The range cannot contain rests, rhythmic gaps, quarter notes or longer values,
mixed voices, or a barline. **Remove Beam** uses the same first-note/last-note
interaction and removes any beam group touched by the selected range.

For lyric shifts, select the first misplaced Chinese character or English syllable, choose the corresponding lyric layer and **Shift left** or **Shift right**, then apply the general operation. That character and every following assignment move together. With no selected anchor, the entire chosen language moves.

Barline operands are also available. `||` exports as MusicXML `light-light` for a section or verse boundary. **Final barline (thin + thick)** exports as `light-heavy`, matching the conventional end-of-hymn symbol. The barline is placed at the end of the measure containing the selected target symbol.

Duplicate note-inspector controls have been consolidated into the generic bar. Semitone changes, octave changes, rest replacement, merge-next, and adding a prolongation are generic operations. Specialized controls remain only where they carry additional parameters not yet modeled by the bar, such as pause duration, converting one selected sustain segment, and connector span.

Normal measures enforce their time-signature capacity: for example, 4/4 totals four quarter notes while 6/8 totals three quarter notes. Operations that would exceed the capacity are blocked, while underfull measures are flagged. Event widths are proportional to duration. Subdivisions are labeled `beat 4 + ½` rather than the misleading decimal `beat 4.5`. A first measure padded by leading rests is recognized and labeled as a pickup while retaining the printed time signature.

Use the live **Measure width** and **Minimum symbol space** controls to adjust notation spacing. Duration still influences relative width, while the minimum prevents a note, pause, prolongation, octave dot, or lyric from being squeezed into an unreadable area. Crowded measures scroll horizontally rather than overlapping. Spacing preferences are saved locally in the browser and do not alter MusicXML.

The global **Default measure width** remains the automatic-layout preference.
Each measure also has a grab handle at its lower-right corner. Drag horizontally
to give that measure a custom width; the surrounding measures reflow and its
Jianpu, lyrics, staff notation, beams, and scrolling realign immediately. A
measure's symbols, lyrics, vertical spacing, and staff height also scale with
the window, within readable minimum and maximum sizes. Individual and all-window
resizing permit measure widths from 120 through 900 pixels. A
custom resize switches exact **Measures per line** back to **Automatic**. Double-
click the handle, focus it and press Home, or undo the resize to return that
measure to the global default. Individual widths are saved in embedded layout
data and included in alignment JSON.

Use **All measure windows**, placed beside **Measures per line**, to assign one
exact width to every measure at once; individual handles remain available for
later exceptions. **Reset spacing** clears all individual and all-measure
overrides so automatic layout again uses the global **Default measure width**
preference.

Internal event-divider lines and per-symbol beat-position labels are intentionally hidden in the review view. Measure totals and time-signature validation remain active in the measure header and validator.

Undo and redo are available both above the measure grid and in the save panel. Keyboard shortcuts are `Ctrl+Z` / `Ctrl+Shift+Z` on Windows and `Command+Z` / `Command+Shift+Z` on macOS.

Jianpu octave dots are calculated from the key tonic at or below the melody's median pitch. They are display annotations only and never change the MusicXML octave.

The review interface intentionally hides scientific pitch labels such as `C5` and `A-flat4`. Exact staff pitches remain in MusicXML and are used internally for editing, playback, and later staff rendering.

## Run

From this project directory:

```sh
npm start
```

Open `http://127.0.0.1:4174`, choose a `.musicxml` file, select a lyric token, and then select its jianpu note. Export produces a revised MusicXML file; the original file is never overwritten.

Opening a saved or external MusicXML file also restores its key signature, time
signature, pickup duration, and printed tempo into the score-information controls.
It reconstructs the **Jianpu Encoded Stream** using the
[Jianpu Encoding Rules](JIANPU-ENCODING-RULES.md),
so the imported tune can be corrected and reapplied without typing it again.
Each `@` creates an explicit score-system container in the editor, so the new
system remains honored at every responsive window width.

The notation workspace has a native lower-right resize handle. Resize the
workspace independently from the notation, use **Measure width** and **Minimum
symbol space** to change density, or choose an exact **Measures per line** value
to keep (for example) four measures on every `@`-defined system. These local
display preferences do not alter MusicXML.
The file name is used to restore the hymn number when it contains a name such as
`hymn-1-...`. Load that hymn's verse, then use **Automatically align Chinese
lyrics to notes** in the lyrics section; this adds the lyric layer without
rebuilding or replacing the imported Jianpu notation.

Chinese auto-alignment first uses one character per eligible note, excluding
explicit connector-stop notes. If that count does not match, it may treat a
connected-underlined group as one sung-character position, but only when this
produces an exact character-to-anchor count. Otherwise it stops and reports all
counts instead of silently shifting the remaining lyrics.

When a connected-underlined or slurred group carries one Chinese character,
the editor places that character beneath the first note, where the syllable
begins. Later notes change pitch without starting another character. The
underline itself still extends from the left edge of the first note through the
right edge of the last note.

Chinese mode uses a compact vertical score layout. The lyric row begins directly
after the notation area reserved for octave dots and duration underlines, rather
than retaining the taller spacing intended for the future staff/English view.

After changing the **Jianpu Encoded Stream**, choose **Update notation preview
from Jianpu** to parse it again and refresh the measure editor. This operation is
separate from lyric alignment and is shown only in Chinese mode. Existing lyric
assignments are remapped by measure and beat, and the independent staff layer is
preserved. If the melody itself changed, regenerate Soprano after reviewing the
updated Jianpu.

Final, double, and repeat barlines are drawn independently for Jianpu and for
each treble or bass staff. They stop at the edge of their notation layer and do
not run through Chinese or English lyric rows. Measures with one of these ending
barlines reserve a narrow right-side gutter, keeping the last note and its
sustain marks clear without widening the measure window or adding a false beat.
Each measure is displayed in a fixed vertical layer order: Jianpu numeric
notation, treble-clef staff, Chinese lyrics, English lyrics, then bass-clef
staff. Jianpu end and repeat symbols are children of the numeric layer, so they
cannot extend into either lyric row.
All aligned lyric rows use the same full-width 330-unit coordinate plane as the
Jianpu and staff layers; no additional lyric-row side margin shifts the first or
last character away from its numeric-note anchor.

Each measure header includes a segmented capacity meter. Valid duration is
bright green; missing duration is orange; excess duration extends the meter
proportionally in red. Thin white lines mark every beat boundary, including
boundaries within excess beats and fractional endpoints. Pickup measures use
their valid pickup duration rather than being treated as underfull errors.
The visible heading contains the measure number and any pickup status without
repeating a textual beat fraction. Hovering the meter, or reading it with
assistive technology, provides the exact entered and allowed beat counts.

Each measure window scales its notation, Chinese and English lyrics, staff lyric
text, and header type with the window width. In English mode, the treble and bass
staff **Lower group**, **Center group**, and **Upper group** selectors move the
visible pitch range by an octave without transposing existing notes. Notes just
outside the five central lines receive short ledger lines automatically.

The **All measure windows** slider covers the commonly useful 120–500 px range
in one-pixel increments for precise adjustment. Individual measure grab handles
retain the wider 120–900 px range for unusual layouts.

The complete group of measure editors lives in its own horizontal and vertical
scroll viewport. Forced **Measures per line** layouts retain their requested
measure width and can extend sideways instead of compressing the notation. The
operation controls remain outside the scrolling score area, so they stay
available while the last measure is in view. Trackpads and scrollbars can pan in
either direction; Shift-scroll provides horizontal movement on a mouse wheel.

Spacing controls are saved with each working MusicXML file. Reopening that file
restores its default measure width, minimum symbol space, measures-per-line
choice, individual measure widths, and the derived all-measure slider position.
A score without Hymn XML Workbench layout data opens with the clean new-hymn
defaults: 320 px measures, 56 px minimum symbol space, and automatic wrapping.
Choosing **Measures per line** keeps the current slider values. When all measure
windows share one adjusted width, the forced layout begins at that common width
instead of jumping back to the default-measure slider.
Subsequent all-measure or individual-window resizing also preserves the selected
measures-per-line count; each layout operation starts from the complete current
combination of spacing options rather than resetting another control.
During editing, those values live only in the current score's in-memory working
state. They are embedded into MusicXML when the user saves or exports the score;
slider movement does not write a separate cross-hymn preference.
The manually resized outer editor-container width and height are stored the same
way and restored with that score. **Reset spacing** removes the stored container
dimensions along with the other score-specific layout overrides, returning to a
responsive size suitable for the current screen.
Saved layout profiles are keyed by available screen dimensions and display
scale, without recording a machine name or account. A recognized environment
restores its own profile. An unrecognized display starts with defaults for every
adjustable layout value; if its user adjusts and saves, that new profile is added
without replacing the original environment's settings.
Older Workbench XML using the former single-layout format is restored as the
current environment's profile for backward compatibility and is upgraded to the
multi-environment format on its next save.

Generated staff notes do not repeat flats or sharps already supplied by the key
signature. Every SATB notehead at the same onset is centered directly on the
dotted Jianpu guide. A required accidental is placed to the guide's left without
moving its notehead away from that shared anchor.
Connected Jianpu underlines use one continuous scaled stroke. Their start and
end extensions do not overlap the adjoining segment, avoiding a short darker or
thicker patch at either endpoint.
The first-note extension is part of the main underline element rather than a
separately positioned segment, so fractional measure scaling cannot place it on
a different vertical pixel row.

Chinese punctuation stays with the preceding character. For English, insert hyphens at sung syllable boundaries, such as `lift-ed`. The current melody rule is the highest pitch at every onset in staff 1, voice 1. Octave marks are hidden in the editor, but exported MusicXML pitches remain unchanged.

Saved MusicXML and alignment-review files are written beneath this project in
`output/musicxml` and `output/alignment`. Hymn Display's compatible runtime
data, database schema, Drizzle migrations, and SQL documentation retain their
original structure beneath `vendor/hymn-display`.

Before using or changing the mirrored database, follow
[`docs/hymn-display-sync.md`](docs/hymn-display-sync.md). The read-only
compatibility check is:

```sh
npm run sync:hymn-display:check
```
