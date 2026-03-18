-- Migration 009: Remove dead schema
-- roster_players table was never read or written to in the app;
-- superseded by fantasy_teams.roster_data (JSONB) added in migration 006.
-- roster_json column was manually added to fantasy_teams but never used.

-- Drop unused table (cascades RLS policies and indexes automatically)
DROP TABLE IF EXISTS roster_players;

-- Drop orphaned column (always empty, no code references)
ALTER TABLE fantasy_teams
  DROP COLUMN IF EXISTS roster_json;
