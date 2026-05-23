-- ============================================================
-- 044_backfill_contest_player_snapshot.sql
--
-- Backfill the contest snapshot (migration 043) on EXISTING contest_players
-- rows. Rows created before 043 — or before the writer started persisting the
-- snapshot — have NULL/empty display_name / team / position, so every daily
-- read endpoint rendered them as a raw player_id with a blank "?" avatar.
--
-- Resolution order (authoritative team first, never the stale stats-cache team
-- when a current-roster row exists):
--   display_name : nba_player_current_team.player_name → player_stats_cache.name
--   team         : nba_player_current_team.team (authoritative current roster)
--                  → player_stats_cache.team (last resort, flagged via source)
--   position     : player_stats_cache.position (raw; the repair script applies
--                  canonical normalization — this SQL net keeps it non-empty)
--
-- Only rows with an incomplete snapshot are touched; populated rows are left
-- exactly as the build path wrote them. Idempotent — safe to re-run.
--
-- contest_players.player_id is TEXT (= String(bdl_id)); the metadata tables key
-- on the integer BDL id, so the join casts and guards non-numeric ids.
-- ============================================================

UPDATE contest_players cp
SET
  display_name = COALESCE(NULLIF(cp.display_name, ''), nct.player_name, psc.name),
  team         = COALESCE(NULLIF(cp.team, ''),         nct.team,        psc.team),
  position     = COALESCE(NULLIF(cp.position, ''),     psc.position),
  roster_source = COALESCE(
                    cp.roster_source,
                    CASE
                      WHEN nct.player_id IS NOT NULL THEN 'backfill_044_current_roster'
                      WHEN psc.player_id IS NOT NULL THEN 'backfill_044_stats_cache'
                      ELSE NULL
                    END),
  roster_validated_at = COALESCE(cp.roster_validated_at, now())
FROM contest_players src
LEFT JOIN nba_player_current_team nct
       ON src.player_id ~ '^[0-9]+$' AND nct.player_id = src.player_id::int
LEFT JOIN player_stats_cache psc
       ON src.player_id ~ '^[0-9]+$' AND psc.player_id = src.player_id::int
WHERE cp.id = src.id
  AND (
        cp.display_name IS NULL OR cp.display_name = ''
     OR cp.team        IS NULL OR cp.team        = ''
     OR cp.position    IS NULL OR cp.position    = ''
  );
