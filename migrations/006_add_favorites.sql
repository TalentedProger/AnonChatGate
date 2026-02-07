-- Create favorites table for user favorites system
-- Users can add only 1 favorite per month

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  favorite_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  month_key TEXT NOT NULL
);

-- Create unique index to enforce 1 favorite per user per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_user_month ON favorites(user_id, month_key);

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorite_user_id ON favorites(favorite_user_id);
