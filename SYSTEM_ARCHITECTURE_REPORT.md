# System Architecture Report
_Blueprint Fantasy — Technical Version — 2026-04-04_

See also: `ARCHITECTURE_GUARDRAILS.md` for the rules derived from this architecture.
See also: `OPERATIONS_RUNBOOK.md` for day-to-day operational procedures.

---

## 1. System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL DATA SOURCE                                                   │
│                                                                         │
│  Ball Don't Lie API  (api.balldontlie.io/v1)                            │
│    /stats              per-game box scores by date                      │
│    /games              game schedule, scores, live status               │
│    /season_averages    season stats per player, per season              │
└────────────┬──────────────────────────────┬────────────────────────────┘
             │                              │
             │  PIPELINE A                  │  PIPELINE B
             │  Hourly via pg_cron          │  On-demand (user opens page)
             │  Auth: Supabase secret       │  Auth: Vercel env var
             ▼                              ▼
┌──────────────────────┐     ┌───────────────────────────────────────────┐
│  SUPABASE            │     │  VERCEL  (Next.js 16 App Router)          │
│  Edge Function       │     │                                           │
│  refresh-nba-stats   │     │  API Routes                               │
│                      │     │  ├── /api/nba-games     schedule          │
│  Batch: 75 players   │     │  │     10-min in-memory TTL cache         │
│  Delay: 1 s/call     │     │  ├── /api/nba-game-stats box scores       │
│  Full cycle: ~8 hrs  │     │  │     5-min TTL (today); DB-first (past) │
│                      │     │  ├── /api/nba-stats     season avgs       │
│                      │     │  │     cache-first reader; Edge Fn is     │
│                      │     │  │     primary writer                     │
└──────────┬───────────┘     │  └── /api/compare-stats player compare    │
           │                  │                                           │
           │                  │  Pages (client components)               │
           ▼                  │  /league/[slug]/roster    ← main focus   │
┌────────────────────────────┐│  /league/[slug]/matchup/[id]             │
│  SUPABASE  (PostgreSQL)    ││  /league/[slug]/scoreboard               │
│                            ││  /league/[slug]/free-agents              │
│  player_stats_cache   ◄────┘│  /league/[slug]/standings               │
│  player_day_stats     ◄─────┘  /rankings                              │
│  leagues                       /compare                                │
│  league_members        └───────────────────────────────────────────────┘
│  fantasy_teams
│   ├── roster_data  (JSONB)
│   ├── lineup_data  (JSONB)
│   └── lineup_history (JSONB)
│  matchups
│  transactions
│  transaction_players
│  users
│  drafts + draft_picks
│  stats_cursor
│  insights + comments
└────────────────────────────┘

┌──────────────────────────────┐
│  BROWSER  (user's device)    │
│  localStorage                │
│   bp_session   auth session  │
│   bp_lineup_*  daily lineup  │
│   bp_draft_*   draft state   │
│   bp_lang      zh/en pref    │
└──────────────────────────────┘
```

---

## 2. Live Data Update Flow

```
NBA game is played
        │
        ▼
Ball Don't Lie records game stats
        │
        ├──────────────────────────────────────────────────────────────┐
        │                                                              │
PIPELINE A (season averages)                           PIPELINE B (live + historical)
        │                                                              │
        ▼ (every hour via pg_cron)                                     ▼ (user opens roster page)
Supabase Edge Function                                /api/nba-games?start=Mon&end=Sun
  reads BDL /season_averages                                          │
  processes 75 players at a time                        checks in-memory cache (10-min TTL)
  computes fpts_avg using FANTASY_WEIGHTS               ├── HIT → return cached TeamGamesMap
  writes to player_stats_cache                          └── MISS → fetch from BDL
        │                                                              │
        ▼                                                /api/nba-game-stats?date=today
player_stats_cache table                                              │
  (season avgs + injury status)                          Past date?  ├── DB-first: check player_day_stats
        │                                                ├── rows found → return DB data (fast)
        ▼                                                └── missing → fetch BDL → write to DB
/api/nba-stats reads player_stats_cache                               │
  serves to: Rankings, Free Agents,                    Today?        └── always BDL → write DB async
  Compare, Roster (season avg col)                                     │
                                                                       ▼
                                                        return DateStatsMap to roster page
                                                        { "3202": { pts: 28, fpts: 62.5, ... } }
```

---

## 3. Roster Page Data Flow

```
User opens /league/[slug]/roster
        │
        ▼
State init (lib/week-utils.ts)
  weekStart   = localToUtcMidnight()     ← local calendar date, not UTC instant
  selectedDate = getLocalDateStr()        ← matches BDL game key format

        │
        ▼
loadData() — 3 parallel fetches
  ├── GET /api/nba-games?start_date=Mon&end_date=Sun
  │     → TeamGamesMap: { "LAL": { "2026-04-04": { opponent:"GSW", status:"Final", ...} } }
  │     → used for: 对阵 column, lineup lock checks
  │
  ├── GET /api/nba-game-stats?date=2026-04-04
  │     → DateStatsMap: { "3202": { pts:28, reb:7, ast:9, fpts:62.5, min:34.0 } }
  │     → used for: PTS/REB/AST/FPTS live columns
  │
  └── GET /api/nba-stats (reads player_stats_cache)
        → CachedPlayerStats[]: [ { bdl_id:3202, fpts_avg:48.2, injury:"Healthy", ... } ]
        → used for: FPTS/G season avg column, injury badge

        │
        ▼
displayRoster (useMemo)
  selectedDate >= getLocalDateStr()  → getCurrentRoster(roster)
  selectedDate < today               → getHistoricalRosterForDate(roster, selectedDate)
     └─ filters roster_data JSONB array by acquiredAt / releasedAt timestamps

        │
        ▼
Table render — per player:
  対阵 (opponent)  → teamGames[player.team][selectedDate]
  Status           → game.status (e.g. "7:30 pm ET" or "Final")
  PTS/REB/AST/FPTS → gameDayStats[String(player.bdl_id)]
  FPTS/G (season)  → playerStats[player.bdl_id]?.fpts_avg
  Injury badge     → playerStats[player.bdl_id]?.injury_status

        │
        ▼
Live polling (setInterval, every 5 minutes on game days)
  fetchGameDayStats(selectedDate)
    → re-calls /api/nba-game-stats
    → on success: setGameDayStats(data.stats)
    → on ANY error: preserve existing gameDayStats (do not clear)

        │
        ▼
Lineup save (drag-to-slot or auto-set)
  enforceTodayLineupLocks(date, lineup, teamGames, gameDayStats)
    → only runs if date === getLocalDateStr()
    → for each starter: hasGameStartedForPlayer(player, date, teamGames, gameDayStats)
    → if started: reject with toast; do not save
  → write to localStorage bp_lineup_<leagueId>_<teamId> immediately
  → async write to fantasy_teams.lineup_data in Supabase
```

---

## 4. Database Table Reference

### Core fantasy tables

| Table | Primary key | What it holds |
|---|---|---|
| `leagues` | `id` (UUID) | One row per league. Config: scoring weights, draft type, season, status. Key field: `draft_completed_at` — drives all week calculations. |
| `league_members` | `(league_id, user_id)` | Who belongs to which league and in what role. |
| `fantasy_teams` | `id` (UUID) | One row per team per league. Three JSONB blobs: `roster_data`, `lineup_data`, `lineup_history`. |
| `matchups` | `id` (UUID) | One row per weekly matchup. Holds final scores. **Source of truth for standings** (Rule D). |
| `transactions` | `id` (UUID) | Trade/waiver/drop history. |
| `users` | `id` (UUID) | Auth-linked user profiles. |
| `drafts` | `id` (UUID) | Draft state (round, pick position, timing). |
| `draft_picks` | `id` (UUID) | Individual pick records (player, round, pick#, team). |

### JSONB blobs inside `fantasy_teams`

**`roster_data`** — Array of `RosterPlayer` objects:
```typescript
{
  id: string            // synthetic identifier used as lineup key
  bdl_id?: number       // BDL integer player ID — links to player_day_stats
  name: string
  team: string          // NBA team abbreviation (may be stale after trade)
  position: string[]    // ["PG","SG"] etc.
  acquiredAt: number    // epoch ms — when player joined team
  releasedAt?: number   // epoch ms — when dropped; absent if still on roster
  acquiredVia: "draft" | "trade" | "free_agent"
}
```
Historical roster reconstruction: filter where `acquiredAt <= targetDate` AND (`releasedAt` is null OR `releasedAt > targetDate`). Implemented in `lib/roster-history.ts`.

**`lineup_data`** — `Record<dateStr, Record<slotId, playerId>>`:
```json
{
  "2026-04-04": { "PG": "player_abc", "SG": "player_xyz", "BE1": "player_123" },
  "2026-04-05": { "PG": "player_abc", ... }
}
```

**`lineup_history`** — Archived snapshots of `lineup_data` used for score recomputation.

### NBA live data cache tables

| Table | Primary key | Written by | Read by |
|---|---|---|---|
| `player_stats_cache` | `player_id` | Edge Function (hourly) | `/api/nba-stats`, `/api/compare-stats` |
| `player_day_stats` | `(player_id, date)` | `/api/nba-game-stats` route | Same route (DB-first for past dates) |
| `stats_cursor` | Single row | Edge Function | Edge Function (tracks pagination position) |

### `player_stats_cache` key fields

| Field | Type | Meaning |
|---|---|---|
| `player_id` | int | BDL integer player ID |
| `fpts_avg` | decimal | Pre-computed fantasy points per game (current season) |
| `injury_status` | varchar | `Healthy`, `Questionable`, `Out`, `Doubtful`, `GTD` |
| `updated_at` | timestamp | Last refresh time; >4 hours old = stale |

### `player_day_stats` key fields

| Field | Type | Meaning |
|---|---|---|
| `player_id` | int | BDL integer player ID |
| `date` | date | Game date (YYYY-MM-DD) |
| `fpts` | decimal | Pre-computed fantasy points for this game using ESPN weights |
| `min` | decimal | Minutes played |
| `fetched_at` | timestamp | When this row was inserted |

---

## 5. Scoring Engine Flow

```
Source: fantasy_teams.lineup_data[date]
  → getStarterIdsForDate(date, lineupData)   (lib/fantasy-scoring.ts)
  → returns Set of starter player IDs for that day

For each starter ID:
  → player_day_stats[bdl_id][date]           (via /api/nba-game-stats or direct DB read)
  → calcFantasyPoints(stats, weights)        (lib/scoring-config.ts)

calcFantasyPoints formula (ESPN default):
  pts×1 + fgm×2 + fga×(-1) + fg3m×1 + ftm×1 + fta×(-1)
  + reb×1 + ast×2 + stl×4 + blk×4 + tov×(-2)

Weights defined in:
  lib/scoring-config.ts → ESPN_DEFAULT_WEIGHTS
  supabase/functions/refresh-nba-stats/index.ts → FANTASY_WEIGHTS (DUPLICATE — must stay in sync)

→ calcWeekScore(week, leagueStart, lineupData, statsMap, roster)
  sums 7 daily scores (Mon–Sun), bench excluded
  → weekly team score

→ saveWeeklyMatchupResult(matchupId, homeScore, awayScore)
  writes to matchups.home_score, away_score, winner_id, status='completed'

→ computeStandingsFromMatchups(teamIds, matchups)   (lib/canonical-pipeline.ts)
  recomputes all W/L/T/PF/PA from completed matchups
  this is Rule D — authoritative standings, not fantasy_teams counters
```

---

## 6. Draft System

```
Commissioner creates league → sets draft_date
All managers open DraftRoom.tsx (/league/[slug]/board)

On mount:
  Subscribe to Supabase Realtime broadcast channel 'draft-<leagueId>'
  Restore localStorage.bp_draft_picks_<leagueId> (reconnect resilience)
  Send 'sync_request' broadcast to receive current state from connected peers

Each pick:
  Manager selects player in DraftRoom.tsx
  Broadcast pick via Supabase Realtime (not DB write — real-time only)
  Write pick to localStorage

On draft complete:
  All picks committed to fantasy_teams.roster_data (acquiredVia: "draft")
  leagues.status updated to 'active'
  leagues.draft_completed_at set → this drives Week 1 start date

Snake order:
  Odd rounds: pick order ascending (1 → N)
  Even rounds: pick order descending (N → 1)
```

---

## 7. API Route Inventory

| Route | Method | BDL? | DB tables | In-memory cache | Primary consumers |
|---|---|---|---|---|---|
| `/api/nba-games` | GET | Always on cache miss | None | 10 min (one entry) | Roster page, lock enforcement |
| `/api/nba-game-stats` | GET | Today always; past if DB miss | `player_day_stats` R+W | 5 min (per date, today only) | Roster page, polling |
| `/api/nba-stats` | GET | Fallback only (>4hr stale) | `player_stats_cache` R | None (staleness check per request) | Rankings, Free Agents, Roster avg col |
| `/api/compare-stats` | GET | Yes (game logs) | `player_stats_cache` R | None | Compare page |
| `/api/draft` | GET/POST/DELETE | No | In-memory only (legacy) | — | Legacy draft path |
| `/api/trade-email` | POST | No | None | — | Trade notification flow |

---

## 8. Frontend Page Inventory

| Page | Route | Live data? | Refresh model |
|---|---|---|---|
| Roster | `/league/[slug]/roster` | Yes | On load + 5-min poll |
| Scoreboard | `/league/[slug]/scoreboard` | Historical | On load |
| Matchup detail | `/league/[slug]/matchup/[id]` | Historical | On load |
| Standings | `/league/[slug]/standings` | Derived | On load (Rule D recompute) |
| Schedule | `/league/[slug]/schedule` | No | On load |
| Free Agents | `/league/[slug]/free-agents` | Hourly (via cache) | On load |
| Trade | `/league/[slug]/trade` | Hourly (via cache) | On load |
| Draft Room | `/league/[slug]/board` | Real-time | Supabase Realtime broadcast |
| Members | `/league/[slug]/members` | No | On load |
| Settings | `/league/[slug]/settings` | No | On load |
| Rankings | `/rankings` | Hourly (via cache) | On load |
| Compare | `/compare` | Hourly + BDL game logs | On demand |

---

## 9. Key Dependencies and Failure Modes

| Dependency | Failure mode | User-visible symptom | Recovery |
|---|---|---|---|
| `BDL_API_KEY` in Vercel | Routes return empty/error | Opponent + stats columns show `--` | Add key to Vercel env vars, redeploy |
| `BDL_API_KEY` in Supabase | Edge Function fails | Season averages stale after 8h | Add key to Supabase secrets |
| Supabase pg_cron | Edge Function not triggered | Season averages freeze | Re-enable cron job |
| Supabase Realtime | Broadcast fails | Draft picks don't sync | Reload page; localStorage state preserved |
| `NBA_FINALS_END_UTC` | Past season cutoff | Week selector stops expanding | Update value annually |
| Scoring formula sync | Edge Function / route diverge | FPTS avg ≠ game-day FPTS | Update both formula copies, wipe cache |
| Local vs. UTC date | UTC used for BDL lookup | Evening users see `--` | Use `getLocalDateStr()` for BDL lookups |

---

## 10. Lib Module Summary

| Module | Role | Supabase? | Side effects? |
|---|---|---|---|
| `lib/store.ts` | Central data layer; all Supabase reads/writes; type definitions | Yes | DB reads/writes |
| `lib/scoring-config.ts` | ESPN weights + `calcFantasyPoints()` — single source of truth | No | None (pure) |
| `lib/fantasy-scoring.ts` | `calcWeekScore`, `getDailyStarterScore` | No | None (pure) |
| `lib/canonical-pipeline.ts` | `filterValidStats` (Rule A), `computeStandingsFromMatchups` (Rule D) | No | None (pure) |
| `lib/lineup.ts` | `autoSetLineup`, `SLOT_ELIGIBLE`, `isEligibleForSlot` | No | None (pure) |
| `lib/roster-history.ts` | `getCurrentRoster`, `getHistoricalRosterForDate` | No | None (pure) |
| `lib/week-utils.ts` | Week math, date helpers, local/UTC converters | No | None (pure) |
| `lib/fantasy-matchups.ts` | Deterministic matchup schedule via seeded shuffle | No | None (pure) |
| `lib/balldontlie.ts` | BDL HTTP wrapper, `parseMinutes()` | No | Network calls |
| `lib/player-identity.ts` | `resolveBdlIds()` — maps player names to BDL integer IDs | Yes (reads `player_stats_cache`) | Fire-and-forget write |
| `lib/player-metadata.ts` | `getCanonicalPlayerPosition()`, position normalization | No | None (pure) |
| `lib/lang.tsx` | `LangProvider`, `useLang()`, `t(zh, en)` i18n helper | No | localStorage read |
