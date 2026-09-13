-- Bring a legacy database up to the canonical schema without deleting user data.
-- Preconditions are deliberately strict: conflicting data aborts this migration.

ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_photo_url TEXT;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS delivered_to INTEGER[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by INTEGER[];
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id INTEGER;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_anon_name TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_content TEXT;

CREATE TABLE IF NOT EXISTS profile_views (
  id SERIAL PRIMARY KEY,
  profile_user_id INTEGER NOT NULL REFERENCES users(id),
  viewer_user_id INTEGER NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  favorite_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  month_key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  month_key TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP
);

ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS month_key TEXT;
ALTER TABLE friend_requests ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP;
UPDATE friend_requests
SET month_key = TO_CHAR(created_at, 'YYYY-MM')
WHERE month_key IS NULL;
ALTER TABLE friend_requests ALTER COLUMN month_key SET NOT NULL;

CREATE TABLE IF NOT EXISTS news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
  refresh_token_jti UUID NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM users WHERE status NOT IN ('pending', 'approved', 'rejected')
  ) OR EXISTS (
    SELECT 1 FROM users WHERE course IS NOT NULL AND course NOT IN ('1', '2', '3', '4', '5', '6')
  ) OR EXISTS (
    SELECT 1 FROM users WHERE gender IS NOT NULL AND gender NOT IN ('male', 'female')
  ) OR EXISTS (
    SELECT 1 FROM users WHERE profile_completed IS NOT NULL AND profile_completed NOT IN ('true', 'false')
  ) THEN
    RAISE EXCEPTION 'users contains values that violate canonical checks';
  END IF;

  IF EXISTS (
    SELECT 1 FROM friend_requests
    WHERE status NOT IN ('pending', 'accepted', 'rejected')
       OR month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ) THEN
    RAISE EXCEPTION 'friend_requests contains values that violate canonical checks';
  END IF;

  IF EXISTS (
    SELECT 1 FROM favorites
    WHERE month_key !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  ) THEN
    RAISE EXCEPTION 'favorites contains values that violate canonical checks';
  END IF;

  IF EXISTS (
    SELECT 1 FROM users WHERE display_name IS NOT NULL
    GROUP BY LOWER(display_name) HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM rooms WHERE type = 'global'
    GROUP BY type HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM profile_views
    GROUP BY profile_user_id, viewer_user_id HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM favorites
    GROUP BY user_id, month_key HAVING COUNT(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM friend_requests
    GROUP BY from_user_id, to_user_id, month_key HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'duplicate rows prevent canonical unique indexes';
  END IF;
END $$;

ALTER TABLE friend_requests
  DROP CONSTRAINT IF EXISTS friend_requests_from_user_id_to_user_id_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_course_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_course_check CHECK (course IS NULL OR course IN ('1', '2', '3', '4', '5', '6'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_gender_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_profile_completed_check' AND conrelid = 'users'::regclass) THEN
    ALTER TABLE users ADD CONSTRAINT users_profile_completed_check CHECK (profile_completed IS NULL OR profile_completed IN ('true', 'false'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_month_key_check' AND conrelid = 'favorites'::regclass) THEN
    ALTER TABLE favorites ADD CONSTRAINT favorites_month_key_check CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_status_check' AND conrelid = 'friend_requests'::regclass) THEN
    ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_status_check CHECK (status IN ('pending', 'accepted', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friend_requests_month_key_check' AND conrelid = 'friend_requests'::regclass) THEN
    ALTER TABLE friend_requests ADD CONSTRAINT friend_requests_month_key_check CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'messages_reply_to_id_fkey' AND conrelid = 'messages'::regclass) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_display_name_lower
  ON users (LOWER(display_name)) WHERE display_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_rooms_single_global
  ON rooms (type) WHERE type = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS ux_profile_views_users
  ON profile_views (profile_user_id, viewer_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS ux_favorites_user_month
  ON favorites (user_id, month_key);
CREATE UNIQUE INDEX IF NOT EXISTS ux_friend_requests_users_month
  ON friend_requests (from_user_id, to_user_id, month_key);

CREATE INDEX IF NOT EXISTS idx_users_tg_id ON users(tg_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_reply_to_id ON messages(reply_to_id);
CREATE INDEX IF NOT EXISTS idx_messages_delivered_to ON messages USING GIN (delivered_to);
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN (read_by);
CREATE INDEX IF NOT EXISTS idx_rooms_name ON rooms(name);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_user ON profile_views(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer_user ON profile_views(viewer_user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_favorite_user_id ON favorites(favorite_user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_to_user_status ON friend_requests(to_user_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_month ON friend_requests(month_key);
CREATE INDEX IF NOT EXISTS idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX IF NOT EXISTS idx_news_created_at ON news(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_active_user ON auth_sessions(user_id) WHERE revoked_at IS NULL;
