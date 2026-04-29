-- 028_user_lineups_security_fix.sql
--
-- Verified facts about the existing schema (DO NOT assume — read from migrations):
--   • Contest table name: `contests`  (migration 023)
--   • user_lineups already has: id, contest_id, user_id, status, total_fpts,
--                               rank, submitted_at, created_at
--   • user_lineup_players already has: id, lineup_id, player_id, slot
--   • Migration 027 may or may not have been applied; this migration is idempotent.
--
-- What this migration adds / fixes:
--   1. user_lineups   : points_awarded, locked_at, completed_at
--   2. user_lineup_players: actual_fantasy_points
--   3. points_transactions table (CREATE IF NOT EXISTS)
--   4. Secure RLS on points_transactions:
--      • SELECT: users can only read their own records
--      • INSERT / UPDATE / DELETE: blocked for anon / authenticated roles
--        (settlement writes via service_role key which bypasses RLS)
--   5. Drops the overly-permissive policies that migration 027 may have created
--
-- All statements use IF NOT EXISTS / IF EXISTS so this is safe to re-run.
--
-- NOTE: total_fpts is kept as-is (column already exists and code relies on it).
--       Do NOT add a duplicate total_fantasy_points column.
-- ================================================================

-- ── 1. user_lineups — add missing columns ─────────────────────

ALTER TABLE user_lineups
  ADD COLUMN IF NOT EXISTS points_awarded  int          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_at       timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at    timestamptz;

-- ── 2. user_lineup_players — add actual_fantasy_points ─────────

ALTER TABLE user_lineup_players
  ADD COLUMN IF NOT EXISTS actual_fantasy_points numeric(8,2);

-- ── 3. points_transactions — create if not exists ──────────────
--
-- One row per (lineup_id, reason).
-- UNIQUE (lineup_id, reason) is the idempotency key:
--   settlement can UPSERT and will UPDATE amount on re-runs,
--   never inserting a duplicate.

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

-- ── 4. Secure RLS on points_transactions ───────────────────────
--
-- DROP the open policies that migration 027 may have created, then
-- recreate with proper scoping.
--
-- Policy model:
--   SELECT  — authenticated users can read their OWN records only
--   INSERT  — NO policy (blocked for anon / authenticated)
--   UPDATE  — NO policy (blocked for anon / authenticated)
--   DELETE  — NO policy (blocked for anon / authenticated)
--
-- The settlement job must use SUPABASE_SERVICE_ROLE_KEY, which bypasses
-- RLS entirely, to write to this table.

ALTER TABLE points_transactions ENABLE ROW LEVEL SECURITY;

-- Clean up any over-permissive policies from migration 027 (safe if they don't exist).
DROP POLICY IF EXISTS "allow_all_select_points_transactions"  ON points_transactions;
DROP POLICY IF EXISTS "allow_all_insert_points_transactions"  ON points_transactions;
DROP POLICY IF EXISTS "allow_all_update_points_transactions"  ON points_transactions;
DROP POLICY IF EXISTS "allow_all_delete_points_transactions"  ON points_transactions;

-- Users can only see their own point transactions.
CREATE POLICY IF NOT EXISTS "pts_select_own"
  ON points_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

-- No INSERT / UPDATE / DELETE policies.
-- Writes are done by the settlement backend using the service_role key,
-- which bypasses RLS. Anon and authenticated roles cannot write.
