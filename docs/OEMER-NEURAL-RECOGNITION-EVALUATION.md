# Oemer Neural Recognition Evaluation

Date: 2026-09-01

## Purpose

Evaluate whether Oemer can provide reusable neural evidence for the Hymn XML Workbench photo-recognition pipeline. The source image and Hymn 1 XML were not modified.

## Test input

- Source: `Hymn-001-A.tiff`
- Lossless PNG working copy: `dev-artifacts/oemer-hymn-001-a/Hymn-001-A.png`
- Neural-input copy: `dev-artifacts/oemer-hymn-001-a/Hymn-001-A-neural-input.png`
- Five large, near-solid lyric-redaction rectangles were detected and replaced with nearby background only in the neural-input copy.
- Jianpu, staff systems, notes, beams, barlines, accidentals, and other music marks were retained.

## Environment

- Oemer 0.1.5 in the isolated `.venv-oemer` environment
- ONNX Runtime CPU execution for the repeatable comparison run
- Oemer's neural checkpoints were used without retraining

## Results

Both Oemer neural networks completed. They produced evidence masks for:

- staff lines;
- general music symbols;
- noteheads;
- stems and rests;
- clefs and accidentals.

Masking the five artificial black rectangles substantially reduced false classifications:

| Evidence class | Original input pixels | Masked input pixels | Change |
| --- | ---: | ---: | ---: |
| Staff | 60,300 | 59,983 | -0.5% |
| General symbols | 126,595 | 122,840 | -3.0% |
| Noteheads | 119,503 | 64,461 | -46.1% |
| Stems/rests | 19,573 | 12,575 | -35.8% |
| Clefs/accidentals | 65,894 | 12,760 | -80.6% |

Visual inspection confirms that the removed evidence was dominated by the artificial redaction blocks. Real SATB noteheads remain well localized. The staff mask follows the photographed, slightly curved and fuzzy five-line systems much better than the existing elementary browser heuristics, although its line mask is fragmented and must still be converted into fitted geometry before redrawing.

## Limitation found

Oemer's legacy full-score postprocessor crashes while grouping detected barlines (`bbox.find_lines`, `IndexError`). This occurs after both neural inference passes have completed and also occurs after redaction masking. Therefore, the failure does not invalidate the neural masks; it means the old end-to-end MusicXML postprocessor should not be our authoritative XML generator.

## Architecture decision

Use Oemer as a neural evidence provider, not as the final decision maker:

1. Preserve the original photo.
2. Create a derived neural-input image and mask only confidently detected non-musical redaction blocks.
3. Obtain Oemer evidence masks.
4. Fit staff, barline, stem, beam, and note geometry in the Workbench recognition layer.
5. Align recognized events to the corrected Jianpu/Soprano timing grid.
6. Compare photo evidence with harmonic/range inference.
7. Red-line measures containing conflicts or insufficient evidence.
8. Write only accepted or user-corrected evidence to MusicXML.

The corrected Jianpu, Chinese lyrics, and Soprano notes remain semantic ground truth. The staff photo remains ground truth for Alto/Tenor/Bass symbols and photographed geometry such as beam direction. Inference verifies and flags; it does not silently invent missing photo content.

## Development utilities

- `scripts/mask-solid-redactions.py`: makes the conservative neural-input copy and writes a detection report.
- `scripts/export-oemer-cache.py`: exports Oemer cache layers as masks, an overlay, and a JSON report.

Generated caches and images are development artifacts and should not be committed as application data.
