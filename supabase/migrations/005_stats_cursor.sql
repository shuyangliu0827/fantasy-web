-- Tracks which player index to process next in the rolling stats refresh.
-- Each edge function run processes BATCH_SIZE players starting at player_index,
-- then increments it. Resets to 0 when all players have been processed.

CREATE TABLE IF NOT EXISTS stats_cursor (
  id int PRIMARY KEY DEFAULT 1,
  player_index int NOT NULL DEFAULT 0,
  last_run_at timestamptz
);

-- Seed the single row
INSERT INTO stats_cursor (id, player_index) VALUES (1, 0)
  ON CONFLICT (id) DO NOTHING;
