ALTER TABLE login_totp_pending ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN totp_last_used_step INTEGER;

CREATE INDEX IF NOT EXISTS login_attempt_failures_login_idx
  ON login_attempt_failures (login_key, failed_at);
CREATE INDEX IF NOT EXISTS login_attempt_failures_failed_at_idx
  ON login_attempt_failures (failed_at);
