import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configure WebSocket for Neon serverless
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });

// Auto-run migrations on server startup
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🔄 Running auto-migrations...');
    
    // Migration 008: Add reply columns to messages table
    await client.query(`
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_anon_name TEXT;
      ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_content TEXT;
    `);
    
    // Create index for reply lookups (ignore if exists)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);
    `);
    
    console.log('✅ Auto-migrations completed successfully');
  } catch (error) {
    console.error('⚠️ Migration warning (may be safe to ignore):', error);
  } finally {
    client.release();
  }
}