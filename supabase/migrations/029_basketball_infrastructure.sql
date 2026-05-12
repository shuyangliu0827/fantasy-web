-- 029_basketball_infrastructure.sql
--
-- Adds the parallel "real-world basketball league" infrastructure layer.
-- This is ADDITIVE — the existing `leagues` table (fantasy season-long
-- leagues) is untouched aside from one nullable column linking to a
-- basketball league.
--
-- Governance model:
--   • platform_admins              — Blueprint staff. Can approve leagues
--                                    and grant league-admin permissions.
--   • basketball_league_admins     — Per-league admins, granted by
--                                    platform admins only.
--   • basketball_league_members    — stat_keeper / player / viewer roles,
--                                    granted by league admins.
--
-- Visibility model (basketball_leagues.visibility):
--   public      — anyone can view league content
--   invite_only — non-members see a request-access page
--   private     — non-members see a private wall
--
-- Access enforcement happens in API handlers via lib/basketball/access.ts.
-- RLS is enabled with permissive policies so service_role keeps full
-- access; the legacy migrations follow the same pattern.
--
-- All statements are idempotent (IF NOT EXISTS / IF EXISTS).
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── 1. platform_admins ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS platform_admins (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL UNIQUE,
  role       text        NOT NULL DEFAULT 'platform_admin'
                          CHECK (role IN ('platform_owner', 'platform_admin', 'support')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_platform_admins_user ON platform_admins (user_id);

-- ── 2. basketball_leagues ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_leagues (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text        NOT NULL,
  slug         text        NOT NULL UNIQUE,
  description  text,
  source_type  text        NOT NULL DEFAULT 'custom_manual'
                            CHECK (source_type IN ('nba', 'custom_manual', 'csv')),
  created_by   uuid        NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  visibility   text        NOT NULL DEFAULT 'invite_only'
                            CHECK (visibility IN ('public', 'invite_only', 'private')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_leagues_status     ON basketball_leagues (status);
CREATE INDEX IF NOT EXISTS idx_bball_leagues_visibility ON basketball_leagues (visibility);
CREATE INDEX IF NOT EXISTS idx_bball_leagues_created_by ON basketball_leagues (created_by);

-- ── 3. basketball_league_admins ────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_league_admins (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL,
  role                  text        NOT NULL DEFAULT 'league_admin'
                                      CHECK (role IN ('league_owner', 'league_admin')),
  granted_by            uuid,
  granted_at            timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basketball_league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bball_league_admins_user   ON basketball_league_admins (user_id);
CREATE INDEX IF NOT EXISTS idx_bball_league_admins_league ON basketball_league_admins (basketball_league_id);

-- ── 4. basketball_league_members ───────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_league_members (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL,
  role                  text        NOT NULL DEFAULT 'viewer'
                                      CHECK (role IN ('stat_keeper', 'player', 'viewer')),
  status                text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  invited_by            uuid,
  approved_by           uuid,
  joined_at             timestamptz NOT NULL DEFAULT now(),
  approved_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basketball_league_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bball_league_members_user   ON basketball_league_members (user_id);
CREATE INDEX IF NOT EXISTS idx_bball_league_members_league ON basketball_league_members (basketball_league_id);
CREATE INDEX IF NOT EXISTS idx_bball_league_members_status ON basketball_league_members (status);

-- ── 5. basketball_teams ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_teams (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  name                  text        NOT NULL,
  abbreviation          text,
  city                  text,
  logo_url              text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basketball_league_id, name)
);

CREATE INDEX IF NOT EXISTS idx_bball_teams_league ON basketball_teams (basketball_league_id);

-- ── 6. basketball_players ──────────────────────────────────────
--
-- Custom basketball players. UUID primary key (NOT a BDL integer ID).
-- claimed_by_user_id allows a site user to claim a player profile;
-- once claim_status='approved', the user may edit a whitelisted set
-- of profile fields via /api/basketball-players/[id]/profile.

CREATE TABLE IF NOT EXISTS basketball_players (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  team_id               uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  display_name          text        NOT NULL,
  position              text,
  jersey_number         text,
  height                text,
  weight                text,
  bio                   text,
  avatar_url            text,
  claimed_by_user_id    uuid,
  claim_status          text        DEFAULT 'unclaimed'
                                      CHECK (claim_status IN ('unclaimed', 'pending', 'approved', 'rejected')),
  profile_edit_status   text        DEFAULT 'clean'
                                      CHECK (profile_edit_status IN ('clean', 'pending_review')),
  external_provider     text,
  external_player_id    text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basketball_league_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_bball_players_league  ON basketball_players (basketball_league_id);
CREATE INDEX IF NOT EXISTS idx_bball_players_team    ON basketball_players (team_id);
CREATE INDEX IF NOT EXISTS idx_bball_players_claimed ON basketball_players (claimed_by_user_id);

-- ── 7. basketball_player_profile_edit_requests ─────────────────

CREATE TABLE IF NOT EXISTS basketball_player_profile_edit_requests (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  player_id             uuid        NOT NULL REFERENCES basketball_players(id) ON DELETE CASCADE,
  requested_by          uuid        NOT NULL,
  payload               jsonb       NOT NULL,
  status                text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by           uuid,
  reviewed_at           timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_profile_edits_player ON basketball_player_profile_edit_requests (player_id);
CREATE INDEX IF NOT EXISTS idx_bball_profile_edits_status ON basketball_player_profile_edit_requests (status);

-- ── 8. basketball_games ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_games (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  home_team_id          uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  away_team_id          uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  scheduled_at          timestamptz,
  status                text        NOT NULL DEFAULT 'scheduled'
                                      CHECK (status IN ('scheduled', 'live', 'final', 'cancelled')),
  home_score            int,
  away_score            int,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_games_league       ON basketball_games (basketball_league_id);
CREATE INDEX IF NOT EXISTS idx_bball_games_scheduled_at ON basketball_games (scheduled_at);

-- ── 9. basketball_player_game_stats ────────────────────────────
--
-- Box score rows. fantasy_points is computed at write time via
-- calcFantasyPoints (lib/fantasy/shared/scoring-config.ts) using
-- ESPN_DEFAULT_WEIGHTS — the single source of truth for scoring.

CREATE TABLE IF NOT EXISTS basketball_player_game_stats (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  game_id               uuid        NOT NULL REFERENCES basketball_games(id)   ON DELETE CASCADE,
  player_id             uuid        NOT NULL REFERENCES basketball_players(id) ON DELETE CASCADE,
  team_id               uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  min                   numeric     NOT NULL DEFAULT 0,
  pts                   numeric     NOT NULL DEFAULT 0,
  reb                   numeric     NOT NULL DEFAULT 0,
  ast                   numeric     NOT NULL DEFAULT 0,
  stl                   numeric     NOT NULL DEFAULT 0,
  blk                   numeric     NOT NULL DEFAULT 0,
  tov                   numeric     NOT NULL DEFAULT 0,
  fgm                   numeric     NOT NULL DEFAULT 0,
  fga                   numeric     NOT NULL DEFAULT 0,
  fg3m                  numeric     NOT NULL DEFAULT 0,
  ftm                   numeric     NOT NULL DEFAULT 0,
  fta                   numeric     NOT NULL DEFAULT 0,
  fantasy_points        numeric,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_bball_stats_league ON basketball_player_game_stats (basketball_league_id);
CREATE INDEX IF NOT EXISTS idx_bball_stats_game   ON basketball_player_game_stats (game_id);
CREATE INDEX IF NOT EXISTS idx_bball_stats_player ON basketball_player_game_stats (player_id);

-- ── 10. Link fantasy `leagues` → basketball_leagues (optional) ─

ALTER TABLE leagues
  ADD COLUMN IF NOT EXISTS basketball_league_id uuid NULL REFERENCES basketball_leagues(id);

-- ── RLS (permissive; real enforcement in API layer via service_role) ──

ALTER TABLE platform_admins                              ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_leagues                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_league_admins                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_league_members                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_teams                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_players                           ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_player_profile_edit_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_games                             ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_player_game_stats                 ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'platform_admins',
      'basketball_leagues',
      'basketball_league_admins',
      'basketball_league_members',
      'basketball_teams',
      'basketball_players',
      'basketball_player_profile_edit_requests',
      'basketball_games',
      'basketball_player_game_stats'
    ])
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS allow_all_%I ON %I; CREATE POLICY allow_all_%I ON %I FOR ALL USING (true) WITH CHECK (true);',
      tbl, tbl, tbl, tbl
    );
  END LOOP;
END $$;
