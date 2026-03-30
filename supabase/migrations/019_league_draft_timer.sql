-- Add draft_turn_started_at to persist the current turn's timer start across refreshes.
-- Stored as unix milliseconds (bigint). 0 means the draft room has not been entered yet.

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS draft_turn_started_at bigint NOT NULL DEFAULT 0;
