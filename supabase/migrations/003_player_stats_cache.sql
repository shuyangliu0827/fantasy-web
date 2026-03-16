-- =============================================
-- Migration 003: player_stats_cache
-- Flat table for persisted NBA player stats
-- populated by the refresh-nba-stats edge function
-- =============================================

CREATE TABLE player_stats_cache (
  player_id integer PRIMARY KEY,
  name text NOT NULL,
  team text NOT NULL DEFAULT 'N/A',
  position text NOT NULL DEFAULT 'N/A',
  games_played integer DEFAULT 0,

  -- totals
  min_total numeric(8,2) DEFAULT 0,
  fgm_total numeric(8,2) DEFAULT 0,
  fga_total numeric(8,2) DEFAULT 0,
  fg3m_total numeric(8,2) DEFAULT 0,
  fg3a_total numeric(8,2) DEFAULT 0,
  ftm_total numeric(8,2) DEFAULT 0,
  fta_total numeric(8,2) DEFAULT 0,
  reb_total numeric(8,2) DEFAULT 0,
  ast_total numeric(8,2) DEFAULT 0,
  stl_total numeric(8,2) DEFAULT 0,
  blk_total numeric(8,2) DEFAULT 0,
  tov_total numeric(8,2) DEFAULT 0,
  pts_total numeric(8,2) DEFAULT 0,

  -- per-game averages
  min_avg numeric(6,2) DEFAULT 0,
  fgm_avg numeric(6,2) DEFAULT 0,
  fga_avg numeric(6,2) DEFAULT 0,
  fg3m_avg numeric(6,2) DEFAULT 0,
  fg3a_avg numeric(6,2) DEFAULT 0,
  ftm_avg numeric(6,2) DEFAULT 0,
  fta_avg numeric(6,2) DEFAULT 0,
  fg_pct numeric(6,3) DEFAULT 0,
  fg3_pct numeric(6,3) DEFAULT 0,
  ft_pct numeric(6,3) DEFAULT 0,
  reb_avg numeric(6,2) DEFAULT 0,
  ast_avg numeric(6,2) DEFAULT 0,
  stl_avg numeric(6,2) DEFAULT 0,
  blk_avg numeric(6,2) DEFAULT 0,
  tov_avg numeric(6,2) DEFAULT 0,
  pts_avg numeric(6,2) DEFAULT 0,

  -- fantasy
  fpts numeric(8,1) DEFAULT 0,
  fpts_avg numeric(6,2) DEFAULT 0,
  rank integer,
  injury text,

  updated_at timestamptz DEFAULT now()
);

-- Row Level Security (open policies — matches existing project pattern)
ALTER TABLE player_stats_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_select_player_stats_cache"
  ON player_stats_cache FOR SELECT USING (true);

CREATE POLICY "allow_all_insert_player_stats_cache"
  ON player_stats_cache FOR INSERT WITH CHECK (true);

CREATE POLICY "allow_all_update_player_stats_cache"
  ON player_stats_cache FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_delete_player_stats_cache"
  ON player_stats_cache FOR DELETE USING (true);
