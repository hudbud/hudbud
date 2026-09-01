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
