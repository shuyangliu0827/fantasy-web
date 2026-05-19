-- Add client-side idempotency key support for live scorekeeping retries/recovery.
ALTER TABLE basketball_stat_events
  ADD COLUMN IF NOT EXISTS client_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bball_stat_events_game_client_event
  ON basketball_stat_events (game_id, client_event_id)
  WHERE client_event_id IS NOT NULL;

