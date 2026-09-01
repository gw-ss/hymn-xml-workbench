# Hymn XML Workbench — Component Terminology

Status: living vocabulary

Last consolidated: September 1, 2026

This document establishes the preferred names for the application’s visible
components, musical objects, controls, and saved state. Use these names in
conversation, interface labels, development notes, issue reports, and the user
manual. Add new terms here as components and features are introduced.

## How to use this document

- A **preferred term** is the standard name to use going forward.
- Text in quotation marks is a visible interface label.
- “Avoid” identifies wording that is ambiguous, obsolete, or musically
  incorrect.
- A component may be nested inside another component; the hierarchy below is
  intentional.

## Application and main regions

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Hymn XML Workbench** or **Workbench** | The complete application. | “Website” when discussing the local application. |
| **Open-file panel** | The initial panel used to choose MusicXML or begin direct Jianpu entry. | “Editor,” because editing has not started yet. |
| **Editor** | The complete post-load editing interface, including the sidebar and Editor container. | Do not use for only one measure. |
| **Sidebar** | The left column containing hymn/Jianpu entry, lyric preparation, staff-entry tools, validation, and saving. | “Toolbar”; it contains several panels, not one toolbar. |
| **Editor container** | The resizable right-hand panel containing the editor heading, spacing controls, editing controls, and Measure viewport. This is the component previously described as the outer editor-container window. | “Measure window,” “screen,” or merely “container window.” |
| **Editor-container resize handle** | The lower-right native handle that changes the width and height of the Editor container. | **Measure resize handle**, which affects only one measure. |
| **Editor mode** | The active permission mode: Chinese mode or English mode. | “Layer”; modes determine what can be edited, not merely what is shown. |
| **Chinese mode** | Mode in which Jianpu and Chinese lyrics are editable while English and SATB remain read-only. | “Jianpu-only mode”; all layers remain present. |
| **English mode** | Mode in which English lyrics and SATB are editable while Jianpu and Chinese remain read-only. | “Staff-only mode”; English lyric work is included. |

## Editor-container hierarchy

Use this hierarchy when identifying where something appears:

```text
Editor
├── Sidebar
└── Editor container
    ├── Editor heading and legend
    ├── Spacing controls
    ├── Sticky editing controls
    │   ├── Note inspector
    │   └── General operation bar
    └── Measure viewport
        └── Measure grid
            └── Score system(s)
                └── Measure editor window(s)
```

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Editor heading** | The Step 3 title area at the top of the Editor container. | **Measure header**, which belongs to one measure. |
| **Notation legend** | The compact explanation of short notes, sustain marks, and key tonic beside the Editor heading. | “Palette”; it is informational, not an input tool. |
| **Spacing controls** | The row containing “Measures per line,” “All measure windows,” “Default measure width,” “Minimum symbol space,” and “Reset spacing.” | **General operation bar**, which edits musical content. |
| **Sticky editing controls** | The controls that remain available while the Measure viewport scrolls. | “Sticky header”; the group contains editing tools. |
| **Measure viewport** | The horizontally and vertically scrollable/pannable region through which the measures are viewed. | **Editor container**, which also includes controls outside the viewport. |
| **Measure grid** | The complete laid-out collection of score systems and Measure editor windows inside the Measure viewport. | **Measure viewport**, which is the viewing region rather than its content. |
| **Score system** | One horizontal group of measures. A Jianpu `@` begins a new explicit score system. | “Staff”; one system contains multiple notation layers. |
| **Measure editor window** | One rounded, individually resizable editing card representing a single measure and all of its display layers. Short form: **measure window**. | “Measure box,” “staff window,” or “editor window” without qualification. |
| **Measure resize handle** | The diagonal handle at the lower-right of one Measure editor window. | **Editor-container resize handle**. |
| **Measure header** | The tinted top strip of a Measure editor window. It contains the measure label and Capacity meter. | **Editor heading**. |
| **Measure label** | The visible “Measure N” text, with “pickup” or “pickup ending” when applicable. | “Measure title.” It no longer repeats beat counts. |
| **Capacity meter** | The segmented green/orange/red duration-validation graphic in the Measure header. | “Health bar” or “progress bar”; it represents rhythmic capacity, not task progress. |
| **Alignment guide** | A thin, faint, dotted vertical line through a Jianpu note’s authoritative horizontal anchor. | “Grid line” when referring to this note-specific guide. |

## Display layers inside a Measure editor window

The standard top-to-bottom order is fixed:

| Order | Preferred term | Definition |
| ---: | --- | --- |
| 1 | **Jianpu layer** or **numeric-notation layer** | Numeric melody notes, rests, octave marks, duration marks, connectors, and Jianpu barline symbols. |
| 2 | **Treble-staff layer** | The five-line staff used by Soprano and Alto. |
| 3 | **Chinese-lyrics layer** | Traditional Chinese characters aligned to Jianpu anchors. |
| 4 | **English-lyrics layer** | English sung syllables aligned to Soprano rhythmic positions. |
| 5 | **Bass-staff layer** | The five-line staff used by Tenor and Bass. |

Additional layer vocabulary:

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Notation layer** | Any music-symbol layer, especially Jianpu, treble staff, or bass staff. | Do not use as a synonym for the entire Measure editor window. |
| **Lyric layer** | The complete Chinese- or English-lyrics row. | **Lyric assignment**, which is one token-to-note relationship. |
| **Staff range group** | Lower, Center, or Upper visible five-line pitch range for a staff. | “Octave setting”; changing the group does not transpose notes. |
| **Ledger line** | A short line drawn for a staff note just outside the five central staff lines. | “Extra staff.” |

## Jianpu objects and terminology

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Jianpu note** | A pitched numeric event, normally degree 1–7. | “Number” when rhythmic/pitch behavior matters. |
| **Jianpu rest** or **numeric rest** | A `0` event with its own duration. | **Sustain mark**; a rest is silence, not held sound. |
| **Jianpu anchor** | The rendered center of a Jianpu note. It is the authoritative horizontal alignment target for Soprano and Chinese. | “Cell center”; asymmetric content can make the cell center different. |
| **Octave mark** | Dot(s) above or below a Jianpu degree indicating register. | **Duration dot**, which changes length. |
| **Duration underline** | One or more horizontal lines below a Jianpu symbol indicating shortened duration. | **Staff beam**, although the rhythmic idea is related. |
| **Connected underline** | One continuous duration underline spanning a grouped run of short Jianpu notes. | “Beam” when discussing the Jianpu rendering. |
| **Duration dot** | A dot that lengthens a note by half of its base duration. | **Octave mark**. |
| **Sustain mark** or **prolongation mark** | The `−` symbol representing one additional held beat. **Sustain mark** is preferred in normal prose; **prolongation** may be used where the UI already uses it. | “Dash” or “rest.” |
| **Connector** | The curved MusicXML slur added across a chosen Jianpu-note span. | “Tie” unless the connected notes truly represent the same held pitch. |
| **Connector-stop note** | A later note that completes a connector and does not necessarily begin a new Chinese syllable. | “Silent note”; it still sounds. |
| **Jianpu barline symbol** | A repeat, double, or final symbol contained within the Jianpu layer. | **Staff barline**, which is drawn independently. |
| **Pickup measure** | An opening incomplete measure whose expected duration is the configured pickup duration. | “Underfull measure”; a valid pickup is not an error. |
| **Pickup ending** | A complementary ending measure associated with a pickup. | “Overfull/underfull” without checking its complementary role. |

## Staff-notation objects and terminology

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **SATB staff notation** | The four staff voices: Soprano, Alto, Tenor, and Bass. | “Soprano staff” for the entire four-voice layer. |
| **Staff note** | One pitched event belonging to a staff voice. | **Jianpu note**. |
| **Staff rest** | A silence event belonging to a staff voice. | **Jianpu rest**. |
| **Staff voice** | Soprano, Alto, Tenor, or Bass. | “Staff”; two voices may share the same staff layer. |
| **Treble staff** | The staff shared by Soprano and Alto. | “Soprano staff,” unless specifically discussing Soprano notes. |
| **Bass staff** | The staff shared by Tenor and Bass. | “Base staff”; **bass** is the correct musical spelling. |
| **Staff beam** | The thick bar connecting eligible consecutive short staff notes. | **Connected underline**, which belongs to Jianpu. |
| **Beam group** | The inclusive group of staff notes joined by one Staff beam. | “Connector”; connectors are curved slurs. |
| **Accidental** | A sharp, flat, or natural applying to a staff/Jianpu pitch. | **Key signature symbol**, which belongs to the key signature. |
| **Notehead** | The oval part of a Staff note. | “Staff symbol” when its position relative to an accidental matters. |
| **Stem** | The vertical line attached to a Staff note. | **Beam**. |
| **Staff barline** | The line(s) ending a treble or bass staff in a measure. | **Jianpu barline symbol**. |
| **Generated Soprano** | Soprano notes created from the corrected Jianpu melody. | “Automatic SATB”; only Soprano is generated. |

## Lyrics and alignment objects

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Chinese character** | One Traditional Chinese lyric character displayed in the Chinese-lyrics layer. | “Chinese syllable” when discussing the visible token; sung behavior may span notes. |
| **English syllable** | One sung English token prepared using lyric hyphenation. | “Word” because one word may contain several sung syllables. |
| **Lyric source text** | The complete Chinese or English verse stored in its text box and file metadata. | **Lyric assignment**. |
| **Lyric token** | One selectable Chinese character or English syllable in the Lyric-token palette. | “Letter.” |
| **Lyric-token palette** | The selectable collection of prepared lyric tokens. | **Staff-entry palette**. |
| **Lyric assignment** | A stored association between one Lyric token and one rhythmic note/event. | “Alignment guide,” which is only visual. |
| **Shift anchor** | The first assigned lyric whose assignment, together with all following assignments, will move left or right. | “Selected note.” |
| **Auto-alignment** | Automatic assignment of Chinese characters to eligible Jianpu anchors under the documented count rules. | “Import lyrics”; source text loading and assignment are separate operations. |
| **Aligned** | Sharing the intended authoritative horizontal anchor. | “Near,” “centered in the window,” or “visually close.” |

## Sidebar panels and editing controls

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Jianpu-entry panel** | Sidebar panel for hymn selection, key/meter/pickup/tempo, Direct-Entry text, and notation preview update. | “Numeric layer”; this is an input panel, not the rendered layer. |
| **Key-signature picker** | Interactive treble/bass staff area used to reproduce a printed key signature. | **Staff-entry palette**; it defines the key, not melody notes. |
| **Key-signature staff window** | One clickable treble or bass staff inside the Key-signature picker. | **Measure editor window**. |
| **Score-information controls** | Key signature, time signature, pickup, and tempo inputs. | “Layout settings”; these alter musical metadata. |
| **Jianpu Direct-Entry field** | The “Numeric notation” text area containing the parseable Jianpu stream. | **Jianpu layer**, which is its rendered result. |
| **Lyric-preparation panel** | Sidebar panel containing language tabs, lyric source text, token preparation, and—in English mode—staff-entry controls. | “Lyric layer.” |
| **Language tabs** | The 中文 and English tabs that select Editor mode. | “Visibility tabs”; inactive layers remain visible. |
| **Staff-entry palette** | English-mode controls for voice, range group, action, note value, accidental, Soprano generation, and staff operations. | **Lyric-token palette**. |
| **Staff-note operation controls** | Selected-note operation menu and its Apply button. | **General operation bar**. |
| **Staff-beaming controls** | “Beam Notes” and “Remove Beam.” | “Connector controls.” |
| **Check-and-save panel** | Sidebar panel containing validation status and save/export actions. | “Output folder.” |
| **Validation summary** | The current score-level report of detected issues. | **Capacity meter**, which reports one measure graphically. |
| **Status message** | Immediate textual feedback about the most recent action. | **Validation summary**. |
| **Note inspector** | Contextual controls for the selected Jianpu note, including length, rests, connector span, sustain conversion, and first-note position. | **General operation bar**. |
| **General operation bar** | Layer/operation/target/operand controls plus Apply and edit history. This is the former “generic operation bar.” | “Toolbar” without qualification. |
| **Operation layer** | The selected target category in the General operation bar: numeric notation, Chinese lyrics, or English lyrics. | **Display layer**; all display layers remain present. |
| **Operation target** | Previous, current, or next symbol relative to the selection. | **Jianpu anchor**. |
| **Operation operand** | The notation symbol, Chinese character, or English syllable used by an operation. | “Target.” |
| **Edit history controls** | Undo and Redo controls for the session-wide history. | “Save history”; undo state is not file versioning. |

## Spacing and window controls

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Measures per line** | The requested number of Measure editor windows in each Score system, or Automatic wrapping. | “Number of measures”; it does not change score content. |
| **All measure windows** | The fine-adjustment slider that assigns one width to every current Measure editor window. | **Default measure width**. |
| **Default measure width** | The baseline width used by automatic layout and measures without individual overrides. | **All measure windows**, which actively gives every current measure a common override. |
| **Individual measure width** | A width override belonging to one Measure editor window. | **Default measure width**. |
| **Minimum symbol space** | The minimum horizontal room allocated to an event before the measure’s content must scroll. | “Minimum screen size” or “minimum measure width.” |
| **First-note offset** | A saved left/right adjustment to the first Jianpu note of one measure. | **Measure margin**; later content is redistributed from the same rhythmic layout. |
| **Reset spacing** | The action that clears score-specific layout overrides and returns to responsive defaults for the current environment. | “Reset score”; it must not remove musical content. |

## Capacity-meter vocabulary

| Preferred term | Definition |
| --- | --- |
| **Expected duration** | The measure’s allowed rhythmic capacity, or the configured pickup duration for a pickup. |
| **Entered duration** | The sum of the rhythmic events currently present in the measure. |
| **Complete measure** | Entered duration equals Expected duration within validation tolerance. |
| **Underfull measure** | Entered duration is shorter than Expected duration. |
| **Overfull measure** | Entered duration exceeds Expected duration. |
| **Correct-duration segment** | Bright-green Capacity-meter portion representing correctly occupied duration. |
| **Missing-duration segment** | Orange Capacity-meter portion representing absent duration. |
| **Excess-duration segment** | Red proportional extension representing extra duration. |
| **Beat divider** | Thin white line marking a beat boundary within the Capacity meter. |

## Working state, saved data, and files

| Preferred term | Definition | Avoid or distinguish from |
| --- | --- | --- |
| **Working state** | The complete in-memory values and edits for the currently open score. | “Defaults”; current controls must build on Working state. |
| **Layout state** | Current spacing, widths, offsets, staff range groups, wrapping, and Editor-container dimensions. | “MusicXML notation”; layout state does not alter pitch/rhythm. |
| **Layout profile** | Saved Layout state associated with one display environment. | “Machine profile”; no machine or account identity is stored. |
| **Display environment** | Available screen dimensions plus display scale used to select a Layout profile. | “User” or “computer name.” |
| **Clean defaults** | The starting Layout state for a new hymn, file without Workbench layout data, or unknown Display environment. | “Last-used settings”; there is no cross-hymn browser preference. |
| **Working copy** | A saved MusicXML file containing the current musical data and Workbench metadata. | “Original”; the imported source is not overwritten. |
| **Revised MusicXML** | The exported score file produced by the Workbench. | **Alignment-review file**. |
| **Alignment-review file** | Exported JSON intended for reviewing assignments and Workbench data. | “MusicXML export.” |
| **Workbench metadata** | The embedded `hymn-play-satb-json` data that preserves lyrics, assignments, staff work, and layout. | Standard MusicXML note streams; some Workbench staff data is currently application-specific. |

## Preferred action wording

Use verbs consistently:

- **Open** a MusicXML file.
- **Load** a hymn or verse from local hymn data.
- **Update** the notation preview from the Jianpu Direct-Entry field.
- **Generate** Soprano from corrected Jianpu.
- **Prepare** lyric tokens/syllables.
- **Assign** a Lyric token to a note.
- **Align** components to a shared Jianpu anchor.
- **Select** an existing symbol or note for editing.
- **Apply** an operation.
- **Resize** the Editor container or a Measure editor window.
- **Pan/scroll** the Measure viewport.
- **Save** a Working copy.
- **Export** Revised MusicXML or an Alignment-review file.
- **Reset spacing** to clear layout overrides.

## Terms that should not be used interchangeably

- **Editor container** ≠ **Measure viewport** ≠ **Measure editor window**
- **Editor-container resize handle** ≠ **Measure resize handle**
- **Default measure width** ≠ **All measure windows** ≠ **Individual measure width**
- **Jianpu anchor** ≠ event-cell center
- **Connected underline** ≠ **Staff beam** ≠ **Connector**
- **Duration dot** ≠ **Octave mark**
- **Jianpu rest** ≠ **Sustain mark**
- **Key-signature symbol** ≠ explicit **Accidental**
- **Lyric source text** ≠ **Lyric token** ≠ **Lyric assignment**
- **Chinese mode/English mode** ≠ display-layer visibility
- **Layout state** ≠ musical score data
- **Capacity meter** ≠ progress bar
- **Bass** ≠ “base”

## Adding future terminology

When a new component is introduced, add:

1. one preferred singular name;
2. a short definition stating its boundary and purpose;
3. its parent component in the hierarchy;
4. any easily confused neighboring term;
5. the exact visible label, if it has one; and
6. a plural form only when it is not obvious.

If an existing term changes, update this document, `FEATURE-NOTES.md`, visible
interface labels, accessibility labels, and the future user manual together.

