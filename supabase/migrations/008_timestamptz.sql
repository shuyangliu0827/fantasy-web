-- Migration 008: Convert timestamp columns to timestamptz
-- Fixes timezone handling so Supabase returns ISO strings with +00:00 suffix,
-- allowing JS to parse timestamps as UTC instead of local time.
-- This eliminates the ±8h offset and -1天 display bug for UTC+8 users.

ALTER TABLE users
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE users
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE leagues
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE fantasy_teams
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE trade_proposals
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE leagues
  ALTER COLUMN draft_date TYPE timestamptz USING draft_date AT TIME ZONE 'UTC';

ALTER TABLE leagues
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE leagues
  ALTER COLUMN updated_at TYPE timestamptz USING updated_at AT TIME ZONE 'UTC';

ALTER TABLE league_members
  ALTER COLUMN joined_at TYPE timestamptz USING joined_at AT TIME ZONE 'UTC';

ALTER TABLE league_messages
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE draft_rooms
  ALTER COLUMN started_at TYPE timestamptz USING started_at AT TIME ZONE 'UTC',
  ALTER COLUMN completed_at TYPE timestamptz USING completed_at AT TIME ZONE 'UTC';

ALTER TABLE draft_picks
  ALTER COLUMN picked_at TYPE timestamptz USING picked_at AT TIME ZONE 'UTC';

ALTER TABLE insights
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';

ALTER TABLE comments
  ALTER COLUMN created_at TYPE timestamptz USING created_at AT TIME ZONE 'UTC';
