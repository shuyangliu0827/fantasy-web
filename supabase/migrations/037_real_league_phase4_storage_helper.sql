-- 037_real_league_phase4_storage_helper.sql
--
-- Real Basketball League Infrastructure — Phase 4 storage RLS hardening.
--
-- ────────────────────────────────────────────────────────────────────
-- WHY THIS MIGRATION EXISTS
-- ────────────────────────────────────────────────────────────────────
--
-- Migration 036 added six storage.objects RLS policies for the
-- basketball-team-logos and basketball-player-avatars buckets. Each
-- policy inlined two EXISTS subqueries against
-- basketball_league_admins and basketball_league_members. That design
-- is fragile in three ways:
--
--   1. **Scope drift.** 036 only matched team_manager members, leaving
--      out the league_admin member role from access.ts §isLeagueAdmin
--      (which already grants admin-equivalent rights via
--      `basketball_league_members.role='league_admin'`). League
--      admins whose grant lives in `basketball_league_members` (not
--      `basketball_league_admins`) were silently denied. A follow-up
--      hotfix tried to patch this but writes still failed.
--
--   2. **RLS visibility risk.** The EXISTS subqueries run as the
--      `authenticated` role evaluating the storage.objects policy.
--      If RLS on platform_admins / basketball_league_admins /
--      basketball_league_members ever tightens (or if the underlying
--      `allow_all` permissive policies are replaced), the EXISTS
--      silently returns false and the storage write is denied with
--      no actionable error message ("new row violates row-level
--      security policy"). Reading authorization data inline from the
--      storage policy ties write authorization to the read visibility
--      of three different tables.
--
--   3. **auth.uid() resolution timing.** auth.uid() is called four
--      times per policy evaluation across three different sub-trees.
--      Any layer that swallows the JWT (proxy quirk, anon session in
--      flight, edge-case caching) results in `auth.uid() IS NULL`
--      inside the EXISTS, which makes the comparison `user_id = NULL`
--      return false. The whole policy then fails with the same opaque
--      "row violates RLS" error — indistinguishable from a legitimate
--      authz denial.
--
-- ────────────────────────────────────────────────────────────────────
-- THE FIX
-- ────────────────────────────────────────────────────────────────────
--
-- Move the authorization check into ONE SECURITY DEFINER function:
--
--   public.can_manage_bball_league_storage(folder_text text) -> boolean
--
-- The function:
--   • runs with the function-owner's privileges, bypassing RLS on the
--     three source tables — no visibility risk;
--   • calls auth.uid() exactly once and short-circuits on NULL;
--   • parses the folder string into a UUID safely (returns false on
--     invalid_text_representation so a malformed path can never throw
--     a hard error inside the storage policy);
--   • returns true for the canonical "league-admin-like" set used by
--     lib/basketball/access.ts:
--       – platform_admins (any role)
--       – basketball_league_admins for this league (any role)
--       – approved basketball_league_members in this league with
--         role IN ('league_admin', 'team_manager')
--
-- Team scoping (a team manager only managing their own team's
-- player avatars / team logo) is preserved at the API layer
-- (lib/basketball/access.ts and the per-resource PATCH/POST handlers),
-- which is the only place that can cheaply resolve player_id ->
-- team_id. The storage policy answers a coarser question: "is this
-- user allowed to upload ANYTHING for this league?" — and that is
-- sufficient as the outer authorization ring.
--
-- Idempotent (CREATE OR REPLACE FUNCTION; DROP POLICY IF EXISTS …;
-- CREATE POLICY …). Safe to run twice.
-- ================================================================


-- ── 1. SECURITY DEFINER authorization helper ──────────────────────

CREATE OR REPLACE FUNCTION public.can_manage_bball_league_storage(folder_text text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid;
  lid uuid;
BEGIN
  uid := auth.uid();
  IF uid IS NULL OR folder_text IS NULL THEN
    RETURN false;
  END IF;

  BEGIN
    lid := folder_text::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    -- Path's first folder is not a UUID; this object isn't ours.
    RETURN false;
  END;

  IF EXISTS (
    SELECT 1 FROM public.platform_admins
    WHERE user_id = uid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.basketball_league_admins
    WHERE user_id = uid
      AND basketball_league_id = lid
  ) THEN
    RETURN true;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.basketball_league_members
    WHERE user_id = uid
      AND basketball_league_id = lid
      AND status = 'approved'
      AND role IN ('league_admin', 'team_manager')
  ) THEN
    RETURN true;
  END IF;

  RETURN false;
END
$$;

-- Allow both authenticated end-users (via storage policy) and the
-- service_role to call this. anon and public are intentionally not
-- granted EXECUTE.
REVOKE ALL ON FUNCTION public.can_manage_bball_league_storage(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_manage_bball_league_storage(text)
  TO authenticated, service_role;


-- ── 2. Replace storage.objects policies ───────────────────────────

DROP POLICY IF EXISTS bball_team_logos_insert     ON storage.objects;
DROP POLICY IF EXISTS bball_team_logos_update     ON storage.objects;
DROP POLICY IF EXISTS bball_team_logos_delete     ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_insert ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_update ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_delete ON storage.objects;

CREATE POLICY bball_team_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'basketball-team-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_team_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'basketball-team-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'basketball-team-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_team_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'basketball-team-logos'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_player_avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'basketball-player-avatars'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_player_avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'basketball-player-avatars'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'basketball-player-avatars'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );

CREATE POLICY bball_player_avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'basketball-player-avatars'
    AND public.can_manage_bball_league_storage((storage.foldername(name))[1])
  );


-- ────────────────────────────────────────────────────────────────────
-- VERIFICATION (run from psql as the relevant user, OR run via the
-- Supabase SQL editor with the desired auth.uid() set in session)
-- ────────────────────────────────────────────────────────────────────
--
-- 1. Confirm the function returns true for a known league admin:
--
--      SELECT public.can_manage_bball_league_storage(
--               '<league_uuid_as_text>'
--             ) AS can_upload;
--
--    The function uses auth.uid() internally; from the SQL editor,
--    set the local user with:
--      SET LOCAL ROLE authenticated;
--      SET LOCAL "request.jwt.claims" =
--        '{"sub":"<user_uuid>","role":"authenticated"}';
--
-- 2. Confirm a non-league user returns false for the same league.
--
-- 3. Confirm the storage policy itself evaluates against the function
--    rather than the previous EXISTS subqueries:
--
--      SELECT polname, polcmd, qual, with_check
--        FROM pg_policy
--       WHERE polrelid = 'storage.objects'::regclass
--         AND polname LIKE 'bball_%';
--
--    All six rows should show qual / with_check referencing
--    `public.can_manage_bball_league_storage`.
