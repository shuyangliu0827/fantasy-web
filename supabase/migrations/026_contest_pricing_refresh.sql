-- Migration 026: SQL-side automatic pricing refresh for daily contests.
--
-- After migration 025, every newly-seeded contest gets fully-priced via the
-- JS builder (lib/contest-pool-builder.ts). That handles INSERTs cleanly,
-- but does nothing for already-seeded rows whose underlying season averages
-- or last-5 form drift over time. This migration adds a SQL function that
-- UPDATEs every contest_players row attached to a contest dated today or
-- later, so the daily price drift gets corrected automatically without
-- ever having to force-rebuild a contest (which would touch user lineups).
--
-- The math is duplicated from lib/contest-salary.ts and contest-pool-builder.ts
-- on purpose — we want the DB function to produce the same prices as the JS
-- seeder so contests are consistent regardless of which path created the row.
-- If the JS formula changes, change this file too.
--
-- Schedule lives at the bottom of this file as a pg_cron entry. pg_cron is
-- a Supabase extension (Database → Extensions → pg_cron); if your project
-- doesn't have it enabled, skip the SELECT cron.schedule(...) block and
-- call refresh_upcoming_contest_pricing() from your existing Vercel cron
-- via supabase.rpc('refresh_upcoming_contest_pricing') instead.

-- ── Salary curve ─────────────────────────────────────────────
-- Mirrors lib/contest-salary.ts:calcSalary exactly.
--   raw      = max(projected, 0) * 220 + 1500
--   rounded  = round(raw / 100) * 100
--   clamped  = clamp(rounded, 3000, 12000)
CREATE OR REPLACE FUNCTION contest_salary_for_projection(p_projected numeric)
RETURNS int
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT GREATEST(
    3000,
    LEAST(
      12000,
      (ROUND((GREATEST(COALESCE(p_projected, 0), 0) * 220 + 1500) / 100.0) * 100)::int
    )
  );
$$;

-- ── Last-5 rolling fpts average ──────────────────────────────
-- Mirrors lib/contest-pool-builder.ts:computeLastNAverages.
-- Returns NULL when the player has no valid stat row in the lookback
-- window — caller falls back to season_avg_fp.
CREATE OR REPLACE FUNCTION contest_last5_avg_fpts(
  p_player_id     text,
  p_contest_date  date,
  p_lookback_days int DEFAULT 30
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT AVG(fpts)::numeric
  FROM (
    SELECT fpts
    FROM player_day_stats
    WHERE player_id = p_player_id
      AND date < p_contest_date
      AND date >= p_contest_date - p_lookback_days
      AND fpts > 0
    ORDER BY date DESC
    LIMIT 5
  ) recent;
$$;

-- ── Refresh routine ──────────────────────────────────────────
-- Re-prices every contest_players row whose contest is dated today or
-- later. Idempotent. Only the price / projection / availability columns
-- move — player_id, contest_id, tier, fpts_scored stay put — so user
-- lineups remain attached and unaffected.
--
-- Returns the number of rows updated, so the pg_cron job log shows real
-- movement at a glance.
CREATE OR REPLACE FUNCTION refresh_upcoming_contest_pricing()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  rows_updated int := 0;
BEGIN
  WITH priced AS (
    SELECT
      cp.id,
      psc.injury,
      ROUND(COALESCE(psc.fpts_avg, 0)::numeric, 2)                       AS season_avg,
      ROUND(
        COALESCE(
          contest_last5_avg_fpts(cp.player_id, c.date),
          psc.fpts_avg,
          0
        )::numeric,
        2
      )                                                                  AS last5_avg
    FROM contest_players cp
    JOIN contests             c   ON c.id           = cp.contest_id
    JOIN player_stats_cache   psc ON psc.player_id  = cp.player_id::int
    WHERE c.date   >= CURRENT_DATE
      AND c.status IN ('pending', 'open')
  ),
  computed AS (
    SELECT
      id,
      season_avg,
      last5_avg,
      ROUND((0.6 * last5_avg + 0.4 * season_avg)::numeric, 2)              AS projected,
      contest_salary_for_projection(0.6 * last5_avg + 0.4 * season_avg)    AS salary,
      injury,
      (LOWER(COALESCE(injury, '')) NOT LIKE 'out%')                        AS available
    FROM priced
  )
  UPDATE contest_players cp
  SET
    last_5_avg_fp    = c.last5_avg,
    season_avg_fp    = c.season_avg,
    projected_points = c.projected,
    salary           = c.salary,
    injury_status    = c.injury,
    is_available     = c.available
  FROM computed c
  WHERE cp.id = c.id
    -- Skip writes when nothing has actually changed; keeps logs clean and
    -- avoids unnecessary WAL traffic on no-op runs.
    AND (
      cp.salary           IS DISTINCT FROM c.salary           OR
      cp.projected_points IS DISTINCT FROM c.projected        OR
      cp.last_5_avg_fp    IS DISTINCT FROM c.last5_avg        OR
      cp.season_avg_fp    IS DISTINCT FROM c.season_avg       OR
      cp.injury_status    IS DISTINCT FROM c.injury           OR
      cp.is_available     IS DISTINCT FROM c.available
    );

  GET DIAGNOSTICS rows_updated = ROW_COUNT;
  RETURN rows_updated;
END;
$$;

-- Grants: anon / authenticated should NOT call the refresh directly.
-- Only service_role (used by Supabase pg_cron + server-side RPC calls)
-- needs EXECUTE.
REVOKE EXECUTE ON FUNCTION refresh_upcoming_contest_pricing()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION contest_salary_for_projection(numeric)     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION contest_last5_avg_fpts(text, date, int)    FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION refresh_upcoming_contest_pricing()         TO service_role;
GRANT  EXECUTE ON FUNCTION contest_salary_for_projection(numeric)     TO service_role;
GRANT  EXECUTE ON FUNCTION contest_last5_avg_fpts(text, date, int)    TO service_role;

-- ── pg_cron schedule ─────────────────────────────────────────
-- Daily at 15:30 UTC, 30 min after seed-upcoming so net-new rows from the
-- 15:00 UTC cron have already landed before we re-price them. The full
-- daily cron lineup is now:
--   14:00 UTC  /api/contests/create-today    (Vercel cron, JS)
--   15:00 UTC  /api/contests/seed-upcoming   (Vercel cron, JS)
--   15:30 UTC  refresh_upcoming_contest_pricing()  (pg_cron, this file)
--
-- Wrapped in a DO block + EXCEPTION handler so the migration still
-- succeeds when pg_cron isn't enabled — in that case nothing schedules
-- and the user can either enable the extension or call the RPC from
-- their existing external cron.

DO $$
BEGIN
  -- Make the schedule itself idempotent: drop a stale entry before
  -- inserting the current one. cron.unschedule throws when the job
  -- doesn't exist, so swallow the exception.
  BEGIN
    PERFORM cron.unschedule('refresh-upcoming-contest-pricing');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  PERFORM cron.schedule(
    'refresh-upcoming-contest-pricing',
    '30 15 * * *',
    $cron$ SELECT refresh_upcoming_contest_pricing(); $cron$
  );
EXCEPTION WHEN undefined_function OR undefined_table OR insufficient_privilege THEN
  -- pg_cron not enabled / not authorized on this project. The functions
  -- still exist; call them from an external scheduler.
  RAISE NOTICE 'pg_cron not available — skipping schedule. Call refresh_upcoming_contest_pricing() from an external cron.';
END $$;
