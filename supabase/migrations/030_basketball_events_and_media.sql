-- 030_basketball_events_and_media.sql
--
-- Phase B.1 additions:
--   1. fg3a column on basketball_player_game_stats so the event aggregator
--      can track 3PA (migration 029 had fg3m but no fg3a).
--   2. basketball_stat_events — the canonical event log; box-score rows
--      are derived from these via lib/basketball/aggregate.ts.
--   3. basketball_game_media — link-only media attachments
--      (YouTube / Bilibili / generic URLs). File upload is out of scope.
--   4. Defensively re-create the permissive "allow_all" policies on every
--      basketball_* table (the DO $$ EXECUTE block in 029 ran two
--      semicolon-separated statements inside a single EXECUTE which is
--      not portable; we replace it with one-statement-per-EXECUTE.)
--
-- All statements use IF NOT EXISTS / IF EXISTS and are safe to re-run.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. fg3a on box-score table ─────────────────────────────────

ALTER TABLE basketball_player_game_stats
  ADD COLUMN IF NOT EXISTS fg3a numeric NOT NULL DEFAULT 0;

-- ── 2. basketball_stat_events ──────────────────────────────────
--
-- One row per scoring/possession event. Aggregates derive from these.

CREATE TABLE IF NOT EXISTS basketball_stat_events (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  game_id               uuid        NOT NULL REFERENCES basketball_games(id)   ON DELETE CASCADE,
  player_id             uuid        NOT NULL REFERENCES basketball_players(id) ON DELETE CASCADE,
  team_id               uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  event_type            text        NOT NULL
                                      CHECK (event_type IN (
                                        'two_pt_made',
                                        'two_pt_missed',
                                        'three_pt_made',
                                        'three_pt_missed',
                                        'ft_made',
                                        'ft_missed',
                                        'reb',
                                        'ast',
                                        'stl',
                                        'blk',
                                        'tov'
                                      )),
  created_by            uuid        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_stat_events_game
  ON basketball_stat_events (game_id);
CREATE INDEX IF NOT EXISTS idx_bball_stat_events_player
  ON basketball_stat_events (game_id, player_id);
CREATE INDEX IF NOT EXISTS idx_bball_stat_events_created_at
  ON basketball_stat_events (game_id, created_at DESC);

-- ── 3. basketball_game_media ───────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_game_media (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  game_id               uuid        NOT NULL REFERENCES basketball_games(id)   ON DELETE CASCADE,
  uploaded_by           uuid        NOT NULL,
  media_type            text        NOT NULL DEFAULT 'link'
                                      CHECK (media_type IN ('link', 'video', 'image')),
  title                 text,
  url                   text        NOT NULL,
  visibility            text        NOT NULL DEFAULT 'public'
                                      CHECK (visibility IN ('public', 'members_only')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_game_media_game
  ON basketball_game_media (game_id);

-- ── 4. RLS + policies (defensive re-creation on all basketball_*) ──

ALTER TABLE basketball_stat_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_game_media      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_platform_admins                         ON platform_admins;
DROP POLICY IF EXISTS allow_all_basketball_leagues                      ON basketball_leagues;
DROP POLICY IF EXISTS allow_all_basketball_league_admins                ON basketball_league_admins;
DROP POLICY IF EXISTS allow_all_basketball_league_members               ON basketball_league_members;
DROP POLICY IF EXISTS allow_all_basketball_teams                        ON basketball_teams;
DROP POLICY IF EXISTS allow_all_basketball_players                      ON basketball_players;
DROP POLICY IF EXISTS allow_all_basketball_player_profile_edit_requests ON basketball_player_profile_edit_requests;
DROP POLICY IF EXISTS allow_all_basketball_games                        ON basketball_games;
DROP POLICY IF EXISTS allow_all_basketball_player_game_stats            ON basketball_player_game_stats;
DROP POLICY IF EXISTS allow_all_basketball_stat_events                  ON basketball_stat_events;
DROP POLICY IF EXISTS allow_all_basketball_game_media                   ON basketball_game_media;

CREATE POLICY allow_all_platform_admins                         ON platform_admins                         FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_leagues                      ON basketball_leagues                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_league_admins                ON basketball_league_admins                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_league_members               ON basketball_league_members               FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_teams                        ON basketball_teams                        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_players                      ON basketball_players                      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_player_profile_edit_requests ON basketball_player_profile_edit_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_games                        ON basketball_games                        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_player_game_stats            ON basketball_player_game_stats            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_stat_events                  ON basketball_stat_events                  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_game_media                   ON basketball_game_media                   FOR ALL USING (true) WITH CHECK (true);
