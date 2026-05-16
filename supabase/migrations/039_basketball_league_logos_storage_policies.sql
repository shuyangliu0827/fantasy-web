-- 039_basketball_league_logos_storage_policies.sql
--
-- Real Basketball League Infrastructure — storage RLS for league logos.
--
-- Migration 038 added the basketball-league-logos bucket (public read)
-- but never added INSERT/UPDATE/DELETE RLS policies on storage.objects
-- for it. When the API route falls back to the anon key
-- (SUPABASE_SERVICE_ROLE_KEY unset, or any caller hitting storage
-- under the authenticated role rather than service_role), the upload
-- silently fails with "row violates row-level security policy",
-- surfaced to the UI as `upload_failed`. Team logos and player avatars
-- already have parallel policies via migration 037 — this is the
-- missing third bucket.
--
-- Authorization mirrors the existing helper installed by migration 037:
-- public.can_manage_bball_league_storage(folder_text text). Path format
-- is `{leagueId}/logo.{ext}`; the first folder is the league id.
--
-- Idempotent.
-- ================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-league-logos', 'basketball-league-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS bball_league_logos_insert ON storage.objects;
DROP POLICY IF EXISTS bball_league_logos_update ON storage.objects;
DROP POLICY IF EXISTS bball_league_logos_delete ON storage.objects;

CREATE POLICY bball_league_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'basketball-league-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_league_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'basketball-league-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'basketball-league-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_league_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'basketball-league-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );
