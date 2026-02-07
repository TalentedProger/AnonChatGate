import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function applyMigrations() {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  console.log('🔄 Connecting to database...');
  const client = new Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Apply migration 001
    const migration1Path = join(__dirname, 'migrations', '001_add_indexes.sql');
    const migration1Sql = readFileSync(migration1Path, 'utf8');

    console.log('🔄 Applying migration: 001_add_indexes.sql');
    await client.query(migration1Sql);
    console.log('✅ Migration 001 applied successfully');

    // Apply migration 002
    const migration2Path = join(__dirname, 'migrations', '002_add_read_receipts.sql');
    const migration2Sql = readFileSync(migration2Path, 'utf8');

    console.log('🔄 Applying migration: 002_add_read_receipts.sql');
    await client.query(migration2Sql);
    console.log('✅ Migration 002 applied successfully');

    // Apply migration 003
    const migration3Path = join(__dirname, 'migrations', '003_add_statistics_tables.sql');
    const migration3Sql = readFileSync(migration3Path, 'utf8');

    console.log('🔄 Applying migration: 003_add_statistics_tables.sql');
    await client.query(migration3Sql);
    console.log('✅ Migration 003 applied successfully');

    // Verify indexes were created
    console.log('\n📊 Verifying indexes...');
    
    const indexQuery = `
      SELECT 
        schemaname,
        tablename,
        indexname
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
      ORDER BY tablename, indexname;
    `;
    
    const result = await client.query(indexQuery);
    
    if (result.rows.length > 0) {
      console.log('\n✅ Created indexes:');
      result.rows.forEach(row => {
        console.log(`   - ${row.tablename}.${row.indexname}`);
      });
    } else {
      console.log('⚠️  No custom indexes found');
    }

    console.log('\n✅ Database migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyMigrations();
