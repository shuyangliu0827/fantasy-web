# Data Schema & Architecture Report
_Blueprint Fantasy — Generated: 2026-04-04_

---

## 1. Database Tables (Supabase / PostgreSQL)

### Core Fantasy League Tables

#### `leagues`
The central record for each fantasy league. One row per league.

| Column | Type | Plain-English Meaning |
|---|---|---|
| `id` | UUID (PK) | Unique ID for this league |
| `name` | varchar | League display name |
| `slug` | varchar (unique) | URL-safe identifier (e.g. `/league/my-league`) |
| `commissioner_id` | UUID → `users` | Who created/runs the league |
| `season` | varchar | NBA season year (e.g. `"2025-26"`) |
| `status` | varchar | Where the league is in its lifecycle: `draft_pending` → `drafting` → `active` → `completed` |
| `max_teams` | int | How many teams can join |
| `draft_type` | varchar | `snake`, `linear`, or `auction` |
| `draft_date` | timestamp | Scheduled draft start time |
| `draft_completed_at` | timestamp | When the draft actually finished (drives Week 1 start date) |
| `scoring_weights` | JSON | Points multipliers per stat category |
| `scoring_type` | varchar | `h2h_points` (only active mode), `h2h_categories`, `rotisserie` |
| `points_system` | varchar | `espn_default` or `custom` |
| `points_weights` | JSON | Custom weight overrides (only used when `points_system = custom`) |

**Key relationship:** League start date = first Monday after `draft_completed_at`. All scoring weeks and matchup schedules derive from this.

---

#### `league_members`
Maps users to leagues. Each row = one user in one league.

| Column | Meaning |
|---|---|
| `league_id` | Which league |
| `user_id` | Which user |
| `role` | `owner` (commissioner) or `member` |

---

#### `fantasy_teams`
One row per team per league. Contains three large JSONB blobs that carry most of the live game state.

| Column | Type | Meaning |
|---|---|---|
| `id` | UUID (PK) | Team ID |
| `league_id` | UUID | Parent league |
| `user_id` | UUID | Team owner |
| `name` | varchar | Team display name |
| `roster_data` | JSONB | **Array of all current and past players** (see below) |
| `lineup_data` | JSONB | **Daily starting lineup** keyed by date (see below) |
| `lineup_history` | JSONB | Archived lineup snapshots for historical score computation |

**`roster_data` JSONB structure:**
An array of `RosterPlayer` objects. Each object represents a player transaction event:
```
{
  id: string,           // synthetic player identifier
  bdl_id: number,       // BallDontLie API integer ID (for live stats lookup)
  name: string,
  team: string,         // NBA team abbreviation
  position: string[],   // e.g. ["PG", "SG"]
  acquiredAt: number,   // epoch ms — when this player joined the team
  releasedAt: number,   // epoch ms — when dropped (null if still on roster)
  acquiredVia: string   // "draft" | "trade" | "free_agent"
}
```
Historical rosters are reconstructed from this array by filtering on `acquiredAt`/`releasedAt` for any given date.

**`lineup_data` JSONB structure:**
A nested map: `{ "2026-03-15": { "PG": "player123", "SG": "player456", ... } }`
Each date maps to a slot→playerId assignment. Missing dates inherit the nearest past snapshot.

---

#### `matchups`
One row per weekly matchup. Drives the scoreboard and standings.

| Column | Meaning |
|---|---|
| `id` | UUID |
| `league_id` | Parent league |
| `week` | Scoring week number (1-based) |
| `home_team_id` / `away_team_id` | The two teams facing off |
| `home_score` / `away_score` | Final fantasy point totals for the week |
| `winner_id` | Who won (null = tie) |
| `status` | `scheduled` → `active` → `completed` |
| `start_date` / `end_date` | Monday–Sunday of the scoring week |

**Rule D:** Standings (wins/losses/PF/PA) are always recomputed from matchup rows via `computeStandingsFromMatchups()` — never read from the `wins/losses` counters on `fantasy_teams`, which can become stale.

---

#### `transactions`
Records player movement history: trades, waiver claims, free agent adds, drops.

| Column | Meaning |
|---|---|
| `type` | `trade`, `waiver`, `free_agent`, `drop` |
| `status` | `pending` → `approved` / `rejected` → `completed` |
| `initiated_by` | User who started the transaction |

---

### NBA Live Data Cache Tables

#### `player_stats_cache`
Season-average stats for all NBA players. The primary data source for roster pages, rankings, free agents, and compare tool. Written exclusively by the Supabase Edge Function `refresh-nba-stats`.

| Column | Meaning |
|---|---|
| `player_id` | BDL integer ID |
| `name` | Player name |
| `team` | NBA team abbreviation |
| `position` | Canonical position string |
| `season` | NBA season year |
| `ppg`, `rpg`, `apg`, `spg`, `bpg`, `tov` | Per-game season averages |
| `fgm`, `fga`, `fg3m`, `ftm`, `fta` | Shooting averages |
| `fpts_avg` | Pre-computed fantasy points per game average |
| `injury_status` | Current injury designation (`Healthy`, `Questionable`, etc.) |
| `updated_at` | When this row was last refreshed |

Staleness threshold: if newest `updated_at` is >4 hours ago, data is considered stale.

---

#### `player_day_stats`
Actual box-score stats for each player on each game date. Used to compute historical fantasy scores. Written by the `nba-game-stats` API route after fetching from BDL.

| Column | Meaning |
|---|---|
| `player_id` | BDL integer ID |
| `date` | Game date (`YYYY-MM-DD`) |
| `min` | Minutes played |
| `pts`, `reb`, `ast`, `stl`, `blk`, `tov` | Box-score stats |
| `fgm`, `fga`, `fg3m`, `ftm`, `fta` | Shooting stats |
| `fpts` | Pre-computed fantasy points for this game |
| `fetched_at` | When this row was inserted |

**Rule A (null-safe write):** Only rows with `fpts > 0 OR min > 0` are stored. Zero-stat rows from BDL (DNP stub entries) are never written to the DB, preventing valid data from being overwritten with empty results.

Past dates: DB-first (never re-fetched once written). Today: always re-fetched from BDL (live data).

---

#### `stats_cursor`
A single-row table used by the Edge Function to track its pagination position across player batches. Prevents duplicate work across hourly cron runs.

| Column | Meaning |
|---|---|
| `cursor` | BDL API pagination cursor — where to resume next batch |
| `updated_at` | Last advancement time |

---

### Infrastructure Tables

#### `users`
Auth-linked user profiles. `id` matches Supabase Auth `user.id`.

#### `drafts` + `draft_picks`
Draft state. `drafts` tracks round/pick position. `draft_picks` records each player selection with round, pick number, and team. Live draft sync uses Supabase Realtime broadcast (not DB polling).

#### `nba_teams`, `nba_players`, `nba_player_stats`, `nba_contracts`
BDL-sourced NBA reference data. Defined in `schema.dbml` but supplemented/replaced by `player_stats_cache` for active use (cache is fresher and pre-computes fantasy points).

#### `insights`, `comments`
Community features: posts/analysis and threaded comments.

---

## 2. Local Storage (Browser)

In addition to the database, several data items are stored in the user's browser:

| Key | Stores |
|---|---|
| `bp_session` | Logged-in user session (mirrors Supabase Auth) |
| `bp_lineup_<leagueId>_<teamId>` | Daily lineup assignments per team |
| `bp_draft_picks_<leagueId>` | Live draft pick state (persisted for reconnection) |
| `bp_lang` | UI language preference (`en` or `zh`) |

**Important:** Daily lineup data is stored in BOTH localStorage (for speed) and `fantasy_teams.lineup_data` in Supabase (for durability). The DB write happens async after the local write.

---

## 3. External Data Source: Ball Don't Lie API (BDL)

**Base URL:** `https://api.balldontlie.io/v1`
**Auth:** `Authorization: <API_KEY>` header

Endpoints used:

| Endpoint | Used By | Data Returned |
|---|---|---|
| `GET /stats?start_date=&end_date=` | `nba-game-stats` route | Per-game box scores by date |
| `GET /games?start_date=&end_date=` | `nba-games` route | Game schedule with teams, scores, status |
| `GET /season_averages?season=&player_ids[]=` | Edge Function + `nba-stats` fallback | Season averages per player |

**Rate limit:** 60 requests/minute on the free/standard plan. Edge Function uses 1-second delay between calls to stay safe.

**Two separate API key stores:**
- Supabase secrets (`Deno.env.get("BDL_API_KEY")`) — used only by the Edge Function
- Vercel environment variables (`process.env.BDL_API_KEY`) — used by Next.js API routes

These are independent. Both must be set for the system to function fully.

---

## 4. In-Memory Caches (Vercel instance-level)

These caches live in Node.js memory on Vercel. They reset on each cold start (new deployment, idle timeout). They are NOT shared across Vercel function instances.

| Cache | TTL | Scope |
|---|---|---|
| `nba-games` route | 10 minutes | One entry (last requested date range) |
| `nba-game-stats` route | 5 minutes | Per-date, live/today data only |
| `nba-stats` fallback cooldown | ~30 min | Prevents BDL stampede on cache miss |

---

## 5. Table Relationships

```
leagues ──< league_members >── users
leagues ──< fantasy_teams ──> users
leagues ──< matchups
fantasy_teams ──< roster_data (JSONB, players + history)
fantasy_teams ──< lineup_data (JSONB, date→slot→playerId)
fantasy_teams ──< lineup_history (JSONB, archived snapshots)

BDL player_id (int) links:
  player_stats_cache.player_id
  player_day_stats.player_id
  RosterPlayer.bdl_id (in roster_data JSONB)

stats_cursor ── (single-row, no FK) ── used by Edge Function only
```

---

## 6. Where Fantasy Logic Enters the System

| Logic | Location |
|---|---|
| Scoring formula (pts×1, ast×2, stl×4…) | `lib/scoring-config.ts` → `calcFantasyPoints()` |
| Per-game fantasy points | Computed at BDL fetch time in `nba-game-stats` route and Edge Function |
| Weekly score aggregation | `lib/fantasy-scoring.ts` → `calcWeekScore()` |
| Matchup result (win/loss/tie) | `lib/canonical-pipeline.ts` → `computeStandingsFromMatchups()` |
| Lineup auto-optimizer | `lib/lineup.ts` → `autoSetLineup()` |
| Historical roster reconstruction | `lib/roster-history.ts` → `getHistoricalRosterForDate()` |
| Matchup schedule generation | `lib/fantasy-matchups.ts` → `generateMatchupsForWeek()` (deterministic seeded shuffle) |
| Lineup lock enforcement (game started?) | `lib/store.ts` → `enforceTodayLineupLocks()` |

---

## 7. Where Live NBA Data Enters the System

```
BDL API
  │
  ├─► /api/nba-games        → in-memory cache → Roster page (opponent/schedule column)
  │
  ├─► /api/nba-game-stats   → player_day_stats DB → Roster page (live stats column)
  │
  └─► Edge Function          → player_stats_cache DB
        (hourly via pg_cron)       → /api/nba-stats (season averages)
                                   → Rankings, Free Agents, Compare pages
```
