-- ============================================================
-- 021_fix_claim_free_agent_rpc.sql
--
-- Fixes the embedded "drop" step inside claim_free_agent.
--
-- Old behaviour: UPDATE ... WHERE team_id = p_team_id; then
--   IF NOT FOUND → return error.
--   Fails when the drop player has no ownership row (unseeded
--   draft pick = upsert_draft_ownerships never ran).
--
-- New behaviour (same pattern as migration 020 for release_player):
--   1. Reject only if the drop player is owned by a DIFFERENT team.
--   2. Otherwise upsert team_id = NULL — handles both the normal
--      "owned by this team" case AND the unseeded case transparently.
-- ============================================================

CREATE OR REPLACE FUNCTION claim_free_agent(
  p_league_id      uuid,
  p_team_id        uuid,
  p_player_id      text,
  p_drop_player_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_owner uuid;
BEGIN
  -- Transaction-scoped advisory lock on (league_id, player_id)
  PERFORM pg_advisory_xact_lock(
    ('x' || substring(md5(p_league_id::text || '|' || p_player_id), 1, 16))::bit(64)::bigint
  );

  -- Re-read inside the lock to check current ownership
  SELECT team_id INTO v_current_owner
  FROM   league_player_ownerships
  WHERE  league_id = p_league_id AND player_id = p_player_id;

  IF v_current_owner IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '该球员刚刚已被其他队伍签下');
  END IF;

  -- ── Drop step (fixed) ─────────────────────────────────────────────────
  -- Old: UPDATE ... WHERE team_id = p_team_id → NOT FOUND if no row exists
  -- New: reject only if owned by a different team; upsert NULL otherwise
  IF p_drop_player_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM league_player_ownerships
      WHERE  league_id = p_league_id
        AND  player_id = p_drop_player_id
        AND  team_id  IS NOT NULL
        AND  team_id  != p_team_id
    ) THEN
      RETURN jsonb_build_object('ok', false, 'error', '要放弃的球员不在你的队伍中');
    END IF;

    INSERT INTO league_player_ownerships (league_id, player_id, team_id, acquired_via)
    VALUES (p_league_id, p_drop_player_id, NULL, 'release')
    ON CONFLICT (league_id, player_id)
    DO UPDATE SET team_id = NULL, updated_at = now();
  END IF;

  -- ── Claim step ────────────────────────────────────────────────────────
  INSERT INTO league_player_ownerships
         (league_id, player_id, team_id, acquired_via, acquired_at)
  VALUES (p_league_id, p_player_id, p_team_id, 'pickup', now())
  ON CONFLICT (league_id, player_id)
  DO UPDATE SET
    team_id      = p_team_id,
    acquired_via = 'pickup',
    updated_at   = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
