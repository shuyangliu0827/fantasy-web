-- 046_basketball_player_highlights_v2.sql
--
-- Player Highlights v2 — separate columns for uploaded media and external
-- links, add an optional thumbnail, and add the `video_file` media type
-- alongside the existing `image` and `video_link`.
--
-- Why split media_url / external_url:
--   v1 packed both the uploaded file URL and the pasted external link into
--   a single `media_url` column. v2 stores them in dedicated columns so
--   the UI never has to guess whether to render an <img>, a <video>, or an
--   external "Watch" link. media_url is the storage URL for uploads; the
--   external_url is the user-pasted YouTube/Bilibili/etc URL.
--
-- Backfill rule (idempotent):
--   • video_link rows where media_url is set and external_url is null →
--     copy media_url into external_url, null out media_url.
--   • image and (new) video_file rows are left as-is.
--
-- The `media_url` column was NOT NULL in v1; we relax it to NULL so the
-- video_link path can store only external_url. The CHECK constraint
-- enforces "at least one URL field is populated" instead.

ALTER TABLE basketball_player_highlights
  ADD COLUMN IF NOT EXISTS external_url  text;

ALTER TABLE basketball_player_highlights
  ADD COLUMN IF NOT EXISTS thumbnail_url text;

-- Relax NOT NULL on media_url so video_link rows can omit it.
ALTER TABLE basketball_player_highlights
  ALTER COLUMN media_url DROP NOT NULL;

-- Backfill: move legacy video_link.media_url → external_url.
UPDATE basketball_player_highlights
   SET external_url = media_url,
       media_url    = NULL
 WHERE media_type   = 'video_link'
   AND external_url IS NULL
   AND media_url    IS NOT NULL;

-- Replace the media_type CHECK to allow video_file.
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
    FROM pg_constraint
   WHERE conrelid = 'basketball_player_highlights'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%media_type%';
  IF c_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE basketball_player_highlights DROP CONSTRAINT %I',
      c_name
    );
  END IF;
END $$;

ALTER TABLE basketball_player_highlights
  ADD CONSTRAINT basketball_player_highlights_media_type_check
  CHECK (media_type IN ('image', 'video_file', 'video_link'));

-- Require at least one URL field. video_link rows have external_url; image
-- and video_file rows have media_url. (Defensive — the API also enforces.)
ALTER TABLE basketball_player_highlights
  DROP CONSTRAINT IF EXISTS basketball_player_highlights_url_present_check;
ALTER TABLE basketball_player_highlights
  ADD CONSTRAINT basketball_player_highlights_url_present_check
  CHECK (
    (media_type = 'video_link' AND external_url IS NOT NULL)
    OR
    (media_type IN ('image', 'video_file') AND media_url IS NOT NULL)
  );
