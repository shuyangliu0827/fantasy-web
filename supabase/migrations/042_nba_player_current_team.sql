-- ============================================================
-- 042_nba_player_current_team.sql
--
-- Authoritative current-team mapping for NBA players, separate
-- from player_stats_cache (which stores season-stats team and
-- can be stale for mid-season trades).
--
-- Source: BDL /players/active (BDLPlayer.team.abbreviation), the
-- only BDL endpoint that consistently reflects post-trade rosters.
--
-- Used by the daily-contest pool builder as the strict allowlist
-- for game-day eligibility: a player is eligible only when their
-- current_team is on a team playing on the contest date.
-- ============================================================

CREATE TABLE IF NOT EXISTS nba_player_current_team (
  player_id   integer PRIMARY KEY,
  player_name text NOT NULL,
  team        text NOT NULL,                    -- normalized abbreviation (CLE, NYK, ...)
  position    text,
  source      text NOT NULL DEFAULT 'bdl_players_active',
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nba_player_current_team_team
  ON nba_player_current_team (team);

ALTER TABLE nba_player_current_team ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_select_nba_player_current_team"
  ON nba_player_current_team FOR SELECT USING (true);

CREATE POLICY "allow_all_insert_nba_player_current_team"
  ON nba_player_current_team FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_update_nba_player_current_team"
  ON nba_player_current_team FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete_nba_player_current_team"
  ON nba_player_current_team FOR DELETE USING (true);
