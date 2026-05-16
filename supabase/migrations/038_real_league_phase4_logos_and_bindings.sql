-- 038_real_league_phase4_logos_and_bindings.sql
--
-- Real Basketball League Infrastructure — Phase 4 follow-up.
--
--   1. basketball_leagues.logo_url — leagues can now display a logo.
--   2. basketball-league-logos storage bucket (public read).
--      Writes are gated by the API; uploads are server-side via the
--      service-role client (the canonical pattern after the avatar-RLS
--      saga in migrations 036/037).
--
-- All statements are idempotent.
-- ================================================================

ALTER TABLE basketball_leagues
  ADD COLUMN IF NOT EXISTS logo_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-league-logos', 'basketball-league-logos', true)
ON CONFLICT (id) DO NOTHING;
