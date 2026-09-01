PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE workspace_info (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_name TEXT NOT NULL CHECK (schema_name = 'hymn-conversion-workspace'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE source_artifacts (
  source_artifact_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('lyrics_pdf','tune_index_pdf')),
  filename TEXT NOT NULL,
  sha256 TEXT NOT NULL UNIQUE CHECK (sha256 GLOB 'sha256:*' AND length(sha256) = 71),
  byte_length INTEGER NOT NULL CHECK (byte_length > 0),
  page_count INTEGER NOT NULL CHECK (page_count > 0)
) STRICT;

CREATE TABLE import_runs (
  import_run_id TEXT PRIMARY KEY,
  tool_name TEXT NOT NULL,
  tool_version TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('passed','passed_with_warnings','failed'))
) STRICT;

CREATE TABLE hymn_inventory (
  hymn_number TEXT PRIMARY KEY,
  number_sort_key INTEGER NOT NULL CHECK (number_sort_key >= 0),
  lyrics_source_artifact_id TEXT REFERENCES source_artifacts(source_artifact_id),
  lyrics_page_start INTEGER CHECK (lyrics_page_start IS NULL OR lyrics_page_start > 0),
  lyrics_page_end INTEGER CHECK (lyrics_page_end IS NULL OR lyrics_page_end >= lyrics_page_start),
  candidate_state TEXT NOT NULL DEFAULT 'not_located' CHECK (candidate_state IN ('not_located','located','extracted','validation_failed','ready_for_review','needs_correction','approved','promoted')),
  approved_candidate_revision INTEGER CHECK (approved_candidate_revision IS NULL OR approved_candidate_revision >= 1)
) STRICT;

CREATE TABLE tune_index_entries (
  tune_entry_id TEXT PRIMARY KEY,
  source_artifact_id TEXT NOT NULL REFERENCES source_artifacts(source_artifact_id),
  hymn_number TEXT NOT NULL REFERENCES hymn_inventory(hymn_number),
  digits TEXT NOT NULL CHECK (digits NOT GLOB '*[^0-9]*' AND length(digits) BETWEEN 1 AND 20),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('hymn','chorus')),
  source_page INTEGER NOT NULL CHECK (source_page > 0),
  source_sequence INTEGER NOT NULL CHECK (source_sequence >= 1),
  extraction_state TEXT NOT NULL DEFAULT 'extracted' CHECK (extraction_state IN ('extracted','confirmed','rejected')),
  UNIQUE (source_artifact_id, source_sequence),
  UNIQUE (source_artifact_id, hymn_number, digits, applies_to)
) STRICT;

CREATE TABLE conversion_findings (
  finding_id INTEGER PRIMARY KEY,
  import_run_id TEXT NOT NULL REFERENCES import_runs(import_run_id),
  hymn_number TEXT REFERENCES hymn_inventory(hymn_number),
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','error')),
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  source_page INTEGER CHECK (source_page IS NULL OR source_page > 0)
) STRICT;

CREATE TABLE hymn_candidates (
  hymn_number TEXT NOT NULL REFERENCES hymn_inventory(hymn_number),
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision >= 1),
  source_artifact_id TEXT NOT NULL REFERENCES source_artifacts(source_artifact_id),
  source_page_start INTEGER NOT NULL CHECK (source_page_start > 0),
  source_page_end INTEGER NOT NULL CHECK (source_page_end >= source_page_start),
  category_path_json TEXT NOT NULL CHECK (json_valid(category_path_json)),
  derived_chorus_model TEXT NOT NULL CHECK (derived_chorus_model IN ('none','shared','verse_specific','grouped','unresolved')),
  validation_state TEXT NOT NULL CHECK (validation_state IN ('valid','quarantined','rejected')),
  candidate_hash TEXT NOT NULL CHECK (candidate_hash GLOB 'sha256:*' AND length(candidate_hash) = 71),
  import_run_id TEXT NOT NULL REFERENCES import_runs(import_run_id),
  PRIMARY KEY (hymn_number, candidate_revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE candidate_titles (
  hymn_number TEXT NOT NULL,
  candidate_revision INTEGER NOT NULL,
  language TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) > 0),
  PRIMARY KEY (hymn_number, candidate_revision, language),
  FOREIGN KEY (hymn_number, candidate_revision) REFERENCES hymn_candidates(hymn_number, candidate_revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE candidate_sections (
  section_id TEXT PRIMARY KEY,
  hymn_number TEXT NOT NULL,
  candidate_revision INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('verse','chorus','refrain')),
  ordinal INTEGER CHECK (ordinal IS NULL OR ordinal >= 1),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  source_page INTEGER NOT NULL CHECK (source_page > 0),
  UNIQUE (hymn_number, candidate_revision, sequence),
  FOREIGN KEY (hymn_number, candidate_revision) REFERENCES hymn_candidates(hymn_number, candidate_revision)
) STRICT;

CREATE TABLE candidate_lyric_lines (
  line_id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES candidate_sections(section_id),
  language TEXT NOT NULL CHECK (language IN ('zh-Hant','en')),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  text TEXT NOT NULL CHECK (length(text) > 0),
  source_page INTEGER NOT NULL CHECK (source_page > 0),
  UNIQUE (section_id, language, sequence)
) STRICT;

CREATE TABLE candidate_chorus_assignments (
  hymn_number TEXT NOT NULL,
  candidate_revision INTEGER NOT NULL,
  verse_section_id TEXT NOT NULL REFERENCES candidate_sections(section_id),
  chorus_section_id TEXT NOT NULL REFERENCES candidate_sections(section_id),
  sequence INTEGER NOT NULL DEFAULT 1 CHECK (sequence >= 1),
  PRIMARY KEY (verse_section_id, sequence),
  FOREIGN KEY (hymn_number, candidate_revision) REFERENCES hymn_candidates(hymn_number, candidate_revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE canonical_artifacts (
  hymn_number TEXT NOT NULL REFERENCES hymn_inventory(hymn_number),
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision >= 1),
  hymn_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  content_hash TEXT NOT NULL CHECK (content_hash GLOB 'sha256:*' AND length(content_hash) = 71),
  validation_state TEXT NOT NULL CHECK (validation_state IN ('valid','quarantined','rejected')),
  PRIMARY KEY (hymn_number, candidate_revision),
  UNIQUE (hymn_id, candidate_revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE metadata_artifacts (
  hymn_number TEXT NOT NULL REFERENCES hymn_inventory(hymn_number),
  metadata_revision INTEGER NOT NULL CHECK (metadata_revision >= 0),
  relative_path TEXT NOT NULL,
  artifact_hash TEXT NOT NULL CHECK (artifact_hash GLOB 'sha256:*' AND length(artifact_hash) = 71),
  PRIMARY KEY (hymn_number, metadata_revision)
) STRICT, WITHOUT ROWID;

CREATE TABLE review_decisions (
  review_id INTEGER PRIMARY KEY,
  hymn_number TEXT NOT NULL REFERENCES hymn_inventory(hymn_number),
  candidate_revision INTEGER NOT NULL CHECK (candidate_revision >= 1),
  decision TEXT NOT NULL CHECK (decision IN ('approved','needs_correction','rejected')),
  reviewer_actor_id TEXT NOT NULL,
  decided_at TEXT NOT NULL,
  notes TEXT,
  UNIQUE (hymn_number, candidate_revision)
) STRICT;

CREATE VIEW review_hymn_summary AS
SELECT
  c.hymn_number,
  i.candidate_state,
  c.candidate_revision,
  c.validation_state,
  (SELECT title FROM candidate_titles t WHERE t.hymn_number=c.hymn_number AND t.candidate_revision=c.candidate_revision AND t.language='zh-Hant') AS title_zh_hant,
  (SELECT title FROM candidate_titles t WHERE t.hymn_number=c.hymn_number AND t.candidate_revision=c.candidate_revision AND t.language='en') AS title_en,
  c.category_path_json,
  c.derived_chorus_model,
  c.source_page_start,
  c.source_page_end,
  (SELECT count(*) FROM candidate_sections s WHERE s.hymn_number=c.hymn_number AND s.candidate_revision=c.candidate_revision AND s.kind='verse') AS verse_count,
  (SELECT count(*) FROM candidate_sections s WHERE s.hymn_number=c.hymn_number AND s.candidate_revision=c.candidate_revision AND s.kind IN ('chorus','refrain')) AS chorus_count,
  (SELECT count(*) FROM conversion_findings f WHERE f.hymn_number=c.hymn_number AND f.severity='warning') AS warning_count,
  (SELECT count(*) FROM conversion_findings f WHERE f.hymn_number=c.hymn_number AND f.severity='error') AS error_count
FROM hymn_candidates c
JOIN hymn_inventory i USING (hymn_number);

CREATE VIEW review_hymn_lines AS
SELECT s.hymn_number, s.candidate_revision, s.sequence AS section_sequence,
       s.kind, s.ordinal, l.language, l.sequence AS line_sequence, l.text,
       l.source_page
FROM candidate_sections s
JOIN candidate_lyric_lines l USING (section_id);

CREATE VIEW review_tune_index AS
SELECT i.hymn_number, i.candidate_state, t.digits, t.applies_to,
       t.source_page, t.extraction_state
FROM hymn_inventory i
JOIN tune_index_entries t USING (hymn_number);

CREATE INDEX idx_inventory_state_number ON hymn_inventory(candidate_state, number_sort_key);
CREATE INDEX idx_tunes_hymn_scope ON tune_index_entries(hymn_number, applies_to, source_sequence);
CREATE INDEX idx_tunes_digits ON tune_index_entries(digits, hymn_number);
CREATE INDEX idx_findings_run_severity ON conversion_findings(import_run_id, severity, hymn_number);
CREATE INDEX idx_candidates_state_number ON hymn_candidates(validation_state, hymn_number);
CREATE INDEX idx_candidate_sections_hymn ON candidate_sections(hymn_number, candidate_revision, sequence);
CREATE INDEX idx_candidate_lines_section ON candidate_lyric_lines(section_id, language, sequence);

PRAGMA user_version = 1;
COMMIT;
