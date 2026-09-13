# Database migrations

The supported migration chain lives in `migrations/active/` and is the only
directory read by `apply-migrations.js`.

- `000_baseline.sql` creates the complete schema in an empty database.
- `001_reconcile_existing.sql` upgrades the legacy production schema and adds
  the missing checks, foreign key, and unique indexes.
- SQL files `001_add_indexes.sql` through `009_add_auth_sessions.sql` in this
  directory are retained as historical records only. Do not apply them by hand.

## Commands

```bash
# Apply all pending migrations. Each file runs in its own transaction.
npm run db:migrate

# Verify checksums and report pending migrations without applying them.
npm run db:migrate:status

# Verify the journal plus required tables, columns, constraints and indexes.
npm run db:verify
```

`npm start` runs `db:migrate` before starting the server. A migration error exits
non-zero, so Render does not start a release on an unknown schema. Render's free
web-service plan has no pre-deploy command; on a paid plan, move `npm run
db:migrate` to Render's Pre-Deploy Command and change `start` back to only
`node dist/index.js`.

## Safety model

- `_app_migrations` stores the migration ID, SHA-256 checksum, execution time,
  adoption flag and timestamp.
- A PostgreSQL advisory lock prevents two deploys from migrating concurrently.
- An existing database with all three core tables (`users`, `rooms`, `messages`)
  adopts migration `000` without executing it, then runs reconciliation.
- A partially-created legacy schema (only one or two core tables) is rejected and
  requires manual inspection.
- Editing an already applied migration causes a checksum failure. Add a new
  numbered SQL file instead.
- Reconciliation checks for invalid values and duplicate keys before adding
  constraints. It fails instead of silently deleting or rewriting user data.

## Clean-schema test

For an isolated test on an existing PostgreSQL server, create a temporary schema
and set `MIGRATION_SCHEMA` to its name while running `db:migrate` and `db:verify`.
Never point destructive cleanup commands at `public`; remove only the exact
temporary schema you created.
