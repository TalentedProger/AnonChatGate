-- Add read receipts fields to messages table
-- Migration: 002_add_read_receipts

-- Add delivered_to column (array of user IDs who received the message)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS delivered_to integer[];

-- Add read_by column (array of user IDs who read the message)
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS read_by integer[];

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_delivered_to ON messages USING GIN (delivered_to);
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN (read_by);

-- Initialize existing messages with empty arrays
UPDATE messages
SET delivered_to = ARRAY[]::integer[],
    read_by = ARRAY[]::integer[]
WHERE delivered_to IS NULL OR read_by IS NULL;
