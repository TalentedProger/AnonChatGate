import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

const { Client } = pg;
const schema = process.env.MIGRATION_SCHEMA || 'public';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is not set');
}
if (!/^[a-z_][a-z0-9_]*$/.test(schema)) {
  throw new Error('MIGRATION_SCHEMA must be a lowercase PostgreSQL identifier');
}

const expectedColumns = {
  users: ['id', 'tg_id', 'username', 'anon_name', 'status', 'display_name', 'course', 'direction', 'bio', 'gender', 'avatar_url', 'telegram_photo_url', 'social_links', 'photos', 'profile_completed', 'created_at'],
  rooms: ['id', 'name', 'type', 'created_at'],
  messages: ['id', 'room_id', 'user_id', 'content', 'reply_to_id', 'reply_to_anon_name', 'reply_to_content', 'delivered_to', 'read_by', 'created_at'],
  profile_views: ['id', 'profile_user_id', 'viewer_user_id', 'viewed_at'],
  favorites: ['id', 'user_id', 'favorite_user_id', 'created_at', 'month_key'],
  friend_requests: ['id', 'from_user_id', 'to_user_id', 'status', 'month_key', 'created_at', 'responded_at'],
  news: ['id', 'title', 'content', 'image_url', 'author_id', 'created_at'],
  auth_sessions: ['id', 'user_id', 'refresh_token_hash', 'refresh_token_jti', 'expires_at', 'revoked_at', 'created_at', 'updated_at'],
  _app_migrations: ['id', 'checksum', 'adopted', 'execution_ms', 'applied_at'],
};

const expectedConstraints = [
  'users_status_check',
  'users_course_check',
  'users_gender_check',
  'users_profile_completed_check',
  'favorites_month_key_check',
  'friend_requests_status_check',
  'friend_requests_month_key_check',
  'messages_reply_to_id_fkey',
];

const expectedIndexes = [
  'ux_users_display_name_lower',
  'ux_rooms_single_global',
  'ux_profile_views_users',
  'ux_favorites_user_month',
  'ux_friend_requests_users_month',
  'idx_messages_room_created',
  'idx_messages_reply_to_id',
  'idx_auth_sessions_active_user',
];

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();
  const [columnsResult, constraintsResult, indexesResult, integrityResult] = await Promise.all([
    client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = $1
    `, [schema]),
    client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE connamespace = $1::regnamespace
    `, [schema]),
    client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = $1
    `, [schema]),
    client.query(`
      SELECT
        NOT EXISTS (SELECT 1 FROM users WHERE status NOT IN ('pending', 'approved', 'rejected')) AS valid_statuses,
        NOT EXISTS (SELECT 1 FROM users WHERE course IS NOT NULL AND course NOT IN ('1', '2', '3', '4', '5', '6')) AS valid_courses,
        NOT EXISTS (SELECT 1 FROM users WHERE gender IS NOT NULL AND gender NOT IN ('male', 'female')) AS valid_genders,
        NOT EXISTS (SELECT 1 FROM users WHERE profile_completed IS NOT NULL AND profile_completed NOT IN ('true', 'false')) AS valid_profile_flags,
        NOT EXISTS (SELECT 1 FROM favorites GROUP BY user_id, month_key HAVING COUNT(*) > 1) AS unique_favorites,
        NOT EXISTS (SELECT 1 FROM profile_views GROUP BY profile_user_id, viewer_user_id HAVING COUNT(*) > 1) AS unique_profile_views,
        NOT EXISTS (SELECT 1 FROM friend_requests GROUP BY from_user_id, to_user_id, month_key HAVING COUNT(*) > 1) AS unique_friend_requests,
        (SELECT COUNT(*) FROM rooms WHERE type = 'global') <= 1 AS single_global_room
    `),
  ]);

  const actualColumns = new Map();
  for (const row of columnsResult.rows) {
    const tableColumns = actualColumns.get(row.table_name) || new Set();
    tableColumns.add(row.column_name);
    actualColumns.set(row.table_name, tableColumns);
  }

  const missing = [];
  for (const [table, columns] of Object.entries(expectedColumns)) {
    const actual = actualColumns.get(table);
    if (!actual) {
      missing.push(`table:${table}`);
      continue;
    }
    for (const column of columns) {
      if (!actual.has(column)) missing.push(`column:${table}.${column}`);
    }
  }

  const constraints = new Set(constraintsResult.rows.map(row => row.conname));
  for (const constraint of expectedConstraints) {
    if (!constraints.has(constraint)) missing.push(`constraint:${constraint}`);
  }

  const indexes = new Set(indexesResult.rows.map(row => row.indexname));
  for (const index of expectedIndexes) {
    if (!indexes.has(index)) missing.push(`index:${index}`);
  }

  const integrity = integrityResult.rows[0];
  for (const [check, passed] of Object.entries(integrity)) {
    if (!passed) missing.push(`integrity:${check}`);
  }

  if (missing.length > 0) {
    throw new Error(`Database schema drift detected: ${missing.join(', ')}`);
  }

  console.log(`Database schema verified: ${Object.keys(expectedColumns).length} tables, ${expectedConstraints.length} checks/FKs, ${expectedIndexes.length} critical indexes`);
} finally {
  await client.end().catch(() => undefined);
}
