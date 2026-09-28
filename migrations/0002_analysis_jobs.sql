CREATE TABLE IF NOT EXISTS analysis_jobs (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('whole', 'event')),
  fight_index INTEGER NOT NULL DEFAULT -1,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  step INTEGER NOT NULL DEFAULT 0,
  total INTEGER NOT NULL,
  error TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS analysis_jobs_match_idx ON analysis_jobs(match_id, scope, fight_index, created_at);
