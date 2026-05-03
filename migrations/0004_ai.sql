CREATE TABLE IF NOT EXISTS user_correction_memory (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL,
  pattern_value TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  confidence_boost REAL NOT NULL DEFAULT 0.15,
  last_used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS user_correction_memory_user_pattern_idx
  ON user_correction_memory(user_id, pattern_type, pattern_value);

CREATE INDEX IF NOT EXISTS user_correction_memory_user_id_idx
  ON user_correction_memory(user_id);

CREATE TABLE IF NOT EXISTS ai_suggestions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  suggested_category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  suggested_description TEXT,
  suggested_tags_json TEXT,
  confidence REAL NOT NULL,
  reason_code TEXT,
  needs_manual_review INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS ai_suggestions_user_id_idx ON ai_suggestions(user_id);
CREATE INDEX IF NOT EXISTS ai_suggestions_transaction_id_idx ON ai_suggestions(transaction_id);
CREATE INDEX IF NOT EXISTS ai_suggestions_status_idx ON ai_suggestions(status);
