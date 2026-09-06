ALTER TABLE import_batches ADD COLUMN financial_account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS import_batches_financial_account_id_idx
  ON import_batches(financial_account_id);
