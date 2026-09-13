import crypto from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const { Client } = pg;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationDirectory = join(scriptDirectory, 'migrations', 'active');
const migrationSchema = process.env.MIGRATION_SCHEMA || 'public';
const statusOnly = process.argv.includes('--status');

if (!/^[a-z_][a-z0-9_]*$/.test(migrationSchema)) {
  throw new Error('MIGRATION_SCHEMA must be a lowercase PostgreSQL identifier');
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function loadMigrations() {
  const filenames = (await readdir(migrationDirectory))
    .filter(filename => /^\d{3}_[a-z0-9_]+\.sql$/.test(filename))
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length === 0) {
    throw new Error('No active migration files found');
  }

  return Promise.all(filenames.map(async filename => {
    const sql = await readFile(join(migrationDirectory, filename), 'utf8');
    const checksumInput = sql.replace(/\r\n?/g, '\n');
    return {
      id: filename.slice(0, -4),
      filename,
      sql,
      // Git may check out CRLF locally and LF on Render. Migration identity
      // must be independent of the operating system's line endings.
      checksum: crypto.createHash('sha256').update(checksumInput).digest('hex'),
    };
  }));
}

async function ensureJournal(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _app_migrations (
      id TEXT PRIMARY KEY,
      checksum VARCHAR(64) NOT NULL,
      adopted BOOLEAN NOT NULL DEFAULT FALSE,
      execution_ms INTEGER NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function coreTableCount(client) {
  const result = await client.query(`
    SELECT COUNT(*)::integer AS count
    FROM information_schema.tables
    WHERE table_schema = $1
      AND table_name IN ('users', 'rooms', 'messages')
      AND table_type = 'BASE TABLE'
  `, [migrationSchema]);
  return result.rows[0].count;
}

async function appliedMigrations(client) {
  const result = await client.query(`
    SELECT id, checksum, adopted, applied_at
    FROM _app_migrations
    ORDER BY id
  `);
  return new Map(result.rows.map(row => [row.id, row]));
}

async function recordAdoptedBaseline(client, migration) {
  await client.query(
    `INSERT INTO _app_migrations (id, checksum, adopted, execution_ms)
     VALUES ($1, $2, TRUE, 0)`,
    [migration.id, migration.checksum],
  );
  console.log(`Adopted existing schema as ${migration.filename}`);
}

async function applyMigration(client, migration) {
  const startedAt = Date.now();
  await client.query('BEGIN');
  try {
    await client.query(migration.sql);
    await client.query(
      `INSERT INTO _app_migrations (id, checksum, adopted, execution_ms)
       VALUES ($1, $2, FALSE, $3)`,
      [migration.id, migration.checksum, Date.now() - startedAt],
    );
    await client.query('COMMIT');
    console.log(`Applied ${migration.filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const migrations = await loadMigrations();
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let lockAcquired = false;

  try {
    await client.connect();
    await client.query(`SET search_path TO ${quoteIdentifier(migrationSchema)}`);
    await client.query("SELECT pg_advisory_lock(hashtext('anonchatgate:migrations'))");
    lockAcquired = true;
    await ensureJournal(client);

    let applied = await appliedMigrations(client);

    if (applied.size === 0) {
      const coreTables = await coreTableCount(client);
      if (coreTables !== 0 && coreTables !== 3) {
        throw new Error(`Partial legacy schema detected (${coreTables}/3 core tables); manual recovery required`);
      }

      if (coreTables === 3) {
        await recordAdoptedBaseline(client, migrations[0]);
        applied = await appliedMigrations(client);
      }
    }

    for (const migration of migrations) {
      const previous = applied.get(migration.id);
      if (previous) {
        if (previous.checksum !== migration.checksum) {
          throw new Error(`Checksum mismatch for applied migration ${migration.filename}`);
        }
        continue;
      }

      if (!statusOnly) {
        await applyMigration(client, migration);
      }
    }

    const finalState = await appliedMigrations(client);
    const pending = migrations.filter(migration => !finalState.has(migration.id));
    console.log(`Migration status: ${finalState.size} applied, ${pending.length} pending`);
    if (pending.length > 0) {
      console.log(`Pending: ${pending.map(migration => migration.filename).join(', ')}`);
      if (statusOnly) process.exitCode = 1;
    }
  } finally {
    if (lockAcquired) {
      await client.query("SELECT pg_advisory_unlock(hashtext('anonchatgate:migrations'))").catch(() => undefined);
    }
    await client.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
