CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  meta_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_events_user_id_idx ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS audit_events_action_idx ON audit_events(action);
