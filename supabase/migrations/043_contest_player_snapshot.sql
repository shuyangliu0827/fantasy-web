-- ============================================================
-- 043_contest_player_snapshot.sql
--
-- Daily-contest snapshot consistency fix.
--
-- contest_players is the authoritative per-(contest, player) pool, but
-- until now it only stored the *numeric* contest fields (tier, salary,
-- projected_points, ...). Display fields — team, name, position — were
-- re-derived at read time on every endpoint, each joining
-- player_stats_cache independently. Only the build endpoint applied the
-- authoritative current-roster override, so my-lineup / leaderboard /
-- my-lineups could show a stale post-trade team (e.g. LAC for a player
-- who is now on CLE).
--
-- This migration freezes the contest snapshot ON contest_players so all
-- read endpoints can read ONE source of truth:
--
--   display_name        — name shown for this contest (BDL cache name)
--   team                — CONTEST SNAPSHOT team (the current-roster team
--                         resolved at build time, NOT player_stats_cache.team)
--   position            — canonical position ("PG", "SG/SF", ...)
--   roster_source       — provenance of the team value (e.g. "bdl_players_active")
--   roster_validated_at — when the roster source was validated
--
-- All columns are nullable so legacy rows (created before this migration)
-- don't violate the schema. Those contests must be rebuilt via
-- /api/contests/create-today?force=true to populate the snapshot; read
-- endpoints fall back to the authoritative current-roster source (never
-- player_stats_cache.team) when the snapshot is empty.
-- ============================================================

ALTER TABLE contest_players
  ADD COLUMN IF NOT EXISTS display_name        text,
  ADD COLUMN IF NOT EXISTS team                text,
  ADD COLUMN IF NOT EXISTS position            text,
  ADD COLUMN IF NOT EXISTS roster_source       text,
  ADD COLUMN IF NOT EXISTS roster_validated_at timestamptz;
