-- Add draft_picks_data JSONB column to leagues for persisting in-progress draft picks.
-- This ensures picks survive page refreshes and are visible to all users during the draft.

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS draft_picks_data jsonb DEFAULT '[]'::jsonb;
