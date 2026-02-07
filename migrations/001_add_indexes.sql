-- Database Indexes Migration
-- Created: 2025-10-15
-- Purpose: Add indexes for better query performance

-- Index for telegram ID lookups (used in authentication)
-- getUserByTgId is a very common operation
CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);

-- Index for display name lookups (case-insensitive)
-- Used in username availability checks
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(LOWER(display_name));

-- Composite index for message queries
-- Most common query: get messages by room, ordered by time
-- Using DESC because we query latest messages first
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);

-- Index for user_id in messages (for joins and user message history)
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);

-- Index for room name lookups (getOrCreateGlobalRoom)
CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);

-- Note: users.id is already indexed as primary key
-- Note: rooms.id is already indexed as primary key
-- Note: messages.id is already indexed as primary key
