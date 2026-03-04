-- =============================================
-- Migration 004: Schedule hourly NBA stats refresh
-- Uses pg_cron + pg_net to call the Supabase Edge Function
--
-- BEFORE RUNNING: replace the two placeholder values below:
--   YOUR_PROJECT_REF  → your Supabase project ref (e.g. abcdefghijklmno)
--                        found in: Dashboard → Settings → General → Reference ID
--   YOUR_ANON_KEY     → your project's anon key
--                        found in: Dashboard → Settings → API → Project API keys
-- =============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing job if it exists (safe to re-run)
SELECT cron.unschedule('refresh-nba-stats-hourly')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'refresh-nba-stats-hourly'
);

-- Schedule: every hour at :00
SELECT cron.schedule(
  'refresh-nba-stats-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://yjdlllhntfxvgvjgdnsw.supabase.co/functions/v1/refresh-nba-stats',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
  $$
);

-- Verify the job was created
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'refresh-nba-stats-hourly';
