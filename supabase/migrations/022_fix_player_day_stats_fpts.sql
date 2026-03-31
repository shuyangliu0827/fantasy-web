-- Migration 022: Retroactively fix player_day_stats.fpts
--
-- The nba-game-stats API route was computing fpts using only 7 of 11 ESPN scoring
-- terms, omitting: fgm (+2), fga (-1), ftm (+1), fta (-1).
--
-- All raw stat columns (fgm, fga, ftm, fta, ...) were stored correctly all along.
-- Only the derived fpts column was wrong. This migration recomputes fpts for every
-- existing row from the stored raw columns using the correct ESPN formula:
--
--   fpts = pts*1 + fgm*2 + fga*(-1) + fg3m*1 + ftm*1 + fta*(-1)
--        + reb*1 + ast*2 + stl*4   + blk*4  + tov*(-2)
--
-- Safe to run multiple times (idempotent): the formula is deterministic.
-- Matchup scores that were already finalized before this migration are NOT
-- retroactively updated — those rows in the matchups table stand as the historical
-- record. Only future score computations read player_day_stats.fpts.

UPDATE player_day_stats
SET fpts = ROUND(
  (pts  *  1) +
  (fgm  *  2) +
  (fga  * -1) +
  (fg3m *  1) +
  (ftm  *  1) +
  (fta  * -1) +
  (reb  *  1) +
  (ast  *  2) +
  (stl  *  4) +
  (blk  *  4) +
  (tov  * -2)
, 1);
