-- 041_basketball_game_videos.sql
--
-- Direct video uploads for game highlights.
--   1. New storage bucket `basketball-game-videos` (public read).
--      Writes are gated by the API; uploads go through the service-role
--      client (matches the existing avatar/logo pattern after migration
--      036/037/038).
--   2. Extend basketball_game_media so we can distinguish legacy external
--      links from uploaded video files and so the UI can render them
--      directly without inferring from `url`.
--
-- All statements are idempotent and additive — existing media rows
-- (media_type='link', url=<external>) keep working unchanged.

INSERT INTO storage.buckets (id, name, public)
VALUES ('basketball-game-videos', 'basketball-game-videos', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE basketball_game_media
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'external_link'
    CHECK (source_type IN ('external_link', 'upload'));

ALTER TABLE basketball_game_media
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE basketball_game_media
  ADD COLUMN IF NOT EXISTS mime_type text;

ALTER TABLE basketball_game_media
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;
