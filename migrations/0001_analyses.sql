CREATE TABLE IF NOT EXISTS analyses (
  match_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('whole', 'event')),
  fight_index INTEGER NOT NULL DEFAULT -1,
  content TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (match_id, scope, fight_index)
);
CREATE INDEX IF NOT EXISTS analyses_updated_at_idx ON analyses(updated_at);
