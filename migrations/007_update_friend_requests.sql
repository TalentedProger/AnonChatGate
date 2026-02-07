-- Migration: Add friend_requests table for the notifications system
-- This replaces the old friendRequests table with proper tracking

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  month_key TEXT NOT NULL, -- Format: "2025-01" for monthly tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(from_user_id, to_user_id, month_key) -- One request per user per month
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_month ON friend_requests(month_key);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
