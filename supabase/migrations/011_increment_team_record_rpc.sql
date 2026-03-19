-- Migration 011: Add increment_team_record RPC function for atomic wins/losses/ties updates.
-- This is used by saveWeeklyMatchupResult() in lib/store.ts to safely increment
-- fantasy team records when weekly matchup results are persisted.

CREATE OR REPLACE FUNCTION increment_team_record(
  p_team_id    uuid,
  p_wins       int DEFAULT 0,
  p_losses     int DEFAULT 0,
  p_ties       int DEFAULT 0,
  p_points_for numeric DEFAULT 0,
  p_points_against numeric DEFAULT 0
) RETURNS void
LANGUAGE sql
AS $$
  UPDATE fantasy_teams
  SET
    wins          = wins          + p_wins,
    losses        = losses        + p_losses,
    ties          = ties          + p_ties,
    points_for    = points_for    + p_points_for,
    points_against = points_against + p_points_against
  WHERE id = p_team_id;
$$;

-- Add a unique constraint on matchups so we can safely upsert by week + team pair
ALTER TABLE matchups
  ADD CONSTRAINT matchups_league_week_teams_unique
  UNIQUE (league_id, week, home_team_id, away_team_id);
