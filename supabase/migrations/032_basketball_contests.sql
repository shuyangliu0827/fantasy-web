-- 032_basketball_contests.sql
--
-- Daily fantasy contest engine for basketball_leagues. Mirrors the NBA
-- contests/contest_players/user_lineups schema but with UUID player_ids
-- (basketball_players.id) and a league scoping column.
--
-- Scoring path: existing basketball_player_game_stats.fantasy_points is
-- the authoritative per-player number for any date with games. The
-- settler sums those values across the 5 lineup slots.
--
-- All statements idempotent.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── basketball_contests ────────────────────────────────────────
-- One row per (basketball_league_id, date). Auto-seeded on first
-- access for any date that has at least one scheduled game in the
-- league.

CREATE TABLE IF NOT EXISTS basketball_contests (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  date                  date        NOT NULL,
  status                text        NOT NULL DEFAULT 'pending'
                                      CHECK (status IN ('pending', 'open', 'locked', 'scored')),
  lineup_lock_at        timestamptz,
  salary_cap            int         NOT NULL DEFAULT 50000,
  lineup_size           int         NOT NULL DEFAULT 5,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (basketball_league_id, date)
);

CREATE INDEX IF NOT EXISTS idx_bball_contests_league_date
  ON basketball_contests (basketball_league_id, date);
CREATE INDEX IF NOT EXISTS idx_bball_contests_date
  ON basketball_contests (date);

-- ── basketball_contest_players ─────────────────────────────────
-- The frozen player pool for a contest. Salary derived from each
-- player's season averages at contest creation time
-- (lib/basketball/contest-salary.ts). Tier is informational.

CREATE TABLE IF NOT EXISTS basketball_contest_players (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id            uuid        NOT NULL REFERENCES basketball_contests(id) ON DELETE CASCADE,
  player_id             uuid        NOT NULL REFERENCES basketball_players(id)   ON DELETE CASCADE,
  team_id               uuid        REFERENCES basketball_teams(id) ON DELETE SET NULL,
  salary                int         NOT NULL DEFAULT 5000,
  tier                  int         NOT NULL DEFAULT 4,
  projected_points      numeric     NOT NULL DEFAULT 0,
  season_avg_fp         numeric     NOT NULL DEFAULT 0,
  games_played          int         NOT NULL DEFAULT 0,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_bball_contest_players_contest
  ON basketball_contest_players (contest_id);

-- ── basketball_user_lineups ────────────────────────────────────

CREATE TABLE IF NOT EXISTS basketball_user_lineups (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id            uuid        NOT NULL REFERENCES basketball_contests(id) ON DELETE CASCADE,
  user_id               uuid        NOT NULL,
  status                text        NOT NULL DEFAULT 'draft'
                                      CHECK (status IN ('draft', 'submitted', 'scored')),
  total_fpts            numeric,
  rank                  int,
  submitted_at          timestamptz,
  scored_at             timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bball_user_lineups_contest
  ON basketball_user_lineups (contest_id);
CREATE INDEX IF NOT EXISTS idx_bball_user_lineups_user
  ON basketball_user_lineups (user_id);

-- ── basketball_user_lineup_players ─────────────────────────────
-- 5 rows per lineup. slot ∈ 0..4 (labelled PG/SG/SF/PF/C in the UI;
-- no eligibility enforcement in v1 — any player can fill any slot).

CREATE TABLE IF NOT EXISTS basketball_user_lineup_players (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  lineup_id             uuid        NOT NULL REFERENCES basketball_user_lineups(id) ON DELETE CASCADE,
  slot                  int         NOT NULL CHECK (slot >= 0 AND slot < 16),
  player_id             uuid        NOT NULL REFERENCES basketball_players(id) ON DELETE CASCADE,
  actual_fantasy_points numeric,
  UNIQUE (lineup_id, slot)
);

CREATE INDEX IF NOT EXISTS idx_bball_lineup_players_lineup
  ON basketball_user_lineup_players (lineup_id);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE basketball_contests              ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_contest_players       ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_user_lineups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_user_lineup_players   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_basketball_contests              ON basketball_contests;
DROP POLICY IF EXISTS allow_all_basketball_contest_players       ON basketball_contest_players;
DROP POLICY IF EXISTS allow_all_basketball_user_lineups          ON basketball_user_lineups;
DROP POLICY IF EXISTS allow_all_basketball_user_lineup_players   ON basketball_user_lineup_players;

CREATE POLICY allow_all_basketball_contests              ON basketball_contests              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_contest_players       ON basketball_contest_players       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_user_lineups          ON basketball_user_lineups          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_basketball_user_lineup_players   ON basketball_user_lineup_players   FOR ALL USING (true) WITH CHECK (true);
