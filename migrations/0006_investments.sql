CREATE TABLE IF NOT EXISTS investment_assets (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ticker TEXT,
  type TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PLN',
  quantity REAL NOT NULL DEFAULT 0,
  cost_basis_pln_minor INTEGER NOT NULL DEFAULT 0,
  market_value_pln_minor INTEGER NOT NULL DEFAULT 0,
  target_allocation_percent REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS investment_assets_user_id_idx ON investment_assets(user_id);

CREATE TABLE IF NOT EXISTS investment_operations (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  investment_asset_id TEXT NOT NULL REFERENCES investment_assets(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  operation_date TEXT NOT NULL,
  quantity_delta REAL NOT NULL DEFAULT 0,
  amount_pln_minor INTEGER NOT NULL,
  fee_pln_minor INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS investment_operations_user_id_idx ON investment_operations(user_id);
CREATE INDEX IF NOT EXISTS investment_operations_asset_id_idx ON investment_operations(investment_asset_id);

CREATE TABLE IF NOT EXISTS investment_strategies (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  rules_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS investment_strategies_user_id_idx ON investment_strategies(user_id);
