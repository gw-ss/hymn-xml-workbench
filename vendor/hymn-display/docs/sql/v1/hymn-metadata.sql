PRAGMA foreign_keys = ON;
BEGIN IMMEDIATE;

CREATE TABLE schema_info (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_name TEXT NOT NULL CHECK (schema_name = 'hymn-metadata'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

CREATE TABLE metadata_documents (
  hymn_id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  edition_id TEXT NOT NULL,
  hymn_number TEXT NOT NULL,
  expected_content_revision INTEGER NOT NULL CHECK (expected_content_revision >= 1),
  expected_content_hash TEXT NOT NULL CHECK (expected_content_hash GLOB 'sha256:*' AND length(expected_content_hash) = 71),
  metadata_revision INTEGER NOT NULL CHECK (metadata_revision >= 1),
  metadata_hash TEXT NOT NULL CHECK (metadata_hash GLOB 'sha256:*' AND length(metadata_hash) = 71),
  publication_state TEXT NOT NULL CHECK (publication_state IN ('active','disabled')),
  source_filename TEXT NOT NULL,
  source_file_hash TEXT NOT NULL CHECK (source_file_hash GLOB 'sha256:*' AND length(source_file_hash) = 71),
  normalized_json TEXT NOT NULL,
  imported_at_ms INTEGER NOT NULL CHECK (imported_at_ms >= 0),
  imported_by_actor_id TEXT NOT NULL
) STRICT;

CREATE TABLE metadata_operations (
  operation_id TEXT PRIMARY KEY,
  hymn_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('create','replace','disable','enable','purge_request','no_op')),
  expected_revision INTEGER NOT NULL CHECK (expected_revision >= 0),
  prior_revision INTEGER CHECK (prior_revision IS NULL OR prior_revision >= 1),
  result_revision INTEGER CHECK (result_revision IS NULL OR result_revision >= 1),
  input_hash TEXT NOT NULL CHECK (input_hash GLOB 'sha256:*' AND length(input_hash) = 71),
  result_hash TEXT CHECK (result_hash IS NULL OR (result_hash GLOB 'sha256:*' AND length(result_hash) = 71)),
  actor_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL CHECK (occurred_at_ms >= 0),
  outcome TEXT NOT NULL CHECK (outcome IN ('applied','no_change','rejected','conflict')),
  reason TEXT
) STRICT;

CREATE TABLE curated_categories (
  category_id TEXT PRIMARY KEY,
  scope_collection_id TEXT,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','disabled','merged')),
  merged_into_category_id TEXT REFERENCES curated_categories(category_id),
  source_path_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_path_json)),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  CHECK ((lifecycle_state = 'merged') = (merged_into_category_id IS NOT NULL)),
  CHECK (merged_into_category_id IS NULL OR merged_into_category_id <> category_id)
) STRICT;

CREATE TABLE curated_category_names (
  category_id TEXT NOT NULL REFERENCES curated_categories(category_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority = 'administrator_confirmed'),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  provenance_json TEXT,
  PRIMARY KEY (category_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE curated_tags (
  tag_id TEXT PRIMARY KEY,
  scope_collection_id TEXT,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','disabled','merged')),
  merged_into_tag_id TEXT REFERENCES curated_tags(tag_id),
  source_path_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_path_json)),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  CHECK ((lifecycle_state = 'merged') = (merged_into_tag_id IS NOT NULL)),
  CHECK (merged_into_tag_id IS NULL OR merged_into_tag_id <> tag_id)
) STRICT;

CREATE TABLE curated_tag_names (
  tag_id TEXT NOT NULL REFERENCES curated_tags(tag_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority = 'administrator_confirmed'),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  provenance_json TEXT,
  PRIMARY KEY (tag_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_curated_categories (
  hymn_id TEXT PRIMARY KEY REFERENCES metadata_documents(hymn_id),
  category_id TEXT NOT NULL REFERENCES curated_categories(category_id)
) STRICT;

CREATE TABLE hymn_curated_tags (
  hymn_id TEXT NOT NULL REFERENCES metadata_documents(hymn_id),
  tag_id TEXT NOT NULL REFERENCES curated_tags(tag_id),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  PRIMARY KEY (hymn_id, tag_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE deletion_receipts (
  receipt_id TEXT PRIMARY KEY,
  hymn_id TEXT NOT NULL UNIQUE,
  source_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL CHECK (occurred_at_ms >= 0),
  reason TEXT NOT NULL CHECK (length(reason) > 0),
  prior_metadata_revision INTEGER,
  prior_metadata_hash TEXT,
  receipt_hash TEXT NOT NULL CHECK (receipt_hash GLOB 'sha256:*' AND length(receipt_hash) = 71),
  CHECK (prior_metadata_revision IS NULL OR prior_metadata_revision >= 1),
  CHECK (prior_metadata_hash IS NULL OR (prior_metadata_hash GLOB 'sha256:*' AND length(prior_metadata_hash) = 71))
) STRICT;

CREATE TABLE classification_merge_receipts (
  receipt_id TEXT PRIMARY KEY,
  classification_type TEXT NOT NULL CHECK (classification_type IN ('category','tag')),
  retired_id TEXT NOT NULL,
  surviving_id TEXT NOT NULL,
  affected_references_json TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  occurred_at_ms INTEGER NOT NULL CHECK (occurred_at_ms >= 0),
  reason TEXT NOT NULL,
  receipt_hash TEXT NOT NULL CHECK (receipt_hash GLOB 'sha256:*' AND length(receipt_hash) = 71),
  CHECK (retired_id <> surviving_id)
) STRICT;

CREATE INDEX idx_metadata_state_hymn ON metadata_documents(publication_state, hymn_id);
CREATE INDEX idx_operations_hymn_time ON metadata_operations(hymn_id, occurred_at_ms);
CREATE INDEX idx_operations_outcome_time ON metadata_operations(outcome, occurred_at_ms);
CREATE UNIQUE INDEX uq_curated_category_name_scope_language
ON curated_category_names(language, name, category_id);
CREATE UNIQUE INDEX uq_curated_tag_name_scope_language
ON curated_tag_names(language, name, tag_id);
CREATE INDEX idx_hymn_curated_tags_tag_hymn ON hymn_curated_tags(tag_id, hymn_id);

PRAGMA user_version = 1;
COMMIT;
