-- Add roster_data and lineup_data JSONB columns to fantasy_teams
-- so rosters and lineups are shared across all users (not just localStorage)

ALTER TABLE fantasy_teams
  ADD COLUMN IF NOT EXISTS roster_data jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS lineup_data jsonb DEFAULT '{}'::jsonb;
