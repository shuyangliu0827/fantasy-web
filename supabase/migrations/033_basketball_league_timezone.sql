-- 033_basketball_league_timezone.sql
--
-- Authorize-league contests need an authoritative "today" so admins
-- and players agree on which day a contest covers. Today's date is
-- computed in the league's timezone (e.g. CSBA admins set
-- 'Asia/Shanghai') rather than the server's UTC clock.
--
-- IANA name; default 'UTC' keeps existing leagues behaving as today.
-- Idempotent.
-- ================================================================

ALTER TABLE basketball_leagues
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';
