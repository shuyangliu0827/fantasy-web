# Architecture Guardrails
_Blueprint Fantasy — Established: 2026-04-04_

This document converts confirmed architecture facts into durable rules. Each rule has a "Why it exists" section that traces it back to a real incident or design decision so future engineers understand it rather than just follow it.

See also: `ENGINEERING_CONTRACT.md` (checklist form of pre-merge verification requirements).

---

## Guardrail 1 — Required Environment Variables

### What must be set and where

The app uses two completely separate credential stores. **Setting one does not set the other.**

| Variable | Platform | Used By | If Missing |
|---|---|---|---|
| `BDL_API_KEY` | Vercel environment variables | `app/api/nba-games/route.ts` | Game schedule column shows `--` |
| `BDL_API_KEY` | Vercel environment variables | `app/api/nba-game-stats/route.ts` | Live stats columns show `--` |
| `BDL_API_KEY` | Vercel environment variables | `app/api/nba-stats/route.ts` (fallback) | Season averages degrade silently |
| `BDL_API_KEY` | Supabase Edge Function secrets | `supabase/functions/refresh-nba-stats/index.ts` | Season averages go stale after ~8 hours |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel environment variables | All API routes | Database connection fails |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel environment variables | All API routes | Database connection fails |
| `SUPABASE_URL` | Supabase Edge Function secrets | Edge Function | Edge Function cannot connect to DB |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Edge Function secrets | Edge Function | Edge Function cannot write to DB |

### Where to manage these

- **Vercel variables:** Vercel Dashboard → Project → Settings → Environment Variables → Production
- **Supabase secrets:** Supabase Dashboard → Project → Edge Functions → Secrets

### Why this matters

The recent production outage (March 2026) was caused entirely by `BDL_API_KEY` being present in Supabase secrets but absent from Vercel environment variables. Because both are named identically and both are needed, the omission was not obvious. The symptoms (all live columns showing `--`) looked like a code bug but were a missing credential.

### Rules

- **Rule ENV-1:** When the BDL API key is rotated or renewed, it must be updated in BOTH locations within the same operation. Updating one without the other will cause a partial outage.
- **Rule ENV-2:** After any Vercel deployment with environment variable changes, verify the deployment picked up the new values (Vercel sometimes requires a manual redeploy if variables were changed after the most recent deploy trigger).
- **Rule ENV-3:** Never hardcode API keys in source code. The original regression (`commit a179523`) hardcoded the BDL key in `nba-games/route.ts`; moving it to env vars was correct but requires both stores to be populated.

---

## Guardrail 2 — Two Separate Pipelines (Season Averages vs. Live Stats)

These are completely independent data flows. Do not conflate them.

### Pipeline A: Season Averages (background, hourly)

```
BDL /season_averages endpoint
  → Supabase Edge Function (refresh-nba-stats)
    runs hourly via pg_cron
    processes 75 players per run
    full cycle ≈ 8 hours
  → player_stats_cache table (Supabase DB)
  → /api/nba-stats route (reads player_stats_cache)
  → Rankings page, Free Agents page, Compare tool,
    Roster page season-average column
```

**What this pipeline owns:** Season-long per-game averages (`ppg`, `rpg`, `apg`, `fpts_avg`), injury status, player metadata.

**What this pipeline does NOT do:** Game schedules, daily box scores, live in-game stats.

**Key file:** `supabase/functions/refresh-nba-stats/index.ts`

**Key table:** `player_stats_cache`

**BDL key location:** Supabase secrets only

---

### Pipeline B: Live Game Data (on-demand, user-triggered)

```
BDL /games endpoint
  → /api/nba-games route (Next.js, Vercel)
    10-minute in-memory TTL cache
  → Roster page opponent/schedule column
    Lineup lock enforcement (has game started?)

BDL /stats endpoint
  → /api/nba-game-stats route (Next.js, Vercel)
    5-minute in-memory TTL cache for today
    DB-first for past dates (player_day_stats)
  → Roster page live stats columns (PTS/REB/AST/FPTS)
    Historical score computation
```

**What this pipeline owns:** Game schedules by date, per-game box scores, live in-progress stats.

**What this pipeline does NOT do:** Season averages, injury data, player metadata.

**Key files:** `app/api/nba-games/route.ts`, `app/api/nba-game-stats/route.ts`

**Key table:** `player_day_stats`

**BDL key location:** Vercel environment variables only

---

### Rules

- **Rule PIPE-1:** Never modify Pipeline A (Edge Function) to serve schedule or box-score data. It only owns season averages and injury status.
- **Rule PIPE-2:** Never modify Pipeline B (Vercel routes) to be the primary writer of season averages. Those belong to the Edge Function.
- **Rule PIPE-3:** If the Roster page shows broken schedule/stats but season averages work: the Vercel BDL key is the problem. If season averages are stale but schedule/stats work: the Supabase BDL key or pg_cron is the problem. These symptoms are diagnostic.

---

## Guardrail 3 — Date and Timezone Convention

### The rule

When keying against BDL game data, always use local time. BDL indexes games by US Eastern calendar date, not UTC.

| Use case | Correct function | Wrong function |
|---|---|---|
| `selectedDate` init on roster page | `getLocalDateStr()` | `getTodayStr()` |
| `weekStart` init on roster page | `localToUtcMidnight()` | `normalizeUtcDate(new Date())` |
| Lock enforcement date comparison | `getLocalDateStr()` | `getTodayStr()` |
| Week boundaries, scoring math | `formatDateStr()`, `normalizeUtcDate()` | — (UTC is correct here) |

Both functions are in `lib/week-utils.ts`. The distinction matters after approximately 7 PM US Central / 8 PM US Eastern, when UTC rolls to the next day but local time is still the current game day.

### Why this matters

Commit `6d79316` replaced `getLocalDateStr()` with UTC equivalents throughout the roster page. After 7 PM CDT, `getTodayStr()` returned tomorrow's UTC date, causing all schedule lookups (`teamGames[team][selectedDate]`) to miss — because BDL had the games filed under today's local date, not tomorrow's UTC date. Fixed in commit `23dc3a3`.

### Rules

- **Rule DATE-1:** Any code that keys into BDL game data by date string must use `getLocalDateStr()`, not `getTodayStr()`.
- **Rule DATE-2:** Week boundary math (scoring weeks, matchup dates) uses UTC helpers (`formatDateStr`, `normalizeUtcDate`, `addUtcDays`). These are correct for matchup-week computation. Do not replace them with local-time variants.
- **Rule DATE-3:** If a date lookup "works during the day but breaks in the evening," the cause is almost certainly UTC vs. local mismatch.

---

## Guardrail 4 — Canonical Source of Truth for Standings

### The rule

Standings (wins, losses, ties, points for, points against) must always be computed from the `matchups` table using `computeStandingsFromMatchups()` in `lib/canonical-pipeline.ts`. Never read them from `fantasy_teams.wins`, `fantasy_teams.losses`, or `fantasy_teams.points_for`.

### Why this matters

The `wins`/`losses` counters on `fantasy_teams` can become stale when:
- Scores are retroactively corrected via `saveWeeklyMatchupResult`
- A historical scoring error is fixed and scores are recomputed
- A transaction is rolled back

Reading from the `matchups` table is always authoritative because it recomputes from the full set of completed matchup records.

### Implementation

`lib/canonical-pipeline.ts` → `computeStandingsFromMatchups(teamIds, matchups)` — pure function, no DB dependencies, fully tested.

### Rules

- **Rule D (existing, confirmed):** Every standings rendering path must call `computeStandingsFromMatchups()`. The `fantasy_teams.wins/losses` columns are display-cache-only and should be treated as unreliable.
- **Rule STAND-1:** Do not add new code that reads `fantasy_teams.wins` for display. Always recompute.

---

## Guardrail 5 — Duplicated Scoring Formula

### The problem

The ESPN default fantasy scoring formula is defined in two places:

1. `lib/scoring-config.ts` — `ESPN_DEFAULT_WEIGHTS` + `calcFantasyPoints()` — used by Vercel routes and all frontend code
2. `supabase/functions/refresh-nba-stats/index.ts` — `FANTASY_WEIGHTS` + `calcFpts()` — duplicate, inline in Edge Function

The Deno runtime in Supabase Edge Functions cannot import from `lib/`. The duplication is architectural, not accidental.

### Why this is a risk

If the scoring formula is ever changed (e.g., the commissioner wants to adjust weight for blocks, or a league enables custom weights), the Edge Function copy **will not automatically pick up the change**. The season averages in `player_stats_cache` will be computed with old weights while everything else uses new weights. This causes score discrepancies between the Roster page's live stats and the season averages columns.

### Rules

- **Rule SCORE-1:** When changing `ESPN_DEFAULT_WEIGHTS` in `lib/scoring-config.ts`, the corresponding `FANTASY_WEIGHTS` constant in `supabase/functions/refresh-nba-stats/index.ts` must be updated in the same commit.
- **Rule SCORE-2:** Any PR modifying `calcFantasyPoints()` or `ESPN_DEFAULT_WEIGHTS` must include a manual verification that the Edge Function constants match.
- **Rule SCORE-3:** The duplication comment in `supabase/functions/refresh-nba-stats/index.ts` (lines 28–29) exists explicitly to warn about this — do not remove it.

### What must be updated together if scoring changes

If you change the scoring formula, update ALL of these in the same deployment:

| File | What to update |
|---|---|
| `lib/scoring-config.ts` | `ESPN_DEFAULT_WEIGHTS` weights and `calcFantasyPoints()` |
| `supabase/functions/refresh-nba-stats/index.ts` | `FANTASY_WEIGHTS` constant and `calcFpts()` |
| `player_stats_cache` DB | **Must be wiped and recomputed** — stale averages will show wrong FPTS/G values |
| `player_day_stats` DB | **Must be wiped and recomputed** — past game fpts values use old formula |
| `leagues.points_weights` | Update any leagues using `points_system = 'espn_default'` if the default changes |
| `CLAUDE.md` | Update the scoring formula comment in the Architecture Overview section |

---

## Guardrail 6 — Cache Safety Rules

### Rule A: Never overwrite valid stats with empty/null BDL responses

Enforced by: `filterValidStats()` in `lib/canonical-pipeline.ts`

Only write to `player_day_stats` when `fpts > 0 OR min > 0`. A BDL response with all zeros indicates a DNP stub entry, not an actual performance. Writing zeros would erase valid stored stats for players who actually played.

**Do not bypass `filterValidStats()` in any DB write path.**

### Rule CACHE-1: Do not cache BDL error responses

Both `nba-games` and `nba-game-stats` routes track a `hadBdlError` flag. If any BDL page fetch fails, the result is not written to the in-memory cache. This ensures the next request retries BDL immediately rather than serving a stale empty map for the full TTL window.

Do not remove or bypass the `if (!hadBdlError)` guards in these routes.

### Rule CACHE-2: Do not clear live stats on polling errors

The roster page polls `nba-game-stats` every 5 minutes. On a transient network error during polling, the existing `gameDayStats` state must be preserved — not cleared to `{}`. Clearing on error would wipe stats that were correctly loaded earlier in the session.

This is enforced in `fetchGameDayStats()` in `app/league/[slug]/roster/page.tsx` by catching errors and not calling `setGameDayStats({})` in error branches.

---

## Guardrail 7 — Annual Season Maintenance

The following hardcoded values must be reviewed and updated at the start of each NBA season:

| Location | Value | Purpose |
|---|---|---|
| `lib/week-utils.ts:104` | `NBA_FINALS_END_UTC = new Date("2026-06-22T00:00:00Z")` | Drives total scoring week count |
| `CLAUDE.md` (Architecture Overview) | Season week 1 reference start date | Documentation only |

If `NBA_FINALS_END_UTC` is not updated and the actual Finals extend past the hardcoded date, the week selector will stop expanding and users cannot navigate to those final weeks.

**Rule SEASON-1:** Update `NBA_FINALS_END_UTC` before each season begins. Round up to the latest possible Finals end date. The NBA typically announces the Finals schedule in May.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│  KEY RULES AT A GLANCE                                  │
├─────────────────────────────────────────────────────────┤
│  ENV    BDL key lives in BOTH Vercel AND Supabase       │
│  PIPE   Season avgs = Edge Function; Live = API routes  │
│  DATE   BDL lookups → getLocalDateStr() not getTodayStr │
│  STAND  Always computeStandingsFromMatchups(), not DB W  │
│  SCORE  Change formula → update Edge Function too       │
│  CACHE  Never cache BDL errors; never clear on poll err │
│  SEASON Update NBA_FINALS_END_UTC each year             │
└─────────────────────────────────────────────────────────┘
```
