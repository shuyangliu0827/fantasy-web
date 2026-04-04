# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run lint       # ESLint
npm test           # Run all tests (Node.js native test runner, no Jest)
# Run a single test file:
node --experimental-strip-types --test tests/fantasy-scoring.test.ts
```

Tests use Node's built-in `node:test` + `node:assert/strict` — no external test framework.

## Architecture Overview

**Blueprint Fantasy** — bilingual (Chinese/English) fantasy basketball platform. Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Supabase (PostgreSQL + Realtime).

### Layer separation

| Layer | Path | Role |
|---|---|---|
| Pages / UI | `app/` | Route segments, server components, page layout |
| Components | `components/` | Shared React components (`Header`, `DraftRoom`, `LeagueNav`, etc.) |
| Library | `lib/` | Pure helpers + Supabase client; no framework dependencies |
| API Routes | `app/api/` | `nba-stats`, `nba-games`, `nba-game-stats`, `compare-stats`, `draft`, `trade-email` |
| Tests | `tests/` | Unit tests for pure lib functions only |

### `lib/` module roles

- **`store.ts`** — Central data layer; all Supabase reads/writes, type definitions (`User`, `League`, `Team`, `RosterPlayer`, `LineupMap`, `DailyLineupMap`), and localStorage utilities for draft/lineup state. Also re-exports `supabase` — always import `supabase` from here, not from `lib/supabase`.
- **`supabase.ts`** — Supabase client singleton only. Do not import types or helpers from here; use `lib/store`.
- **`scoring-config.ts`** — Single source of truth for fantasy points weights. `ESPN_DEFAULT_WEIGHTS`, `calcFantasyPoints()`, and `getLeaguePointsWeights()`. Import here for any scoring math — never inline the formula.
- **`fantasy-scoring.ts`** — Scoring engine: `getStarterIdsForDate`, `calcWeekScore`, roster score aggregation.
- **`canonical-pipeline.ts`** — Pure helpers with no DB imports: `filterValidStats` (Rule A: null-safe BDL writes) and `computeStandingsFromMatchups` (Rule D: authoritative W/L/PF/PA from matchups, not `fantasy_teams` counters).
- **`lineup.ts`** — `SLOT_ELIGIBLE` map, `isEligibleForSlot`, `autoSetLineup`. No Supabase.
- **`roster-history.ts`** — `getCurrentRoster` / `getHistoricalRosterForDate` — pure, no Supabase.
- **`week-utils.ts`** — Week math (Mon–Sun in UTC), date helpers, `STARTER_SLOTS`, `BENCH_SLOTS`.
- **`fantasy-matchups.ts`** — Deterministic matchup generation via seeded shuffle (no DB).
- **`balldontlie.ts`** — Thin HTTP wrapper for Ball Don't Lie API (server-side only; key via `BDL_API_KEY` env var). Also exports `parseMinutes()` — the canonical parser for BDL `"MM:SS"` minute strings; use this instead of inline `parseFloat` calls.
- **`player-identity.ts`** — `resolveBdlIds()`: maps synthetic player names → BDL integer IDs via `player_stats_cache`.
- **`lang.tsx`** — `LangProvider` + `useLang()` hook; `t(zh, en)` returns the appropriate string. Preference in `localStorage.bp_lang`.

### Key design rules

**Rule A** — Never overwrite stored stats with null/zero BDL API responses. `filterValidStats` from `canonical-pipeline.ts` enforces this before any DB write.

**Rule D** — W/L/T/PF/PA must be computed from `matchups` rows via `computeStandingsFromMatchups`, not from `fantasy_teams.wins/losses` counters (which can become stale).

### Draft system

`DraftRoom.tsx` (client component) is the live draft path. It uses **Supabase Realtime broadcast** (not `postgres_changes`) to sync picks across clients, with localStorage persistence (`bp_draft_picks_<leagueId>`). On subscribe, it sends `sync_request` to receive current state from connected peers. The legacy `app/api/draft/route.ts` (in-memory) is no longer the primary draft path.

### Auth

Primary: `supabase.auth.signInWithPassword` / `signUp`. Session stored in `localStorage.bp_session`. Fallback path stores credentials in `localStorage.bp_users` for Supabase rate-limit situations with auto-migration to Supabase Auth.

### Roster storage

`fantasy_teams.roster_data` JSONB column holds an array of `RosterPlayer` objects with `acquiredAt`/`releasedAt` timestamps (epoch ms). This enables historical roster queries via `getHistoricalRosterForDate`. Lineup (slot → playerId map) is stored per-day in `localStorage.bp_lineup_<leagueId>_<teamId>`.

### i18n

Wrap all user-visible strings with `t(zh, en)` from `useLang()`. `LangProvider` must be in scope (it wraps the entire app in `layout.tsx`).

### Scoring formula (ESPN default)

`pts×1 + fgm×2 + fga×(−1) + fg3m×1 + ftm×1 + fta×(−1) + reb×1 + ast×2 + stl×4 + blk×4 + tov×(−2)`

Roster slots: PG, SG, SF, PF, C, G, F, UTIL1-3, BE1-3 (13 total starters+bench). Snake draft: odd rounds ascending, even rounds descending.

### Week system

Matchup weeks run **Monday–Sunday UTC**. League start date = first Monday after `draft_completed_at`. 20 weeks total; season week 1 reference start: 2026-03-09.
