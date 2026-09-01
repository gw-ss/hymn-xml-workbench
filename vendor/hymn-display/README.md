# Hymn Display compatibility mirror

This directory preserves the original Hymn Display paths and file contents for the shared hymn-data contract:

- `app/data/` — reviewed runtime hymn JSON and search indexes
- `db/` — Drizzle schema and database entry point
- `drizzle/` — executable migration SQL and migration metadata
- `docs/sql/` — versioned SQL definitions, queries, and migration guidance
- `drizzle.config.ts` — the original Drizzle configuration

Do not reshape or independently reinterpret these files in Hymns Play. Corrections should retain the same schema and be transferred with the sync commands below.

| Command | Purpose |
|---|---|
| `npm run sync:hymn-display:help` | Print this command reminder in the terminal. |
| `npm run sync:hymn-display:check` | Compare every managed file by SHA-256 without changing either project. |
| `npm run sync:hymn-display:pull` | Copy changed managed files from Hymn Display into this mirror. |
| `npm run sync:hymn-display:push` | Copy changed managed files from this mirror back to Hymn Display. This command requires an explicit confirmation flag internally. |

Set `HYMN_DISPLAY_PROJECT` to use a Hymn Display checkout at a different location. Synchronization never deletes files. Review version-control diffs before committing or pushing a correction.

See [`../../docs/hymn-display-sync.md`](../../docs/hymn-display-sync.md) for the permanent workflow guide.
