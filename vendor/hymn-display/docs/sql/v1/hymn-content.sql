PRAGMA foreign_keys = ON;

BEGIN IMMEDIATE;

CREATE TABLE schema_info (
  singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
  schema_name TEXT NOT NULL CHECK (schema_name = 'hymn-content'),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  contract_version TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL CHECK (created_at_ms >= 0)
) STRICT;

CREATE TABLE releases (
  release_id TEXT PRIMARY KEY,
  release_version TEXT NOT NULL,
  manifest_hash TEXT NOT NULL CHECK (manifest_hash GLOB 'sha256:*' AND length(manifest_hash) = 71),
  content_contract_version TEXT NOT NULL,
  search_contract_version TEXT NOT NULL,
  alias_generator_version TEXT NOT NULL,
  built_at_ms INTEGER NOT NULL CHECK (built_at_ms >= 0),
  minimum_app_version TEXT NOT NULL
) STRICT;

CREATE TABLE sources (
  source_id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('hymnal_pdf','excel_fallback','standalone','other')),
  artifact_hash TEXT CHECK (artifact_hash IS NULL OR (artifact_hash GLOB 'sha256:*' AND length(artifact_hash) = 71))
) STRICT;

CREATE TABLE collections (
  collection_id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(source_id),
  collection_key TEXT NOT NULL,
  sequence INTEGER NOT NULL DEFAULT 0,
  UNIQUE (source_id, collection_key)
) STRICT;

CREATE TABLE collection_names (
  collection_id TEXT NOT NULL REFERENCES collections(collection_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority IN ('source_confirmed','administrator_confirmed')),
  PRIMARY KEY (collection_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE editions (
  edition_id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(collection_id),
  edition_key TEXT NOT NULL,
  publication_year INTEGER,
  UNIQUE (collection_id, edition_key)
) STRICT;

CREATE TABLE edition_names (
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority IN ('source_confirmed','administrator_confirmed')),
  PRIMARY KEY (edition_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE categories (
  category_id TEXT PRIMARY KEY,
  scope_collection_id TEXT REFERENCES collections(collection_id),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind IN ('source','curated')),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','disabled')),
  source_path_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_path_json)),
  sequence INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE category_names (
  category_id TEXT NOT NULL REFERENCES categories(category_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority IN ('source_confirmed','administrator_confirmed')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  provenance_json TEXT,
  PRIMARY KEY (category_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE tags (
  tag_id TEXT PRIMARY KEY,
  scope_collection_id TEXT REFERENCES collections(collection_id),
  provenance_kind TEXT NOT NULL CHECK (provenance_kind IN ('source','curated')),
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('active','disabled')),
  source_path_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(source_path_json)),
  sequence INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE tag_names (
  tag_id TEXT NOT NULL REFERENCES tags(tag_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  authority TEXT NOT NULL CHECK (authority IN ('source_confirmed','administrator_confirmed')),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  provenance_json TEXT,
  PRIMARY KEY (tag_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymns (
  hymn_id TEXT PRIMARY KEY,
  release_id TEXT NOT NULL REFERENCES releases(release_id),
  source_id TEXT NOT NULL REFERENCES sources(source_id),
  collection_id TEXT NOT NULL REFERENCES collections(collection_id),
  edition_id TEXT NOT NULL REFERENCES editions(edition_id),
  hymn_number TEXT NOT NULL CHECK (length(hymn_number) > 0),
  number_sort_key TEXT NOT NULL,
  content_revision INTEGER NOT NULL CHECK (content_revision >= 1),
  content_hash TEXT NOT NULL CHECK (content_hash GLOB 'sha256:*' AND length(content_hash) = 71),
  category_id TEXT REFERENCES categories(category_id),
  chorus_model TEXT NOT NULL CHECK (chorus_model IN ('none','shared','verse_specific','grouped')),
  verse_count INTEGER NOT NULL CHECK (verse_count >= 1),
  rights_status TEXT NOT NULL CHECK (rights_status IN ('unknown','public_domain','copyrighted','licensed','permission_required','restricted')),
  UNIQUE (edition_id, hymn_number)
) STRICT;

CREATE TABLE hymn_titles (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  language TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(title) > 0),
  authority TEXT NOT NULL CHECK (authority = 'source_confirmed'),
  PRIMARY KEY (hymn_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_first_lines (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  language TEXT NOT NULL,
  first_line TEXT NOT NULL CHECK (length(first_line) > 0),
  derived_from_line_id TEXT NOT NULL,
  PRIMARY KEY (hymn_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_sections (
  section_id TEXT PRIMARY KEY,
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  kind TEXT NOT NULL CHECK (kind IN ('verse','chorus','refrain')),
  ordinal INTEGER CHECK (ordinal IS NULL OR ordinal >= 1),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  repeat_count INTEGER NOT NULL DEFAULT 1 CHECK (repeat_count >= 1),
  UNIQUE (hymn_id, sequence),
  UNIQUE (hymn_id, kind, ordinal)
) STRICT;

CREATE TABLE section_labels (
  section_id TEXT NOT NULL REFERENCES hymn_sections(section_id),
  language TEXT NOT NULL,
  label TEXT NOT NULL CHECK (length(label) > 0),
  PRIMARY KEY (section_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE lyric_lines (
  line_id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES hymn_sections(section_id),
  language TEXT NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  text TEXT NOT NULL CHECK (length(text) > 0),
  source_location_json TEXT,
  UNIQUE (section_id, language, sequence)
) STRICT;

CREATE TABLE verse_chorus_assignments (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  verse_section_id TEXT NOT NULL REFERENCES hymn_sections(section_id),
  chorus_section_id TEXT NOT NULL REFERENCES hymn_sections(section_id),
  sequence INTEGER NOT NULL CHECK (sequence >= 1),
  repeat_count INTEGER NOT NULL DEFAULT 1 CHECK (repeat_count >= 1),
  PRIMARY KEY (verse_section_id, sequence),
  UNIQUE (verse_section_id, chorus_section_id, sequence)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_tags (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  tag_id TEXT NOT NULL REFERENCES tags(tag_id),
  assignment_authority TEXT NOT NULL CHECK (assignment_authority IN ('source_confirmed','administrator_confirmed')),
  sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hymn_id, tag_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE melodies (
  melody_id TEXT PRIMARY KEY,
  digits TEXT NOT NULL CHECK (digits NOT GLOB '*[^0-9]*' AND length(digits) BETWEEN 1 AND 20),
  provenance_json TEXT,
  lifecycle_state TEXT NOT NULL CHECK (lifecycle_state IN ('confirmed','unreviewed','disabled'))
) STRICT;

CREATE TABLE hymn_melodies (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  melody_id TEXT NOT NULL REFERENCES melodies(melody_id),
  applies_to TEXT NOT NULL DEFAULT 'hymn' CHECK (applies_to IN ('hymn','chorus')),
  section_id TEXT REFERENCES hymn_sections(section_id),
  sequence INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (hymn_id, melody_id),
  CHECK ((applies_to = 'hymn' AND section_id IS NULL) OR (applies_to = 'chorus' AND section_id IS NOT NULL))
) STRICT, WITHOUT ROWID;

CREATE TABLE search_aliases (
  alias_id TEXT PRIMARY KEY,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('hymn_title','hymn_first_line','category_name','tag_name')),
  owner_id TEXT NOT NULL,
  field_language TEXT NOT NULL,
  alias_text TEXT NOT NULL CHECK (length(alias_text) > 0),
  normalized_key TEXT NOT NULL CHECK (length(normalized_key) > 0),
  generation_kind TEXT NOT NULL CHECK (generation_kind IN ('confirmed','simplified_to_traditional','traditional_to_simplified')),
  generator_version TEXT NOT NULL
) STRICT;

CREATE TABLE contributors (
  contributor_id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('author','composer','translator','arranger','editor','other')),
  evidence TEXT
) STRICT;

CREATE TABLE contributor_names (
  contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id),
  language TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(name) > 0),
  PRIMARY KEY (contributor_id, language)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_contributors (
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  contributor_id TEXT NOT NULL REFERENCES contributors(contributor_id),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  PRIMARY KEY (hymn_id, contributor_id)
) STRICT, WITHOUT ROWID;

CREATE TABLE hymn_work_dates (
  work_date_id TEXT PRIMARY KEY,
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  kind TEXT NOT NULL CHECK (kind IN ('written','composed','published','translated','arranged')),
  value TEXT,
  precision TEXT NOT NULL CHECK (precision IN ('unknown','year','month','day','range','circa')),
  evidence TEXT,
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0)
) STRICT;

CREATE TABLE hymn_narratives (
  narrative_id TEXT PRIMARY KEY,
  hymn_id TEXT NOT NULL REFERENCES hymns(hymn_id),
  narrative_type TEXT NOT NULL CHECK (narrative_type IN ('story','history')),
  language TEXT NOT NULL,
  text TEXT NOT NULL CHECK (length(text) > 0),
  citations_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(citations_json)),
  sequence INTEGER NOT NULL DEFAULT 0 CHECK (sequence >= 0),
  UNIQUE (hymn_id, narrative_type, language, sequence)
) STRICT;

CREATE TABLE hymn_rights (
  hymn_id TEXT PRIMARY KEY REFERENCES hymns(hymn_id),
  status TEXT NOT NULL CHECK (status IN ('unknown','public_domain','copyrighted','licensed','permission_required')),
  copyright_notice TEXT,
  license TEXT,
  territories_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(territories_json)),
  evidence TEXT
) STRICT;

CREATE INDEX idx_hymns_scope_number ON hymns(source_id, collection_id, edition_id, number_sort_key, hymn_number);
CREATE INDEX idx_titles_language_title ON hymn_titles(language, title);
CREATE INDEX idx_first_lines_language_text ON hymn_first_lines(language, first_line);
CREATE INDEX idx_sections_hymn_sequence ON hymn_sections(hymn_id, sequence);
CREATE INDEX idx_lines_section_language_sequence ON lyric_lines(section_id, language, sequence);
CREATE INDEX idx_hymn_tags_tag_hymn ON hymn_tags(tag_id, hymn_id);
CREATE INDEX idx_hymns_category ON hymns(category_id, hymn_id);
CREATE INDEX idx_category_names_language_name ON category_names(language, name, category_id);
CREATE INDEX idx_tag_names_language_name ON tag_names(language, name, tag_id);
CREATE UNIQUE INDEX uq_category_name_owner_language ON category_names(category_id, language);
CREATE UNIQUE INDEX uq_tag_name_owner_language ON tag_names(tag_id, language);
CREATE INDEX idx_melodies_digits ON melodies(digits);
CREATE INDEX idx_alias_lookup ON search_aliases(owner_type, field_language, normalized_key);
CREATE UNIQUE INDEX uq_alias_identity ON search_aliases(owner_type, owner_id, field_language, normalized_key, generation_kind);
CREATE INDEX idx_hymn_contributors_hymn_sequence ON hymn_contributors(hymn_id, sequence, contributor_id);
CREATE INDEX idx_hymn_work_dates_hymn_sequence ON hymn_work_dates(hymn_id, sequence, work_date_id);
CREATE INDEX idx_hymn_narratives_hymn_type_sequence ON hymn_narratives(hymn_id, narrative_type, sequence, narrative_id);

PRAGMA user_version = 1;
COMMIT;
