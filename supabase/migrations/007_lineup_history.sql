-- Add lineup_history JSONB column to fantasy_teams
-- Stores per-week lineup snapshots: { "1": { PG: "playerId", ... }, "2": { ... } }
-- This allows past weeks' lineups to be locked/immutable while future weeks can still be changed.

ALTER TABLE fantasy_teams
  ADD COLUMN IF NOT EXISTS lineup_history jsonb DEFAULT '{}'::jsonb;
