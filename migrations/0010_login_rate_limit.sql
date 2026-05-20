CREATE TABLE IF NOT EXISTS login_attempt_failures (
  id TEXT PRIMARY KEY NOT NULL,
  login_key TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  failed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS login_attempt_failures_lookup_idx
  ON login_attempt_failures (login_key, ip_hash, failed_at);
