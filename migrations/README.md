# Database Migrations

This directory contains SQL migration files for the AnonChatGate database.

## Applying Migrations

### Using psql (Recommended)

```bash
# Apply all migrations
psql $DATABASE_URL -f migrations/001_add_indexes.sql

# Or connect to the database first
psql $DATABASE_URL
\i migrations/001_add_indexes.sql
```

### Using node-postgres

```bash
# Using the apply-migrations script
npm run db:migrate
```

## Verifying Indexes

After applying migrations, verify that indexes were created:

```sql
-- List all indexes on a table
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'users';

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'messages';

SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'rooms';
```

## Testing Performance

Test query performance with EXPLAIN ANALYZE:

```sql
-- Test message query performance
EXPLAIN ANALYZE 
SELECT * FROM messages 
WHERE room_id = 1 
ORDER BY created_at DESC 
LIMIT 50;

-- Should show "Index Scan" not "Seq Scan"

-- Test user lookup by telegram ID
EXPLAIN ANALYZE 
SELECT * FROM users 
WHERE tg_id = 123456789;

-- Test username availability check
EXPLAIN ANALYZE 
SELECT * FROM users 
WHERE LOWER(display_name) = 'testuser';
```

## Migration Files

- `001_add_indexes.sql` - Initial database indexes for performance optimization
  - Users table: tg_id, display_name (case-insensitive)
  - Messages table: (room_id, created_at DESC), user_id
  - Rooms table: name

## Best Practices

1. **Always backup** your database before applying migrations
2. **Test migrations** in development first
3. **Use transactions** for complex migrations (BEGIN/COMMIT/ROLLBACK)
4. **Monitor performance** after applying indexes
5. **Document changes** in this README

## Rollback

If you need to remove indexes:

```sql
DROP INDEX IF EXISTS idx_users_tg_id;
DROP INDEX IF EXISTS idx_users_display_name;
DROP INDEX IF EXISTS idx_messages_room_created;
DROP INDEX IF EXISTS idx_messages_user;
DROP INDEX IF EXISTS idx_rooms_name;
```
