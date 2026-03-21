-- Migration 014: Add ON DELETE CASCADE to league child tables
-- Allows a league to be fully deleted without manually clearing child records first.
-- Also sets ON DELETE SET NULL for nullable team references so those don't block.

-- league_members
ALTER TABLE league_members DROP CONSTRAINT IF EXISTS league_members_league_id_fkey;
ALTER TABLE league_members ADD CONSTRAINT league_members_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

-- transactions
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_league_id_fkey;
ALTER TABLE transactions ADD CONSTRAINT transactions_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

-- transaction_players → cascade from transactions
ALTER TABLE transaction_players DROP CONSTRAINT IF EXISTS transaction_players_transaction_id_fkey;
ALTER TABLE transaction_players ADD CONSTRAINT transaction_players_transaction_id_fkey
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE;

-- transaction_players team refs → SET NULL (nullable columns)
ALTER TABLE transaction_players DROP CONSTRAINT IF EXISTS transaction_players_from_team_id_fkey;
ALTER TABLE transaction_players ADD CONSTRAINT transaction_players_from_team_id_fkey
  FOREIGN KEY (from_team_id) REFERENCES fantasy_teams(id) ON DELETE SET NULL;

ALTER TABLE transaction_players DROP CONSTRAINT IF EXISTS transaction_players_to_team_id_fkey;
ALTER TABLE transaction_players ADD CONSTRAINT transaction_players_to_team_id_fkey
  FOREIGN KEY (to_team_id) REFERENCES fantasy_teams(id) ON DELETE SET NULL;

-- drafts
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_league_id_fkey;
ALTER TABLE drafts ADD CONSTRAINT drafts_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

-- draft_picks → cascade from drafts
ALTER TABLE draft_picks DROP CONSTRAINT IF EXISTS draft_picks_draft_id_fkey;
ALTER TABLE draft_picks ADD CONSTRAINT draft_picks_draft_id_fkey
  FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE CASCADE;

-- draft_picks.team_id → cascade when team deleted
ALTER TABLE draft_picks DROP CONSTRAINT IF EXISTS draft_picks_team_id_fkey;
ALTER TABLE draft_picks ADD CONSTRAINT draft_picks_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES fantasy_teams(id) ON DELETE CASCADE;

-- matchups
ALTER TABLE matchups DROP CONSTRAINT IF EXISTS matchups_league_id_fkey;
ALTER TABLE matchups ADD CONSTRAINT matchups_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

ALTER TABLE matchups DROP CONSTRAINT IF EXISTS matchups_home_team_id_fkey;
ALTER TABLE matchups ADD CONSTRAINT matchups_home_team_id_fkey
  FOREIGN KEY (home_team_id) REFERENCES fantasy_teams(id) ON DELETE CASCADE;

ALTER TABLE matchups DROP CONSTRAINT IF EXISTS matchups_away_team_id_fkey;
ALTER TABLE matchups ADD CONSTRAINT matchups_away_team_id_fkey
  FOREIGN KEY (away_team_id) REFERENCES fantasy_teams(id) ON DELETE CASCADE;

ALTER TABLE matchups DROP CONSTRAINT IF EXISTS matchups_winner_id_fkey;
ALTER TABLE matchups ADD CONSTRAINT matchups_winner_id_fkey
  FOREIGN KEY (winner_id) REFERENCES fantasy_teams(id) ON DELETE SET NULL;

-- fantasy_teams (last — other cascades must be set before this)
ALTER TABLE fantasy_teams DROP CONSTRAINT IF EXISTS fantasy_teams_league_id_fkey;
ALTER TABLE fantasy_teams ADD CONSTRAINT fantasy_teams_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE CASCADE;

-- insights.league_id is nullable → SET NULL on league delete
ALTER TABLE insights DROP CONSTRAINT IF EXISTS insights_league_id_fkey;
ALTER TABLE insights ADD CONSTRAINT insights_league_id_fkey
  FOREIGN KEY (league_id) REFERENCES leagues(id) ON DELETE SET NULL;
