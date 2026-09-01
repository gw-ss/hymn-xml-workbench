# SQLite Migration Contract

Status: Phase 2 draft v1  
Updated: 2026-08-20

This directory defines how all Hymn Display System SQLite databases evolve. The three files under `../v1/` are the version-1 baselines; they are not migrations from the prototype schema.

## Migration identity and layout

Each database has its own subdirectory:

```text
migrations/
  hymn-content/
  hymn-metadata/
  display-records/
```

An ordered migration is named `NNNN_<description>.sql`, where `NNNN` is its target `PRAGMA user_version`. Published migration files are immutable. A correction receives a new version; it never replaces an applied file.

The first future migration therefore targets version 2. Each file must declare its expected source version in a leading SQL comment, execute inside a transaction where SQLite permits, and finish by setting the exact target `user_version`.

## Required runner sequence

1. Open the database with foreign keys enabled and acquire an exclusive migration lock.
2. Reject an unknown database identity, a newer schema, a missing migration, or a discontinuous version chain.
3. Close active writers and create a byte-for-byte backup beside the runtime database using a collision-safe timestamped filename.
4. Verify the backup opens, has the expected `user_version`, passes `PRAGMA quick_check`, and record its SHA-256 hash.
5. Insert a `migrations` row with outcome `started` when that table exists; otherwise retain equivalent runner evidence until the table is created.
6. Apply each required migration once, in numeric order. Use new-table/copy/swap for changes SQLite cannot safely perform in place.
7. Prove row preservation with table-specific before/after counts and stable-ID sets. Any intentional deletion requires an approved deletion receipt and must be reported separately.
8. Run `PRAGMA foreign_key_check`, `PRAGMA integrity_check`, schema-version checks, and database-specific smoke reads/writes.
9. Commit, record hashes/counts/tool version and outcome `committed`, then reopen normally.
10. On any failure, roll back. If rollback cannot restore the original file, restore the verified backup and record outcome `restored`. Never continue on a partly migrated writable database.

## Display Records preservation rules

Display Records migrations must preserve every gathering, hymn selection, presentation occurrence, annotation, report run, email-send operation, and recipient outcome unless an explicit approved retention operation—not a release upgrade—removes records. Application replacement or Hymn Content release activation must not replace this database.

New required fields must be introduced as nullable or with a deterministic backfill before becoming required. Historical title/source/collection/edition and actor snapshots remain snapshots; migrations do not rewrite them from current reference data.

## Required evidence per migration

- database identity and from/to versions;
- migration filename and SHA-256 hash;
- backup path/hash and restore test result;
- start/completion UTC instants and tool version;
- before/after row counts and stable-ID-set comparison for every retained table;
- foreign-key and integrity results;
- outcome and error detail, if any.

Executable version-1-to-version-2 migration fixtures will be added when version 2 has an approved schema change. Inventing a no-op production version solely to test the runner is prohibited; the runner itself will instead be tested against temporary synthetic schemas in Phase 4.
