-- Migration 025: salary-cap pricing on contest_players.
--
-- Daily Fantasy is moving from a tier-quota lineup constraint
-- (1 T1 + 1 T2 + 1 T3 + 2 T4) to a $50,000 salary-cap constraint:
-- pick any 5 eligible players whose combined `salary` <= 50000.
--
-- Tier is retained as a display / filter aid (still computed by quartile of
-- fpts_avg at seed time) but is no longer enforced.
--
-- Per-player daily projection + price columns live ON contest_players
-- rather than a parallel `daily_player_pool` table because:
--   - contest_players is already the per-(contest, player) pool — reusing it
--     keeps a single source of truth.
--   - user_lineup_players references player_id by text and the validation
--     check assumes a row exists in contest_players for the same contest;
--     splitting into a second table would either duplicate that data or
--     require new foreign keys.
--
-- Salary formula (computed at seed time, mirrored in lib/contest-salary.ts):
--   projected_points = 0.6 * last_5_avg_fp + 0.4 * season_avg_fp
--   raw_salary       = projected_points * 220 + 1500
--   salary           = clamp(round(raw_salary / 100) * 100, 3000, 12000)
--
-- Existing contest_players rows pre-migration are not retroactively repriced.
-- They get default values (salary=5000, season_avg_fp from a NULL-safe
-- fallback). New contests created after this migration ships will have real
-- prices written by lib/contest-pool-builder.ts.

ALTER TABLE contest_players
  ADD COLUMN IF NOT EXISTS salary           int          NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS projected_points numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_5_avg_fp    numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS season_avg_fp    numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS injury_status    text,
  ADD COLUMN IF NOT EXISTS is_available     boolean      NOT NULL DEFAULT true;

-- Salary bounds enforced at the DB layer so a buggy seeder can never write
-- a price outside the contract.
ALTER TABLE contest_players
  DROP CONSTRAINT IF EXISTS contest_players_salary_range;

ALTER TABLE contest_players
  ADD CONSTRAINT contest_players_salary_range
  CHECK (salary BETWEEN 3000 AND 12000);

-- Filter index for the common "show available players for this contest" read.
CREATE INDEX IF NOT EXISTS idx_cp_contest_available
  ON contest_players (contest_id, is_available);
