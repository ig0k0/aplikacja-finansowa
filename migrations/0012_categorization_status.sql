ALTER TABLE transactions ADD COLUMN categorization_status TEXT NOT NULL DEFAULT 'done';
ALTER TABLE transactions ADD COLUMN categorization_started_at TEXT;

UPDATE transactions
SET categorization_status = 'pending'
WHERE verification_status = 'needs_review';

CREATE INDEX IF NOT EXISTS transactions_user_categorization_date_idx
  ON transactions(user_id, categorization_status, transaction_date);
