# Jianpu Encoding Rules

This document defines the Hymn Workbench text encoding for Jianpu. The encoded
stream is a compact musical source: it records pitches, rhythm, meter, grouping,
barlines, repeats, and intended system breaks. The Workbench converts this
source into the notation preview and MusicXML.

## Meter and measures

- `{3/4}` sets the current meter. The meter remains active until another marker,
  such as `{2/4}` or `{6/8}`, changes it.
- A meter marker must appear before the first timed symbol of its measure.
- `|` ends a measure.
- `@` at the beginning of a measure requests a new notation system.
- `||` is a double barline or verse stop.
- `|:` starts a repeat and `:|` ends a repeat.
- `|]` is the final barline.

The editor reports a measure whose entered duration differs from its active
meter, but it still renders the entered symbols. This permits pickups,
complementary endings, and intentionally irregular measures without silently
rewriting the source.

Example with a persistent meter change:

```text
{3/4}531|1--|{2/4}23|1-|]
```

## Timed symbols

- `1` through `7` are scale degrees.
- `0` is a rest.
- `-` or `−` prolongs the preceding note or rest by one quarter-note unit.
- `/` halves a note's base duration; `//` quarters it.

Timed symbols are placed by musical onset. The first timed symbol begins on the
first beat guide. Later symbols are positioned from the accumulated durations
before them. Subdivisions therefore remain proportional: the second eighth note
of a beat appears halfway between adjacent quarter-note beat guides.

## Attached symbols

Attached symbols belong to a note and never receive an independent horizontal
time position:

- `.` or `·` or `*` adds a duration dot.
- `'` raises the note one octave; repeated apostrophes raise additional octaves.
- `,` lowers the note one octave; repeated commas lower additional octaves.
- `#` or `♯` sharpens the following degree.
- `b` or `♭` flattens the following degree.
- Duration underlines are generated from `/` and `//` and remain attached to
  their note or connected group.

In particular, a duration dot is drawn immediately beside its note. It changes
the note's duration but does not become a separately spaced event.

## Spanning symbols

- `(4/3/)` connects a group of short notes with a shared duration underline.
- `s(6/·1)` creates a slur from the first to the last enclosed pitched note.

Connected underlines and slurs must have matching parentheses. A connected
underline cannot cross a measure boundary. These marks span their timed
endpoints and do not alter the timing of the enclosed symbols.

## Alignment contract

Each measure uses one musical coordinate system:

1. Beat guides are generated from the active `{beats/beat-unit}` meter.
2. Jianpu symbols are placed from their accumulated musical onset.
3. Chinese lyrics reuse the exact anchor of their assigned Jianpu symbol.
4. Generated Soprano notes reuse the same Jianpu anchor.
5. Staff notation entered independently is placed from its recorded onset.

Resizing a measure changes only the scale of this coordinate system. It must not
change the musical relationship among Jianpu, lyrics, beat guides, or staff
notes.

## Compatibility

Streams created before meter markers were introduced are interpreted as `4/4`
until explicitly updated. Imported MusicXML is reconstructed with an initial
meter marker and another marker at every MusicXML time-signature change.

