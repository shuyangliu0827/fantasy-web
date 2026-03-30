-- ============================================================
-- 020_fix_release_player_rpc.sql
--
-- Fixes release_player to handle players that were drafted before
-- the ownership table was seeded (upsert_draft_ownerships not called).
--
-- Old behaviour: UPDATE ... WHERE team_id = p_team_id
--   → NOT FOUND if the player has no ownership row at all → error
--
-- New behaviour:
--   1. Reject if player is actively owned by a DIFFERENT team.
--   2. Otherwise upsert with team_id = NULL (handles both "owned by
--      this team" and "unseeded / no row yet" cases transparently).
-- ============================================================

CREATE OR REPLACE FUNCTION release_player(
  p_league_id uuid,
  p_team_id   uuid,
  p_player_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Reject if a different team currently owns this player
  IF EXISTS (
    SELECT 1 FROM league_player_ownerships
    WHERE  league_id = p_league_id
      AND  player_id = p_player_id
      AND  team_id  IS NOT NULL
      AND  team_id  != p_team_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', '该球员属于另一支队伍，无法放弃');
  END IF;

  -- Release: insert or update to team_id = NULL
  -- Covers three cases cleanly:
  --   a) Player owned by p_team_id  → update team_id to NULL
  --   b) Player already free agent  → upsert is a no-op (already NULL)
  --   c) No row at all (unseeded)   → insert a free-agent record
  INSERT INTO league_player_ownerships (league_id, player_id, team_id, acquired_via)
  VALUES (p_league_id, p_player_id, NULL, 'release')
  ON CONFLICT (league_id, player_id)
  DO UPDATE SET team_id = NULL, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$$;
