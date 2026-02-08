-- Migration: Add reply columns to messages table
-- This allows replies to be stored as separate fields instead of embedded in content

-- Add reply columns to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_anon_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_content TEXT;

-- Add index on reply_to_id for faster lookups when scrolling to replied messages
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);
