-- 045_basketball_player_highlights.sql
--
-- Player Highlights feature for the community-league player profile.
--
-- Each row is a single highlight (image upload OR external video link)
-- attached to a basketball_players row. Edits/deletes are gated by the API
-- (lib/basketball/access.ts + highlights permission helper); RLS is
-- permissive with an `allow_all` policy so the service-role client keeps
-- full access, matching every other basketball_* table in this codebase.
--
-- `is_featured` is enforced as "at most one featured per player" by a
-- partial unique index; the API unsets the previous featured row in the
-- same transaction so toggling between highlights is seamless.
--
-- Storage bucket `basketball-player-highlights` (public read) is created
-- here; writes go through the service-role client in the upload route,
-- the same pattern as `basketball-player-avatars`.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS basketball_player_highlights (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  basketball_league_id  uuid        NOT NULL REFERENCES basketball_leagues(id) ON DELETE CASCADE,
  player_id             uuid        NOT NULL REFERENCES basketball_players(id) ON DELETE CASCADE,
  created_by            uuid        NOT NULL,
  media_type            text        NOT NULL
                                      CHECK (media_type IN ('image', 'video_link')),
  media_url             text        NOT NULL,
  storage_path          text,
  title                 text        NOT NULL,
  description           text,
  game_opponent         text,
  highlight_date        date,
  tag                   text,
  is_featured           boolean     NOT NULL DEFAULT false,
  visibility            text        NOT NULL DEFAULT 'public'
                                      CHECK (visibility IN ('public', 'members_only')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bball_player_highlights_player
  ON basketball_player_highlights (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bball_player_highlights_league
  ON basketball_player_highlights (basketball_league_id);

-- One featured highlight per player at a time.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bball_player_highlights_featured
  ON basketball_player_highlights (player_id)
  WHERE is_featured;

ALTER TABLE basketball_player_highlights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_all_basketball_player_highlights
  ON basketball_player_highlights;
CREATE POLICY allow_all_basketball_player_highlights
  ON basketball_player_highlights FOR ALL USING (true) WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-player-highlights', 'basketball-player-highlights', true)
ON CONFLICT (id) DO NOTHING;
