-- Migration 013: canonical player-day fact layer.
--
-- player_day_stats stores NBA player box-score stats per (player_id, date).
-- This is the single source of truth for player stats used in score computation.
--
-- NULL-SAFE rule: only rows with valid stats (fpts > 0 OR min > 0) are written.
-- Zero-stat responses from the BDL API never overwrite valid historical records.
-- This makes all past-week score computation fully deterministic across page loads.

CREATE TABLE player_day_stats (
  player_id  text    NOT NULL,
  date       date    NOT NULL,
  min        numeric NOT NULL DEFAULT 0,
  fgm        int     NOT NULL DEFAULT 0,
  fga        int     NOT NULL DEFAULT 0,
  fg3m       int     NOT NULL DEFAULT 0,
  ftm        int     NOT NULL DEFAULT 0,
  fta        int     NOT NULL DEFAULT 0,
  reb        int     NOT NULL DEFAULT 0,
  ast        int     NOT NULL DEFAULT 0,
  stl        int     NOT NULL DEFAULT 0,
  blk        int     NOT NULL DEFAULT 0,
  tov        int     NOT NULL DEFAULT 0,
  pts        int     NOT NULL DEFAULT 0,
  fpts       numeric NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, date)
);

-- Efficient lookup of all players who played on a given date
CREATE INDEX player_day_stats_date_idx ON player_day_stats (date);

-- Allow public read/write (this is public NBA game data, no user PII)
ALTER TABLE player_day_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read"   ON player_day_stats FOR SELECT USING (true);
CREATE POLICY "Public insert" ON player_day_stats FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update" ON player_day_stats FOR UPDATE USING (true) WITH CHECK (true);
