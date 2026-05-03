CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_institution TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  rows_total INTEGER NOT NULL DEFAULT 0,
  rows_imported INTEGER NOT NULL DEFAULT 0,
  rows_skipped_duplicate INTEGER NOT NULL DEFAULT 0,
  rows_failed INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS import_batches_user_id_idx ON import_batches(user_id);
CREATE INDEX IF NOT EXISTS import_batches_file_hash_idx ON import_batches(file_hash);

CREATE TABLE IF NOT EXISTS imported_rows (
  id TEXT PRIMARY KEY NOT NULL,
  import_batch_id TEXT NOT NULL REFERENCES import_batches(id) ON DELETE CASCADE,
  row_number INTEGER NOT NULL,
  raw_data_json TEXT NOT NULL,
  normalized_data_json TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  transaction_id TEXT REFERENCES transactions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS imported_rows_batch_id_idx ON imported_rows(import_batch_id);
