-- Thoughts feed (guestbook micro-feed). Apply with:
--   npx wrangler d1 execute hudbud-thoughts --remote --file worker/schema.sql
CREATE TABLE IF NOT EXISTS thoughts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  body TEXT NOT NULL,
  is_hudbud INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_thoughts_ip ON thoughts (ip_hash, id);

-- /fish high scores: every catch that made the board, and each visit's tally
-- (one row per page load, upserted as the fish come in).
CREATE TABLE IF NOT EXISTS fish_catches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  fly TEXT NOT NULL,
  inches INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_fish_catches_ip ON fish_catches (ip_hash, created_at);
CREATE TABLE IF NOT EXISTS fish_sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  count INTEGER NOT NULL,
  inches INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  ip_hash TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_fish_sessions_ip ON fish_sessions (ip_hash, created_at);
