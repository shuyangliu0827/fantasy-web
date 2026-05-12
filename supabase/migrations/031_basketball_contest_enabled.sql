-- 031_basketball_contest_enabled.sql
--
-- Adds an opt-in flag for whether a basketball league has fantasy
-- contest gameplay available. Default false — flipping this on is a
-- platform / league admin decision (the league has enough players,
-- scheduled games, and stat-keeper coverage to make daily contests
-- meaningful).
--
-- Idempotent; safe to re-run.
-- ================================================================

ALTER TABLE basketball_leagues
  ADD COLUMN IF NOT EXISTS is_contest_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_bball_leagues_contest_enabled
  ON basketball_leagues (is_contest_enabled);
