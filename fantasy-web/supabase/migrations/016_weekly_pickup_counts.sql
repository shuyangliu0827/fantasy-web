-- Migration 016: Add weekly pickup counts to fantasy_teams
-- Tracks how many free agents each team has signed per week (Mon-Sun)
-- Format: { "2026-03-23": 3 }  (key = Monday date of the week)

ALTER TABLE fantasy_teams
  ADD COLUMN IF NOT EXISTS pickup_counts jsonb DEFAULT '{}'::jsonb;
