PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE schema_info (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_name TEXT NOT NULL CHECK (schema_name = 'display-records'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

CREATE TABLE migrations (
  migration_id TEXT PRIMARY KEY,
  from_version INTEGER NOT NULL,
  to_version INTEGER NOT NULL,
  started_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  backup_path TEXT NOT NULL,
  backup_hash TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('started','committed','rolled_back','restored')),
  CHECK (to_version > from_version)
) STRICT;

CREATE TABLE congregations (
  congregation_id TEXT PRIMARY KEY,
  display_name_snapshot TEXT NOT NULL,
  timezone TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

CREATE TABLE gatherings (
  gathering_id TEXT PRIMARY KEY,
  congregation_id TEXT REFERENCES congregations(congregation_id),
  display_name TEXT,
  timezone TEXT NOT NULL,
  opened_at_ms INTEGER NOT NULL CHECK (opened_at_ms >= 0),
  closed_at_ms INTEGER CHECK (closed_at_ms IS NULL OR closed_at_ms >= opened_at_ms),
  opened_by_actor_id TEXT NOT NULL,
  opened_by_actor_snapshot TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','closed','interrupted')),
  application_version TEXT NOT NULL,
  opening_release_id TEXT NOT NULL
) STRICT;

CREATE TABLE hymn_selections (
  selection_id TEXT PRIMARY KEY,
  gathering_id TEXT NOT NULL REFERENCES gatherings(gathering_id),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  selected_at_ms INTEGER NOT NULL CHECK (selected_at_ms >= 0),
  selected_by_actor_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  hymn_id TEXT NOT NULL,
  hymn_number_snapshot TEXT NOT NULL,
  title_zh_hant_snapshot TEXT,
  title_zh_hans_snapshot TEXT,
  title_en_snapshot TEXT,
  source_id TEXT NOT NULL,
  source_name_snapshot TEXT NOT NULL,
  collection_id TEXT NOT NULL,
  collection_name_snapshot TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  edition_name_snapshot TEXT NOT NULL,
  UNIQUE (gathering_id, sequence)
) STRICT;

CREATE TABLE presentation_occurrences (
  occurrence_id TEXT PRIMARY KEY,
  record_sequence INTEGER NOT NULL UNIQUE CHECK (record_sequence >= 1),
  gathering_id TEXT NOT NULL REFERENCES gatherings(gathering_id),
  selection_id TEXT REFERENCES hymn_selections(selection_id),
  output_id TEXT NOT NULL DEFAULT 'primary',
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  unit_kind TEXT NOT NULL CHECK (unit_kind IN ('verse','chorus','refrain','title','blank')),
  section_id TEXT,
  verse_number INTEGER CHECK (verse_number IS NULL OR verse_number >= 1),
  unit_label_snapshot TEXT,
  navigation_cause TEXT NOT NULL CHECK (navigation_cause IN ('initial','forward','backward','direct_verse','range','chorus_action','restore','system')),
  render_requested_at_ms INTEGER NOT NULL CHECK (render_requested_at_ms >= 0),
  render_confirmed_at_ms INTEGER CHECK (render_confirmed_at_ms IS NULL OR render_confirmed_at_ms >= render_requested_at_ms),
  ended_at_ms INTEGER CHECK (ended_at_ms IS NULL OR (render_confirmed_at_ms IS NOT NULL AND ended_at_ms >= render_confirmed_at_ms)),
  duration_ms INTEGER CHECK (duration_ms IS NULL OR duration_ms >= 0),
  end_reason TEXT CHECK (end_reason IS NULL OR end_reason IN ('replaced','hidden','fullscreen_exit','gathering_closed','application_shutdown','interruption_recovered','render_failed','unknown')),
  uncertain INTEGER NOT NULL DEFAULT 0 CHECK (uncertain IN (0,1)),
  release_id TEXT NOT NULL,
  application_version TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  recovery_evidence_json TEXT,
  UNIQUE (gathering_id, sequence),
  CHECK ((render_confirmed_at_ms IS NULL AND duration_ms IS NULL) OR render_confirmed_at_ms IS NOT NULL),
  CHECK ((ended_at_ms IS NULL AND duration_ms IS NULL AND end_reason IS NULL) OR (ended_at_ms IS NOT NULL AND duration_ms IS NOT NULL AND end_reason IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX one_open_occurrence_per_output
ON presentation_occurrences(gathering_id, output_id)
WHERE ended_at_ms IS NULL AND render_confirmed_at_ms IS NOT NULL;

CREATE TABLE occurrence_annotations (
  annotation_id TEXT PRIMARY KEY,
  occurrence_id TEXT NOT NULL REFERENCES presentation_occurrences(occurrence_id),
  action TEXT NOT NULL CHECK (action IN ('include','exclude')),
  actor_id TEXT NOT NULL,
  actor_snapshot TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(reason) > 0),
  annotated_at_ms INTEGER NOT NULL CHECK (annotated_at_ms >= 0),
  supersedes_annotation_id TEXT REFERENCES occurrence_annotations(annotation_id),
  idempotency_key TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE report_runs (
  report_id TEXT PRIMARY KEY,
  congregation_id TEXT,
  installation_id TEXT,
  start_local_date TEXT NOT NULL,
  end_local_date TEXT NOT NULL,
  timezone TEXT NOT NULL,
  start_utc_ms INTEGER NOT NULL,
  end_utc_exclusive_ms INTEGER NOT NULL,
  snapshot_through_record_sequence INTEGER NOT NULL CHECK (snapshot_through_record_sequence >= 0),
  policy_id TEXT NOT NULL CHECK (policy_id = 'display-qualification'),
  policy_version TEXT NOT NULL CHECK (policy_version = '1'),
  threshold_ms INTEGER NOT NULL CHECK (threshold_ms = 10000),
  generated_at_ms INTEGER NOT NULL,
  generated_by_actor_id TEXT NOT NULL,
  raw_count INTEGER NOT NULL CHECK (raw_count >= 0),
  counted_count INTEGER NOT NULL CHECK (counted_count >= 0),
  csv_hash TEXT,
  timeline_json_hash TEXT,
  status TEXT NOT NULL CHECK (status IN ('generated','partial','failed')),
  CHECK (end_utc_exclusive_ms > start_utc_ms),
  CHECK (congregation_id IS NOT NULL OR installation_id IS NOT NULL)
) STRICT;

CREATE TABLE email_send_operations (
  send_id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL REFERENCES report_runs(report_id),
  actor_id TEXT NOT NULL,
  requested_at_ms INTEGER NOT NULL,
  completed_at_ms INTEGER,
  subject_snapshot TEXT NOT NULL,
  message_snapshot TEXT NOT NULL,
  csv_hash TEXT,
  timeline_json_hash TEXT,
  provider_reference TEXT,
  status TEXT NOT NULL CHECK (status IN ('reserved','sending','sent','partial','failed','cancelled')),
  idempotency_key TEXT NOT NULL UNIQUE
) STRICT;

CREATE TABLE email_send_recipients (
  send_id TEXT NOT NULL REFERENCES email_send_operations(send_id),
  recipient_reference TEXT NOT NULL,
  masked_recipient_snapshot TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('pending','sent','failed','cancelled')),
  provider_recipient_reference TEXT,
  error_code TEXT,
  PRIMARY KEY (send_id, recipient_reference)
) STRICT, WITHOUT ROWID;

CREATE INDEX idx_gatherings_opened ON gatherings(opened_at_ms, gathering_id);
CREATE INDEX idx_selections_gathering_time ON hymn_selections(gathering_id, selected_at_ms);
CREATE INDEX idx_occurrences_gathering_sequence ON presentation_occurrences(gathering_id, sequence);
CREATE INDEX idx_occurrences_record_sequence ON presentation_occurrences(record_sequence);
CREATE INDEX idx_occurrences_render_time ON presentation_occurrences(render_confirmed_at_ms, occurrence_id);
CREATE INDEX idx_annotations_occurrence_time ON occurrence_annotations(occurrence_id, annotated_at_ms);
CREATE INDEX idx_reports_scope_time ON report_runs(congregation_id, start_utc_ms, end_utc_exclusive_ms);
CREATE INDEX idx_email_report_time ON email_send_operations(report_id, requested_at_ms);

PRAGMA user_version = 1;
COMMIT;
