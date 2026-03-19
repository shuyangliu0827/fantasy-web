-- Migration 011: canonical roster ownership history
-- Adds a timestamp-aware ownership table so current roster, historical roster,
-- lineup history, matchup scoring, and standings can all read the same source of truth.

CREATE TABLE IF NOT EXISTS roster_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES fantasy_teams(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  player_payload jsonb NOT NULL,
  acquisition_type text,
  effective_start_at timestamptz NOT NULL DEFAULT now(),
  effective_end_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_end_at IS NULL OR effective_end_at > effective_start_at)
);

CREATE INDEX IF NOT EXISTS idx_roster_history_team_window
  ON roster_history (team_id, effective_start_at, effective_end_at);

CREATE INDEX IF NOT EXISTS idx_roster_history_league_player_window
  ON roster_history (league_id, player_id, effective_start_at, effective_end_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_history_active_player_per_league
  ON roster_history (league_id, player_id)
  WHERE effective_end_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_history_active_player_per_team
  ON roster_history (team_id, player_id)
  WHERE effective_end_at IS NULL;

ALTER TABLE roster_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'roster_history' AND policyname = 'allow_all_select_roster_history'
  ) THEN
    CREATE POLICY "allow_all_select_roster_history" ON roster_history FOR SELECT USING (true);
    CREATE POLICY "allow_all_insert_roster_history" ON roster_history FOR INSERT WITH CHECK (true);
    CREATE POLICY "allow_all_update_roster_history" ON roster_history FOR UPDATE USING (true) WITH CHECK (true);
    CREATE POLICY "allow_all_delete_roster_history" ON roster_history FOR DELETE USING (true);
  END IF;
END $$;

-- Backfill active history rows for teams whose JSON roster_data already exists.
INSERT INTO roster_history (
  league_id,
  team_id,
  player_id,
  player_payload,
  acquisition_type,
  effective_start_at,
  effective_end_at
)
SELECT
  ft.league_id,
  ft.id,
  player.value->>'id' AS player_id,
  player.value AS player_payload,
  COALESCE(player.value->>'acquiredVia', 'draft') AS acquisition_type,
  COALESCE((to_timestamp(NULLIF(player.value->>'acquiredAt', '')::double precision / 1000.0)), ft.created_at) AS effective_start_at,
  NULL AS effective_end_at
FROM fantasy_teams ft
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ft.roster_data, '[]'::jsonb)) AS player(value)
WHERE player.value ? 'id'
ON CONFLICT DO NOTHING;
