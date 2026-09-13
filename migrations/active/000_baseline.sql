-- Canonical schema for a new AnonChatGate database.
-- This file is applied only to a database without the three core tables.

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  tg_id BIGINT UNIQUE,
  username TEXT,
  anon_name TEXT,
  status TEXT NOT NULL DEFAULT 'approved',
  display_name TEXT UNIQUE,
  course TEXT,
  direction TEXT,
  bio TEXT,
  gender TEXT,
  avatar_url TEXT,
  telegram_photo_url TEXT,
  social_links TEXT[],
  photos TEXT[],
  profile_completed TEXT DEFAULT 'false',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT users_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT users_course_check CHECK (course IS NULL OR course IN ('1', '2', '3', '4', '5', '6')),
  CONSTRAINT users_gender_check CHECK (gender IS NULL OR gender IN ('male', 'female')),
  CONSTRAINT users_profile_completed_check CHECK (profile_completed IS NULL OR profile_completed IN ('true', 'false'))
);

CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'global',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  room_id INTEGER NOT NULL REFERENCES rooms(id),
  user_id INTEGER REFERENCES users(id),
  content TEXT NOT NULL,
  reply_to_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
  reply_to_anon_name TEXT,
  reply_to_content TEXT,
  delivered_to INTEGER[],
  read_by INTEGER[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE profile_views (
  id SERIAL PRIMARY KEY,
  profile_user_id INTEGER NOT NULL REFERENCES users(id),
  viewer_user_id INTEGER NOT NULL REFERENCES users(id),
  viewed_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  favorite_user_id INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  month_key TEXT NOT NULL,
  CONSTRAINT favorites_month_key_check CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE friend_requests (
  id SERIAL PRIMARY KEY,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending',
  month_key TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMP,
  CONSTRAINT friend_requests_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT friend_requests_month_key_check CHECK (month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);

CREATE TABLE news (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  author_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE auth_sessions (
  id UUID PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
  refresh_token_jti UUID NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX ux_users_display_name_lower
  ON users (LOWER(display_name))
  WHERE display_name IS NOT NULL;
CREATE UNIQUE INDEX ux_rooms_single_global
  ON rooms (type)
  WHERE type = 'global';
CREATE UNIQUE INDEX ux_profile_views_users
  ON profile_views (profile_user_id, viewer_user_id);
CREATE UNIQUE INDEX ux_favorites_user_month
  ON favorites (user_id, month_key);
CREATE UNIQUE INDEX ux_friend_requests_users_month
  ON friend_requests (from_user_id, to_user_id, month_key);

CREATE INDEX idx_users_tg_id ON users(tg_id);
CREATE INDEX idx_messages_room_created ON messages(room_id, created_at DESC);
CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_reply_to_id ON messages(reply_to_id);
CREATE INDEX idx_messages_delivered_to ON messages USING GIN (delivered_to);
CREATE INDEX idx_messages_read_by ON messages USING GIN (read_by);
CREATE INDEX idx_rooms_name ON rooms(name);
CREATE INDEX idx_profile_views_profile_user ON profile_views(profile_user_id);
CREATE INDEX idx_profile_views_viewer_user ON profile_views(viewer_user_id);
CREATE INDEX idx_favorites_user_id ON favorites(user_id);
CREATE INDEX idx_favorites_favorite_user_id ON favorites(favorite_user_id);
CREATE INDEX idx_friend_requests_to_user_status ON friend_requests(to_user_id, status);
CREATE INDEX idx_friend_requests_month ON friend_requests(month_key);
CREATE INDEX idx_friend_requests_from_user ON friend_requests(from_user_id);
CREATE INDEX idx_news_created_at ON news(created_at DESC);
CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
CREATE INDEX idx_auth_sessions_expires_at ON auth_sessions(expires_at);
CREATE INDEX idx_auth_sessions_active_user ON auth_sessions(user_id) WHERE revoked_at IS NULL;
