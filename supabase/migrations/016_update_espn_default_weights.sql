-- Migration 016: Update ESPN Default Scoring Weights
--
-- ESPN Fantasy updated their default scoring system to include FGM/FGA/FTM/FTA
-- and revised weights for AST, STL, BLK, TOV.
--
-- New weights: PTS(1) FGM(2) FGA(-1) 3PM(1) FTM(1) FTA(-1)
--              REB(1) AST(2) STL(4) BLK(4) TOV(-2)
--
-- The app resolves 'espn_default' weights from code (scoring-config.ts),
-- so no league row changes are needed — code update alone is sufficient.
--
-- However, player_stats_cache stores pre-computed fpts/fpts_avg using the old
-- weights. Truncating forces a fresh recompute on the next edge function run.

TRUNCATE TABLE player_stats_cache;
