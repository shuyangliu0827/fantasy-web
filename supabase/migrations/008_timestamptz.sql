-- Migration 008: Convert timestamp columns to timestamptz
-- Fixes timezone handling so Supabase returns ISO strings with +00:00 suffix.

-- users (only has created_at, no updated_at)
ALTER TABLE users
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- nba_teams
ALTER TABLE nba_teams
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- nba_players
ALTER TABLE nba_players
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- nba_player_stats
ALTER TABLE nba_player_stats
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- nba_contracts
ALTER TABLE nba_contracts
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- leagues
ALTER TABLE leagues
  ALTER COLUMN draft_date TYPE timestamptz USING draft_date AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

-- league_members
ALTER TABLE league_members
  ALTER COLUMN joined_at TYPE timestamptz USING joined_at AT TIME ZONE 'UTC';

-- fantasy_teams (only has created_at)
ALTER TABLE fantasy_teams
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- roster_players
ALTER TABLE roster_players
  ALTER COLUMN acquired_at TYPE timestamptz USING acquired_at AT TIME ZONE 'UTC';

-- drafts
ALTER TABLE drafts
  ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';

-- draft_picks
ALTER TABLE draft_picks
  ALTER COLUMN picked_at TYPE timestamptz USING picked_at AT TIME ZONE 'UTC';

-- transactions
ALTER TABLE transactions
  ALTER COLUMN processed_at TYPE timestamptz USING processed_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- trade_proposals
ALTER TABLE trade_proposals
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN resolved_at TYPE timestamptz USING resolved_at AT TIME ZONE 'UTC';

-- insights (community posts — primary cause of -1天 bug)
ALTER TABLE insights
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- comments
ALTER TABLE comments
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

-- league_messages (board posts — if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'league_messages') THEN
    ALTER TABLE league_messages
      ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
  END IF;
END $$;

-- draft_rooms (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'draft_rooms') THEN
    ALTER TABLE draft_rooms
      ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC',
      ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';
  END IF;
END $$;
