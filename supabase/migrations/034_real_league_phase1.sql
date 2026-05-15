-- 034_real_league_phase1.sql
--
-- Real Basketball League Infrastructure — Phase 1.
--
-- Goals:
--   • Expand basketball_league_members role set to support the new
--     league-scoped role hierarchy: league_admin, team_manager, player,
--     referee, scorekeeper (+ legacy `viewer` retained).
--   • Migrate any existing `stat_keeper` rows to the canonical
--     `scorekeeper` value.
--   • Add team_id (nullable) to basketball_league_members so that
--     team_manager / player rows can be scoped to a team.
--   • Add `bio` to basketball_teams (team profile description).
--   • Add numeric `height_cm`, `weight_kg`, `birth_year`, and
--     `is_active` to basketball_players. Legacy text `height` / `weight`
--     columns are kept for back-compat.
--   • Create two public Supabase Storage buckets for image uploads:
--     basketball-team-logos and basketball-player-avatars.
--
-- All statements are idempotent (IF NOT EXISTS / DO blocks).
-- RLS remains permissive on the basketball_* tables — enforcement lives
-- in the API layer via lib/basketball/access.ts.
-- ================================================================

-- ── 1. basketball_league_members: roles + team_id ────────────────

UPDATE basketball_league_members
   SET role = 'scorekeeper'
 WHERE role = 'stat_keeper';

ALTER TABLE basketball_league_members
  DROP CONSTRAINT IF EXISTS basketball_league_members_role_check;

ALTER TABLE basketball_league_members
  ADD CONSTRAINT basketball_league_members_role_check
  CHECK (role IN (
    'league_admin',
    'team_manager',
    'player',
    'referee',
    'scorekeeper',
    'viewer'
  ));

ALTER TABLE basketball_league_members
  ADD COLUMN IF NOT EXISTS team_id uuid
    REFERENCES basketball_teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bball_league_members_team
  ON basketball_league_members (team_id);

-- ── 2. basketball_teams: bio ─────────────────────────────────────

ALTER TABLE basketball_teams
  ADD COLUMN IF NOT EXISTS bio text;

-- ── 3. basketball_players: profile fields ────────────────────────

ALTER TABLE basketball_players
  ADD COLUMN IF NOT EXISTS height_cm  numeric,
  ADD COLUMN IF NOT EXISTS weight_kg  numeric,
  ADD COLUMN IF NOT EXISTS birth_year int,
  ADD COLUMN IF NOT EXISTS is_active  boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_bball_players_active
  ON basketball_players (basketball_league_id, is_active);

-- ── 4. Storage buckets for uploads ───────────────────────────────
--
-- Public read access (logos and avatars are public artifacts). Writes
-- are gated by the API layer; the buckets themselves are world-readable
-- so getPublicUrl() works without a signed URL flow.

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-team-logos', 'basketball-team-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-player-avatars', 'basketball-player-avatars', true)
ON CONFLICT (id) DO NOTHING;
