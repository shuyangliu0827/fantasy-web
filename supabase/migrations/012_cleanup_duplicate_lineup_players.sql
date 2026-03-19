-- 012_cleanup_duplicate_lineup_players.sql
--
-- Cleans up corrupted lineup_data rows where the same player_id appears
-- as the value of more than one slot for the same team+date.
--
-- Root cause: the old handleAutoLineup in roster/page.tsx could merge a freshly-
-- computed newLineup (which placed locked player P in a new slot) with the
-- existing lineup (which forced P back to its locked slot), leaving P in two
-- slots simultaneously.
--
-- Fix strategy: for each (team, date) where duplicates exist, keep only the
-- FIRST occurrence of each player_id (in key-sorted slot order) and remove
-- the rest.  This is the safest conservative approach — it removes the
-- spurious duplicate without guessing which slot was "intended".
--
-- After running this, the new idempotent autoSetLineup in lib/lineup.ts
-- prevents any future duplicates from being written.
--
-- NOTE: lineup_data is stored as JSONB with structure:
--   { "YYYY-MM-DD": { "PG": "player_id", "SG": "player_id", ... }, ... }
--
-- Run this once against your Supabase database.  It is safe to re-run
-- (idempotent: if no duplicates exist, nothing changes).

CREATE OR REPLACE FUNCTION cleanup_duplicate_lineup_players()
RETURNS TABLE(team_id uuid, dates_cleaned text[])
LANGUAGE plpgsql
AS $$
DECLARE
  rec         RECORD;
  date_key    TEXT;
  day_lineup  JSONB;
  slot        TEXT;
  player_id   TEXT;
  seen_ids    TEXT[];
  clean_day   JSONB;
  new_lineup  JSONB;
  cleaned     TEXT[];
BEGIN
  FOR rec IN
    SELECT id, lineup_data
    FROM fantasy_teams
    WHERE lineup_data IS NOT NULL
      AND jsonb_typeof(lineup_data) = 'object'
  LOOP
    new_lineup := rec.lineup_data;
    cleaned    := ARRAY[]::TEXT[];

    FOR date_key IN
      SELECT key FROM jsonb_object_keys(rec.lineup_data) AS key ORDER BY key
    LOOP
      day_lineup := rec.lineup_data -> date_key;
      IF jsonb_typeof(day_lineup) <> 'object' THEN
        CONTINUE;
      END IF;

      seen_ids  := ARRAY[]::TEXT[];
      clean_day := '{}'::JSONB;

      -- Walk slots in canonical order; keep first occurrence of each player_id.
      FOR slot IN
        SELECT s FROM unnest(ARRAY[
          'PG','SG','SF','PF','C','G','F',
          'UTIL1','UTIL2','UTIL3',
          'BE1','BE2','BE3'
        ]) AS s
      LOOP
        IF day_lineup ? slot THEN
          player_id := day_lineup ->> slot;
          IF player_id IS NOT NULL AND NOT (player_id = ANY(seen_ids)) THEN
            clean_day  := clean_day || jsonb_build_object(slot, player_id);
            seen_ids   := seen_ids || player_id;
          END IF;
          -- If player_id already in seen_ids: slot is a duplicate — omit it
        END IF;
      END LOOP;

      -- Only update this date if we actually removed something
      IF clean_day <> day_lineup THEN
        new_lineup := jsonb_set(new_lineup, ARRAY[date_key], clean_day);
        cleaned    := cleaned || date_key;
      END IF;
    END LOOP;

    IF array_length(cleaned, 1) > 0 THEN
      UPDATE fantasy_teams SET lineup_data = new_lineup WHERE id = rec.id;
      team_id      := rec.id;
      dates_cleaned := cleaned;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

-- Execute the cleanup and return a report of what was fixed.
SELECT * FROM cleanup_duplicate_lineup_players();

-- Drop the helper function after use (optional — uncomment if desired)
-- DROP FUNCTION cleanup_duplicate_lineup_players();
