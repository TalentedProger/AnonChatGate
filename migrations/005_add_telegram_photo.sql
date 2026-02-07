-- Add telegram_photo_url column to users table
-- This stores the real Telegram avatar for non-anonymous profile display

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;
