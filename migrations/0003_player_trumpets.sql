CREATE TABLE IF NOT EXISTS player_trumpets (
  account_id TEXT NOT NULL,
  checked_date TEXT NOT NULL,
  trumpet_count INTEGER NOT NULL,
  rules TEXT NOT NULL,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (account_id, checked_date)
);
CREATE INDEX IF NOT EXISTS player_trumpets_date_idx ON player_trumpets(checked_date, account_id);
