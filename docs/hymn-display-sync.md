# Hymn Display Database Sync Reminder

This is the permanent reminder for keeping Hymn Display and Hymn XML Workbench compatible. Both projects use the same runtime data, database schema, Drizzle migrations, and SQL commands.

## The one command to remember

```sh
npm run sync:hymn-display:help
```

It prints the complete reminder in the terminal.

## Commands

| What you want to do | Command | Changes files? |
|---|---|---|
| See this reminder | `npm run sync:hymn-display:help` | No |
| Determine whether the projects match | `npm run sync:hymn-display:check` | No |
| Bring Hymn Display corrections into Hymn XML Workbench | `npm run sync:hymn-display:pull` | Yes—Workbench only |
| Send Workbench corrections back to Hymn Display | `npm run sync:hymn-display:push` | Yes—Hymn Display only |

Memory aid: **check first; pull toward the Workbench; push away from the Workbench.**

## Normal correction workflow

1. Run `npm run sync:hymn-display:check`.
2. Decide which project contains the reviewed correction.
3. Use `pull` if Hymn Display is correct, or `push` if the Workbench is correct.
4. Run `npm run sync:hymn-display:check` again. It should report an exact match.
5. Review the version-control changes before committing them.

## What is synchronized

| Original Hymn Display path | Purpose |
|---|---|
| `app/data/` | Reviewed hymn JSON and search indexes |
| `db/` | Drizzle schema and database entry point |
| `drizzle/` | Executable migrations and migration metadata |
| `docs/sql/` | Versioned SQL definitions, queries, and migration guidance |
| `drizzle.config.ts` | Drizzle configuration |

Hymn XML Workbench preserves those paths under `vendor/hymn-display/`. The workbench reads its lyrics from `vendor/hymn-display/app/data/hymns-001-848.review.json`.

## Safety rules

- The check command compares managed files by SHA-256 and changes nothing.
- Synchronization copies files but never deletes files.
- Push requires an explicit internal confirmation flag to prevent accidental writes to Hymn Display.
- Do not manually reshape the mirrored schema or directory structure.
- If both projects contain different intentional corrections, review and merge them before running either copy direction.
- Set `HYMN_DISPLAY_PROJECT` only when the Hymn Display project has moved to another location.
