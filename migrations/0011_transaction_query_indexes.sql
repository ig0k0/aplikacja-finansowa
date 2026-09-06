CREATE INDEX IF NOT EXISTS transactions_user_date_idx
  ON transactions(user_id, transaction_date);

CREATE INDEX IF NOT EXISTS transactions_user_type_date_idx
  ON transactions(user_id, type, transaction_date);

CREATE INDEX IF NOT EXISTS transactions_user_category_date_idx
  ON transactions(user_id, category_id, transaction_date);

CREATE INDEX IF NOT EXISTS transactions_user_review_date_idx
  ON transactions(user_id, verification_status, transaction_date);
