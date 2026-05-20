CREATE TABLE IF NOT EXISTS fx_rates (
  rate_date TEXT NOT NULL,
  currency TEXT NOT NULL,
  pln_per_unit REAL NOT NULL,
  source TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  PRIMARY KEY (rate_date, currency)
);

ALTER TABLE investment_assets ADD COLUMN last_quote_price_minor INTEGER;
ALTER TABLE investment_assets ADD COLUMN last_quote_currency TEXT;
ALTER TABLE investment_assets ADD COLUMN last_quote_fx_rate REAL;
ALTER TABLE investment_assets ADD COLUMN last_quote_rate_date TEXT;
ALTER TABLE investment_assets ADD COLUMN last_price_fetched_at TEXT;
ALTER TABLE investment_assets ADD COLUMN price_source TEXT;
