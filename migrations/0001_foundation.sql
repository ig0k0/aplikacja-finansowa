CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  login TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  base_currency TEXT NOT NULL DEFAULT 'PLN',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_system INTEGER NOT NULL DEFAULT 1,
  is_archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS categories_user_id_idx ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_parent_id_idx ON categories(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_user_parent_name_type_idx
  ON categories(user_id, parent_id, name, type);

CREATE TABLE IF NOT EXISTS financial_accounts (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  external_account_hint TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS financial_accounts_user_id_idx
  ON financial_accounts(user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  financial_account_id TEXT REFERENCES financial_accounts(id) ON DELETE SET NULL,
  category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  posted_date TEXT,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  amount_pln_minor INTEGER NOT NULL,
  fx_rate TEXT,
  merchant_name TEXT,
  counterparty_name TEXT,
  description TEXT,
  raw_description TEXT,
  tag_list TEXT,
  verification_status TEXT NOT NULL DEFAULT 'needs_review',
  source TEXT NOT NULL DEFAULT 'manual',
  dedupe_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS transactions_user_id_idx ON transactions(user_id);
CREATE INDEX IF NOT EXISTS transactions_date_idx ON transactions(transaction_date);
CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_dedupe_key_idx
  ON transactions(user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL;
