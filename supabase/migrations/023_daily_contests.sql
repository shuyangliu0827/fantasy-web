-- ============================================================
-- 023_daily_contests.sql
--
-- Daily Contest MVP for Blueprint Fantasy.
--
-- ── Player identity (CRITICAL) ────────────────────────────────
-- There is exactly ONE player identity system in this codebase:
-- the BallDontLie integer player ID.  It appears in two forms:
--
--   player_stats_cache.player_id  INTEGER  (raw BDL id)
--   player_day_stats.player_id    TEXT     (String(bdl_id), e.g. "123")
--
-- These are the same player.  The TEXT form exists because
-- nba-game-stats/route.ts writes:  player_id = String(stat.player.id)
-- The join between them is always:
--   player_stats_cache.player_id::text = player_day_stats.player_id
--
-- contest_players.player_id is TEXT, matching player_day_stats.player_id
-- (the scoring source).  To join player_stats_cache, cast to integer:
--   player_stats_cache.player_id = contest_players.player_id::integer
--
-- NO second player ID system is introduced.
--
-- ── Scoring ───────────────────────────────────────────────────
-- No new scoring formula.  Contest scores read player_day_stats.fpts
-- which is computed by the existing pipeline via calcFantasyPoints()
-- in lib/scoring-config.ts (ESPN default weights, 11 terms).
--
-- ── Tie-handling (rank column) ────────────────────────────────
-- Uses standard competition ranking (SQL RANK() semantics):
--   e.g. scores 50, 45, 45, 40 → ranks 1, 2, 2, 4
-- For champion selection among rank=1 ties: earliest submitted_at wins.
-- The scoring job applies:
--   RANK() OVER (PARTITION BY contest_id ORDER BY total_fpts DESC NULLS LAST)
--
-- ── Player pool size ──────────────────────────────────────────
-- MVP pool: top 80 players by rank from player_stats_cache, excluding
-- any player with injury = 'Out'.  Populated at contest creation time.
-- Stored as contest_players rows.  ~80 players across 4 tiers.
--
-- ── contest_results ───────────────────────────────────────────
-- A separate contest_results table is intentionally omitted.
-- user_lineups.total_fpts + rank IS the result.  The leaderboard is
-- ORDER BY rank ASC, submitted_at ASC on user_lineups joined with users.
-- ============================================================

-- ── 1. contests ───────────────────────────────────────────────
--
-- One row per contest day.  status drives the lifecycle:
--   pending → created, not yet open for entries
--   open    → accepting lineups (before lineup_lock_at)
--   locked  → deadline passed, games in progress or complete
--   scored  → user_lineups.total_fpts + rank populated by scoring job

CREATE TABLE IF NOT EXISTS contests (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  date           date        NOT NULL UNIQUE,
  status         text        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','open','locked','scored')),
  lineup_lock_at timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contests_date   ON contests (date DESC);
CREATE INDEX IF NOT EXISTS idx_contests_status ON contests (status);

-- ── 2. contest_players ────────────────────────────────────────
--
-- Player pool for the contest.  player_id is TEXT = String(bdl_integer_id),
-- matching player_day_stats.player_id exactly.
--
-- Populated at contest creation from player_stats_cache:
--   WHERE rank IS NOT NULL AND rank <= 80 AND (injury IS NULL OR injury <> 'Out')
--   ORDER BY rank ASC
--
-- tier is derived from rank at creation time (display/filter only):
--   1 → rank  1-20   (elite)
--   2 → rank 21-40
--   3 → rank 41-60
--   4 → rank 61-80
--
-- fpts_scored is NULL until the scoring job runs after contest.date games.
-- The scoring job sets it from player_day_stats.fpts WHERE date = contest.date.

CREATE TABLE IF NOT EXISTS contest_players (
  id           uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id   uuid    NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  player_id    text    NOT NULL,
  tier         int     NOT NULL CHECK (tier BETWEEN 1 AND 4),
  fpts_scored  numeric,
  UNIQUE (contest_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_cp_contest ON contest_players (contest_id);

-- ── 3. user_lineups ───────────────────────────────────────────
--
-- One lineup per user per contest.
-- status lifecycle: draft → submitted → locked → scored
--   draft     : saved but not entered; editable
--   submitted : user clicked Submit before deadline; still editable until lock
--   locked    : contest passed lineup_lock_at; no further edits allowed
--   scored    : total_fpts and rank populated by scoring job
--
-- rank uses RANK() (competition ranking, gaps on ties).
-- For ties at rank=1, the contest winner is the earliest submitted_at.

CREATE TABLE IF NOT EXISTS user_lineups (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  contest_id   uuid        NOT NULL REFERENCES contests(id) ON DELETE CASCADE,
  user_id      uuid        NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'draft'
                           CHECK (status IN ('draft','submitted','locked','scored')),
  total_fpts   numeric,
  rank         int,
  submitted_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ul_contest      ON user_lineups (contest_id);
CREATE INDEX IF NOT EXISTS idx_ul_user         ON user_lineups (user_id);
-- Leaderboard lookup: rank ASC, submitted_at ASC for tie display
CREATE INDEX IF NOT EXISTS idx_ul_leaderboard  ON user_lineups (contest_id, rank ASC NULLS LAST, submitted_at ASC NULLS LAST);

-- ── 4. user_lineup_players ────────────────────────────────────
--
-- Exactly 5 rows per lineup (slot 1-5).
-- player_id must be a contest_players.player_id for the same contest.
-- This constraint is enforced at the application layer (MVP); a trigger
-- can be added later for strict DB enforcement.

CREATE TABLE IF NOT EXISTS user_lineup_players (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  lineup_id  uuid NOT NULL REFERENCES user_lineups(id) ON DELETE CASCADE,
  player_id  text NOT NULL,
  slot       int  NOT NULL CHECK (slot BETWEEN 1 AND 5),
  UNIQUE (lineup_id, slot),
  UNIQUE (lineup_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_ulp_lineup ON user_lineup_players (lineup_id);

-- ── 5. Row Level Security (open policies — matches project pattern) ────────

ALTER TABLE contests          ENABLE ROW LEVEL SECURITY;
ALTER TABLE contest_players   ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lineups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lineup_players ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY['contests', 'contest_players', 'user_lineups', 'user_lineup_players'];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('CREATE POLICY "allow_all_select_%s"  ON %I FOR SELECT USING (true)',               tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_insert_%s"  ON %I FOR INSERT WITH CHECK (true)',          tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_update_%s"  ON %I FOR UPDATE USING (true) WITH CHECK (true)', tbl, tbl);
    EXECUTE format('CREATE POLICY "allow_all_delete_%s"  ON %I FOR DELETE USING (true)',               tbl, tbl);
  END LOOP;
END $$;
