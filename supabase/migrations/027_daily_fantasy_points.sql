-- 027_daily_fantasy_points.sql
--
-- Adds points tracking infrastructure for Daily Fantasy scoring.
--
-- Changes:
--   1. user_lineups.points_awarded         — integer, written by settlement job
--   2. user_lineup_players.actual_fantasy_points — per-player fpts after games complete
--   3. points_transactions                 — immutable ledger of points earned
--
-- Idempotency guarantee:
--   UNIQUE (lineup_id, reason) on points_transactions prevents double-awarding
--   when settlement runs more than once (correction runs allowed via ON CONFLICT UPDATE).
--
-- Points rules (applied by settlement job, lib/contest-points.ts):
--   Rank 1       → 500 pts
--   Rank 2–3     → 400 pts
--   Rank 4–10    → 300 pts
--   Top 10%      → 200 pts
--   Top 25%      → 100 pts
--   Submitted+scored (floor) → 20 pts
--   Highest applicable tier wins; participation is the minimum.

-- ── 1. user_lineups.points_awarded ───────────────────────────

ALTER TABLE user_lineups
  ADD COLUMN IF NOT EXISTS points_awarded int NOT NULL DEFAULT 0;

-- ── 2. user_lineup_players.actual_fantasy_points ─────────────

ALTER TABLE user_lineup_players
  ADD COLUMN IF NOT EXISTS actual_fantasy_points numeric(8,2);

-- ── 3. points_transactions ───────────────────────────────────
--
-- One row per (lineup, reason).  The settlement job upserts on conflict
-- so re-running produces the same result.
--
-- reason values:
--   'daily_rank_reward'   — points based on final rank (includes participation floor)

CREATE TABLE IF NOT EXISTS points_transactions (
  id         uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid        NOT NULL,
  contest_id uuid        NOT NULL REFERENCES contests(id)      ON DELETE CASCADE,
  lineup_id  uuid        NOT NULL REFERENCES user_lineups(id)  ON DELETE CASCADE,
  amount     int         NOT NULL,
  reason     text        NOT NULL CHECK (reason IN ('daily_rank_reward', 'participation_reward')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lineup_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_pt_user    ON points_transactions (user_id);
CREATE INDEX IF NOT EXISTS idx_pt_contest ON points_transactions (contest_id);
CREATE INDEX IF NOT EXISTS idx_pt_lineup  ON points_transactions (lineup_id);

-- ── 4. Row Level Security (matches existing open pattern) ─────

ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_select_points_transactions"
  ON points_transactions FOR SELECT USING (true);
CREATE POLICY "allow_all_insert_points_transactions"
  ON points_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update_points_transactions"
  ON points_transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_delete_points_transactions"
  ON points_transactions FOR DELETE USING (true);
