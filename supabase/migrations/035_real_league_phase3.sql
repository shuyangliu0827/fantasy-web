-- 035_real_league_phase3.sql
--
-- Real Basketball League Infrastructure — Phase 3 (live scorekeeping).
--
-- Adds per-game on-court vs bench tracking so the scorekeeping workspace
-- can pin "currently playing" players above the bench. Stored on the
-- game row as a uuid[] of player ids. Updated via PATCH on
-- /api/basketball-leagues/[id]/games/[gameId]. Empty by default.
--
-- No other schema changes are needed for Phase 3: the `basketball_stat_events`
-- log already exists (migration 030) and is the source of truth for player
-- box scores. Team scores are recomputed on every event POST/DELETE from
-- the aggregated box-score rows (see lib/basketball/aggregate.ts).
--
-- Idempotent.
-- ================================================================

ALTER TABLE basketball_games
  ADD COLUMN IF NOT EXISTS on_court_player_ids uuid[] NOT NULL DEFAULT '{}';
