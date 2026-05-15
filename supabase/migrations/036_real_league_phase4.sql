-- 036_real_league_phase4.sql
--
-- Real Basketball League Infrastructure — Phase 4
-- (player binding + admin edit/delete + avatar storage RLS).
--
-- Two concerns:
--
--   1. Supabase Storage RLS for the public image buckets created in
--      migration 034. Reads work today (public buckets), but writes
--      (`INSERT`/`UPDATE`/`DELETE` on `storage.objects`) are denied with
--      "new row violates row-level security policy" because no policies
--      were ever added. Authorization is path-based: every object is
--      stored under `{leagueId}/{entityId}.{ext}`, so we extract the
--      league id via `(storage.foldername(name))[1]` and grant access to
--      platform admins, league admins, and approved team managers in that
--      league.
--
--   2. A unique partial index on `basketball_players` so a single user
--      cannot hold two pending/approved claims in the same league. The
--      claim API also short-circuits this case, but the index is the
--      backstop against simultaneous submissions.
--
-- Idempotent (DROP POLICY IF EXISTS; CREATE INDEX IF NOT EXISTS).
-- ================================================================

-- ── 1. One pending/approved claim per (league, user) ─────────────

CREATE UNIQUE INDEX IF NOT EXISTS uniq_bball_players_league_user_active
  ON basketball_players (basketball_league_id, claimed_by_user_id)
  WHERE claimed_by_user_id IS NOT NULL
    AND claim_status IN ('pending', 'approved');

-- ── 2. storage.objects RLS for basketball image buckets ──────────
--
-- Authorized writers:
--   • platform admins (full access to both buckets), OR
--   • basketball_league_admins whose league_id matches the path's first folder, OR
--   • basketball_league_members with role='team_manager' and status='approved'
--     in that league.
-- Team-scoping (a manager only touching their own team's player avatars
-- and team logos) is enforced at the API layer, not here.

DROP POLICY IF EXISTS bball_team_logos_insert  ON storage.objects;
DROP POLICY IF EXISTS bball_team_logos_update  ON storage.objects;
DROP POLICY IF EXISTS bball_team_logos_delete  ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_insert ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_update ON storage.objects;
DROP POLICY IF EXISTS bball_player_avatars_delete ON storage.objects;

CREATE POLICY bball_team_logos_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'basketball-team-logos'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY bball_team_logos_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'basketball-team-logos'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY bball_team_logos_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'basketball-team-logos'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY bball_player_avatars_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'basketball-player-avatars'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY bball_player_avatars_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'basketball-player-avatars'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );

CREATE POLICY bball_player_avatars_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'basketball-player-avatars'
    AND (
      EXISTS (SELECT 1 FROM platform_admins pa WHERE pa.user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM basketball_league_admins la
        WHERE la.user_id = auth.uid()
          AND la.basketball_league_id::text = (storage.foldername(name))[1]
      )
      OR EXISTS (
        SELECT 1 FROM basketball_league_members lm
        WHERE lm.user_id = auth.uid()
          AND lm.role = 'team_manager'
          AND lm.status = 'approved'
          AND lm.basketball_league_id::text = (storage.foldername(name))[1]
      )
    )
  );
