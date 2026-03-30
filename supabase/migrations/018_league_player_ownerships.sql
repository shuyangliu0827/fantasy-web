-- ============================================================
-- 018_league_player_ownerships.sql
--
-- Adds a central ownership table so every player in a league
-- has exactly ONE owner (team_id = null means free agent).
--
-- This is the source of truth that prevents:
--   • the same player appearing on two teams
--   • a drafted/picked-up player staying in the free agent pool
--   • concurrent pickups claiming the same player
-- ============================================================

-- ── 1. Ownership table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS league_player_ownerships (
  id           uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id    uuid        NOT NULL REFERENCES leagues(id)      ON DELETE CASCADE,
  player_id    text        NOT NULL,
  team_id      uuid        REFERENCES fantasy_teams(id)         ON DELETE SET NULL,
  acquired_via text,        -- 'draft' | 'pickup' | 'trade' | 'commissioner'
  acquired_at  timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),

  -- THE KEY CONSTRAINT: one record per player per league
  UNIQUE (league_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_lpo_league_team
  ON league_player_ownerships (league_id, team_id);

CREATE INDEX IF NOT EXISTS idx_lpo_league_free
  ON league_player_ownerships (league_id)
  WHERE team_id IS NULL;

-- ── 2. Backfill from existing roster_data ─────────────────────────────────
-- Walks every fantasy_teams.roster_data array and inserts ownership records
-- for active (non-released) players.  ON CONFLICT DO NOTHING is safe to run
-- multiple times.

INSERT INTO league_player_ownerships
       (league_id, player_id, team_id, acquired_via, acquired_at)
SELECT DISTINCT ON (ft.league_id, p.value ->> 'id')
  ft.league_id,
  p.value ->> 'id'                                          AS player_id,
  ft.id                                                     AS team_id,
  COALESCE(p.value ->> 'acquiredVia', 'draft')              AS acquired_via,
  COALESCE(
    to_timestamp((p.value ->> 'acquiredAt')::bigint / 1000),
    now()
  )                                                         AS acquired_at
FROM  fantasy_teams ft
CROSS JOIN LATERAL jsonb_array_elements(
  CASE WHEN jsonb_typeof(ft.roster_data) = 'array'
       THEN ft.roster_data ELSE '[]'::jsonb END
) AS p(value)
WHERE (p.value ->> 'id') IS NOT NULL
  AND (p.value ->> 'releasedAt') IS NULL   -- skip historically-dropped players
ORDER BY ft.league_id, (p.value ->> 'id'), ft.id  -- deterministic on duplicates
ON CONFLICT (league_id, player_id) DO NOTHING;

-- ── 3. Clean up dirty duplicates in roster_data ───────────────────────────
-- Removes players that appear on more than one team for the same league:
-- keeps the team that was inserted first (lowest team uuid as tiebreaker).

WITH
dup_owners AS (
  SELECT league_id, player_id, COUNT(*) AS cnt
  FROM   league_player_ownerships
  WHERE  team_id IS NOT NULL
  GROUP  BY league_id, player_id
  HAVING COUNT(*) > 1
),
keep AS (
  SELECT DISTINCT ON (o.league_id, o.player_id)
    o.id AS keep_id
  FROM   league_player_ownerships o
  JOIN   dup_owners d USING (league_id, player_id)
  ORDER  BY o.league_id, o.player_id, o.team_id
),
to_free AS (
  SELECT o.id
  FROM   league_player_ownerships o
  JOIN   dup_owners d USING (league_id, player_id)
  WHERE  o.id NOT IN (SELECT keep_id FROM keep)
)
UPDATE league_player_ownerships
SET    team_id = NULL, updated_at = now()
WHERE  id IN (SELECT id FROM to_free);

-- ── 4. RPC: claim_free_agent ──────────────────────────────────────────────
-- Atomically checks availability and claims a free agent.
-- Uses an advisory lock keyed on (league_id, player_id) to prevent two
-- concurrent pickups from succeeding for the same player.

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
  -- Transaction-scoped advisory lock; hash the combined key into a bigint
  PERFORM pg_advisory_xact_lock(
    ('x' || substring(md5(p_league_id::text || '|' || p_player_id), 1, 16))::bit(64)::bigint
  );

  -- Re-read inside the lock
  SELECT team_id INTO v_current_owner
  FROM   league_player_ownerships
  WHERE  league_id = p_league_id AND player_id = p_player_id;

  IF v_current_owner IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', '该球员刚刚已被其他队伍签下');
  END IF;

  -- Drop a player from this team first, if requested
  IF p_drop_player_id IS NOT NULL THEN
    UPDATE league_player_ownerships
      SET team_id = NULL, updated_at = now()
    WHERE league_id = p_league_id
      AND player_id = p_drop_player_id
      AND team_id   = p_team_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('ok', false, 'error', '要放弃的球员不在你的队伍中');
    END IF;
  END IF;

  -- Claim the player (INSERT if new, UPDATE if previously released)
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

-- ── 5. RPC: release_player ────────────────────────────────────────────────

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
  UPDATE league_player_ownerships
    SET team_id = NULL, updated_at = now()
  WHERE league_id = p_league_id
    AND player_id = p_player_id
    AND team_id   = p_team_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', '球员不在该队伍中');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 6. RPC: execute_trade_ownership ──────────────────────────────────────

CREATE OR REPLACE FUNCTION execute_trade_ownership(
  p_league_id     uuid,
  p_from_team_id  uuid,
  p_to_team_id    uuid,
  p_offered_ids   text[],
  p_requested_ids text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Transfer offered players: from → to
  UPDATE league_player_ownerships
    SET team_id = p_to_team_id, acquired_via = 'trade', updated_at = now()
  WHERE league_id = p_league_id
    AND player_id = ANY(p_offered_ids)
    AND team_id   = p_from_team_id;

  -- Transfer requested players: to → from
  UPDATE league_player_ownerships
    SET team_id = p_from_team_id, acquired_via = 'trade', updated_at = now()
  WHERE league_id = p_league_id
    AND player_id = ANY(p_requested_ids)
    AND team_id   = p_to_team_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 7. RPC: upsert_draft_ownerships ──────────────────────────────────────
-- Called once when a draft completes to seed the ownership table from the
-- draft_picks_data array stored on the leagues row.

CREATE OR REPLACE FUNCTION upsert_draft_ownerships(
  p_league_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_pick   jsonb;
  v_player text;
  v_team   uuid;
BEGIN
  FOR v_pick IN
    SELECT jsonb_array_elements(
      CASE WHEN jsonb_typeof(draft_picks_data) = 'array'
           THEN draft_picks_data ELSE '[]'::jsonb END
    )
    FROM leagues WHERE id = p_league_id
  LOOP
    v_player := v_pick ->> 'playerId';
    v_team   := (v_pick ->> 'teamId')::uuid;

    IF v_player IS NULL OR v_team IS NULL THEN CONTINUE; END IF;

    INSERT INTO league_player_ownerships
           (league_id, player_id, team_id, acquired_via)
    VALUES (p_league_id, v_player, v_team, 'draft')
    ON CONFLICT (league_id, player_id)
    DO UPDATE SET
      team_id      = v_team,
      acquired_via = 'draft',
      updated_at   = now();
  END LOOP;
END;
$$;
