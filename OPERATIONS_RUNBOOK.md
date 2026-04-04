# Operations Runbook
_Blueprint Fantasy — Established: 2026-04-04_

This runbook covers deployment verification, incident diagnosis, and common maintenance operations. It is written for whoever is on-call or managing the platform — no deep coding knowledge required for most sections.

---

## Deployment Checklist

Run this every time code is pushed to production (Vercel auto-deploys on push to `main`).

### Before pushing

- [ ] `npm run lint:core` — must pass (zero issues)
- [ ] `npm run test:smoke` — must pass (66/66)
- [ ] `npm run typecheck` — should pass; if it fails only on `.next/dev/types/validator.ts`, that is the known pre-existing stub issue and is acceptable

### After Vercel deploys

1. Open the Vercel dashboard and confirm the deployment completed without build errors
2. Open the production site and navigate to your own roster page
3. Check the **对阵 (opponent)** column — should show team abbreviations, not `--`
4. Check the **live stats columns** (PTS/REB/AST) — on game days should show numbers, not `--`
5. Check the **FPTS/G (season average)** column — should show decimal values

If steps 3 or 4 show `--`, see **Incident: Live Data Missing** below.

---

## Environment Variable Verification

### Check Vercel variables

Go to: Vercel Dashboard → your project → Settings → Environment Variables

Required variables for production:

| Variable | Required | Where used |
|---|---|---|
| `BDL_API_KEY` | **Critical** | Game schedule, live box scores, season avg fallback |
| `NEXT_PUBLIC_SUPABASE_URL` | Critical | All database reads/writes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Critical | All database reads/writes |

### Check Supabase Edge Function secrets

Go to: Supabase Dashboard → your project → Edge Functions → (select `refresh-nba-stats`) → Secrets

Required secrets:

| Secret | Required | Where used |
|---|---|---|
| `BDL_API_KEY` | **Critical** | Hourly season average refresh |
| `SUPABASE_URL` | Auto-set | Edge Function DB connection |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set | Edge Function DB writes |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are usually auto-populated by Supabase. `BDL_API_KEY` must be set manually.

---

## Incident Playbook

### Incident: All opponent/stats columns show `--` on Roster page

**Likely cause:** `BDL_API_KEY` missing or invalid in Vercel environment variables.

**Diagnosis steps:**
1. Open browser DevTools → Network tab
2. Reload the Roster page
3. Look for requests to `/api/nba-games` and `/api/nba-game-stats`
4. Check the response — if `status: "error"` or the response is empty, the API route is failing
5. Go to Vercel Dashboard → Logs → find recent requests to `/api/nba-games`
6. Look for log lines starting with `[nba-games] BDL fetch failed` — the status code will indicate if it's an auth error (401) or other issue

**Fix:**
1. Confirm `BDL_API_KEY` is set in Vercel Environment Variables (production)
2. If missing: add it, then trigger a new Vercel deployment (the app must redeploy to pick up new env vars)
3. If present but wrong: rotate the key in the BDL dashboard, update both Vercel and Supabase secrets

---

### Incident: Season averages (FPTS/G column) are stale or missing

**Likely cause:** Supabase Edge Function (`refresh-nba-stats`) stopped running, or `BDL_API_KEY` is missing from Supabase secrets.

**Diagnosis steps:**
1. Go to Supabase Dashboard → Edge Functions → `refresh-nba-stats` → Logs
2. Check when the function last ran successfully
3. Run this SQL query in Supabase SQL editor to check cache freshness:
   ```sql
   SELECT MAX(updated_at) AS last_updated, COUNT(*) AS player_count
   FROM player_stats_cache;
   ```
   If `last_updated` is more than 2 hours ago, the Edge Function is not running properly
4. Check Supabase pg_cron status:
   ```sql
   SELECT jobname, schedule, last_run, next_run
   FROM cron.job
   WHERE jobname LIKE '%nba%';
   ```

**Fix options:**
- If `BDL_API_KEY` secret is missing in Supabase: add it under Edge Functions → Secrets
- If pg_cron job is disabled: re-enable it or trigger the Edge Function manually via Supabase dashboard
- Manual trigger: Supabase Dashboard → Edge Functions → `refresh-nba-stats` → Invoke

---

### Incident: Schedule/stats work during the day but break in the evening

**Likely cause:** UTC vs. local date mismatch. This was the root cause of the March 2026 regression and was fixed in commit `23dc3a3`. If this symptom recurs, a code change likely reintroduced the bug.

**Diagnosis:**
- This only affects users after approximately 7 PM US Central / 8 PM US Eastern
- If `selectedDate` on the Roster page shows tomorrow's date in the evening, the UTC regression is back
- Check `lib/week-utils.ts` — `getLocalDateStr()` must use `d.getFullYear()` / `d.getMonth()` / `d.getDate()` (local time getters), not `d.getUTCFullYear()` etc.

**Fix:** Revert any changes to `getLocalDateStr()` or `localToUtcMidnight()` in `lib/week-utils.ts` that introduced UTC getters.

---

### Incident: Draft picks not syncing across browsers

**Likely cause:** Supabase Realtime is down or the broadcast channel subscription failed.

**Diagnosis:**
- Check Supabase Dashboard → Realtime → inspect channel status
- Check browser console for Supabase Realtime connection errors
- Draft state also persists in `localStorage.bp_draft_picks_<leagueId>` — on reconnect, a `sync_request` message is sent to retrieve current state from connected peers

**Short-term workaround:** Managers can reload the page; they will re-subscribe to the Realtime channel and request state from connected peers. Draft pick history is preserved in localStorage.

---

### Incident: Lineup changes not saving

**Likely cause:** Supabase write failing, or lineup lock enforcement blocking the move.

**Diagnosis:**
1. Open browser DevTools → Network tab → look for the `fantasy_teams` Supabase update call
2. If the update is returning an error, check Supabase logs
3. If the update succeeds but UI reverts: the lineup lock enforcement may have blocked the move because the player's game has started
4. Check browser console for `[save-lineup] lock violation` messages

**Note on lineup lock:** If a player's game has already started (checked via `/api/nba-games` and `/api/nba-game-stats`), the save is intentionally rejected. This is correct behavior, not a bug.

---

## Regular Maintenance Schedule

### Monthly

- [ ] Check Vercel deployment logs for recurring errors
- [ ] Check Supabase Edge Function logs for cron failures
- [ ] Verify `player_stats_cache` is being updated (freshness check SQL above)

### Start of each NBA season (October)

- [ ] Update `NBA_FINALS_END_UTC` in `lib/week-utils.ts:104` — set to the latest possible Finals end date (usually mid-to-late June of the following year)
- [ ] Verify BDL API subscription is active for the new season
- [ ] Check if BDL API has changed endpoints or field names (consult BDL changelog)
- [ ] Update `getCurrentSeasonYear()` in `lib/season.ts` if the season year logic needs adjustment
- [ ] Wipe and repopulate `player_stats_cache` if player pool has changed significantly (new season, new players)

### If scoring formula changes

See `ARCHITECTURE_GUARDRAILS.md` Rule SCORE-1 through SCORE-3. Summary: update `lib/scoring-config.ts` and `supabase/functions/refresh-nba-stats/index.ts` in the same commit, then wipe and recompute `player_day_stats` and `player_stats_cache`.

---

## Key SQL Queries

### Check season average cache freshness
```sql
SELECT
  MAX(updated_at) AS newest_update,
  MIN(updated_at) AS oldest_update,
  COUNT(*) AS total_players
FROM player_stats_cache;
```

### Check if a specific player has game stats in the DB
```sql
SELECT player_id, date, pts, reb, ast, fpts, fetched_at
FROM player_day_stats
WHERE player_id = '<bdl_player_id>'
ORDER BY date DESC
LIMIT 10;
```

### Check Edge Function cron cursor position
```sql
SELECT * FROM stats_cursor;
```

### Check recent matchup results
```sql
SELECT week, home_score, away_score, winner_id, status
FROM matchups
WHERE league_id = '<league_id>'
ORDER BY week DESC
LIMIT 5;
```

### Verify standings would match recomputed values
```sql
-- Compare stored counters vs. recomputed from matchups
-- Run this if standings look wrong
SELECT
  ft.name,
  ft.wins AS stored_wins,
  ft.losses AS stored_losses,
  COUNT(CASE WHEN m.winner_id = ft.id THEN 1 END) AS computed_wins,
  COUNT(CASE WHEN m.winner_id IS NOT NULL AND m.winner_id != ft.id
             AND (m.home_team_id = ft.id OR m.away_team_id = ft.id) THEN 1 END) AS computed_losses
FROM fantasy_teams ft
LEFT JOIN matchups m
  ON (m.home_team_id = ft.id OR m.away_team_id = ft.id)
  AND m.status = 'completed'
WHERE ft.league_id = '<league_id>'
GROUP BY ft.id, ft.name, ft.wins, ft.losses;
```

---

## Pre-Merge Code Review Gate

Before merging any PR that touches player data, scoring, or schedule logic, verify:

| Check | Command | Must |
|---|---|---|
| Core lint | `npm run lint:core` | Pass (zero issues) |
| Smoke tests | `npm run test:smoke` | Pass (66/66) |
| TypeScript | `npm run typecheck` | Pass, or only the known `.next/dev` stub errors |
| Scoring formula sync | Manual inspection | `ESPN_DEFAULT_WEIGHTS` == `FANTASY_WEIGHTS` in Edge Function |
| Date function usage | Manual inspection | BDL lookups use `getLocalDateStr()`, not `getTodayStr()` |
| BDL key docs | Manual check | Docs confirm both Vercel AND Supabase keys must be set |

For the full checklist, see `ENGINEERING_CONTRACT.md`.

---

## Architecture at a Glance

```
EXTERNAL SOURCE
  Ball Don't Lie API  (https://api.balldontlie.io/v1)

PIPELINE A: Season Averages (hourly, automatic)
  Supabase Edge Function (refresh-nba-stats)
    BDL key: Supabase secrets
    → player_stats_cache table
    → Rankings / Free Agents / Compare / Roster avg column

PIPELINE B: Live Game Data (on-demand, user-triggered)
  Vercel Next.js API routes
    BDL key: Vercel environment variables
    /api/nba-games   → game schedule
    /api/nba-game-stats → box scores → player_day_stats table
    → Roster page opponent + live stats columns

If Pipeline A fails: season averages go stale. Standings still work.
If Pipeline B fails: opponent/stats columns show --. Season avgs still work.
If Vercel BDL key is missing: Pipeline B fails immediately.
If Supabase BDL key is missing: Pipeline A fails; Pipeline B still works.
```

---

## Contact / Escalation

- Supabase status: https://status.supabase.com
- Vercel status: https://www.vercel-status.com
- Ball Don't Lie API: https://www.balldontlie.io (API docs + status)
- GitHub repo: https://github.com/shuyangliu0827/fantasy-web
