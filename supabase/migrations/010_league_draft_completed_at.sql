-- Migration 010: Add draft_completed_at to leagues table
-- This column records when the league's draft finished.
-- It is used as the earliest valid date in the lineup calendar so that
-- users cannot select dates before the league was active.
-- NULL means draft has not completed yet (league is still in setup/drafting status).

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS draft_completed_at timestamptz;

-- Backfill: for leagues already in 'active' or 'completed' status,
-- approximate the draft completion date as the league creation date.
-- Real timestamps will be written when a future draft is completed.
UPDATE leagues
SET draft_completed_at = created_at
WHERE status IN ('active', 'completed')
  AND draft_completed_at IS NULL;

-- Index to support fast lookups (mainly used via league slug, but helpful for bulk ops)
CREATE INDEX IF NOT EXISTS idx_leagues_draft_completed_at ON leagues (draft_completed_at)
  WHERE draft_completed_at IS NOT NULL;
