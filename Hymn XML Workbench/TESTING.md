# Regression testing

Run `npm test` after every behavior change and before committing or tagging.

The automated suite covers core Jianpu conversion and duration rules, key and pitch conversion, lyric tokenization and alignment, measure capacity, exact user-authored `@` system breaks, parenthesis validation, SATB beam and spacing rules, photo quality assessment, staff-region extraction, recognition evidence and confidence, conservative dust removal and line reconstruction, plus contracts for project operations, tabs, source formats, Editor controls, project-local MusicXML saving, and photo-preparation controls.

Visual and pointer interactions must also be checked in the browser when their code changes. This includes Jianpu caret movement and wrapping, inline red parenthesis rendering, measure and workspace dragging, all four spacing controls, erasing, rotation, photo review overlays, responsive stacking, lyric-to-guide alignment, Soprano-to-guide alignment, and slur height. These checks cannot be proven by Node unit tests alone.

Every bug fix should add a reproducing automated test when its behavior can be isolated. Every new feature should add its tests in the same change. UI changes must update the contract test and receive a focused browser check of neighboring controls to catch side effects.
