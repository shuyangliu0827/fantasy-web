# Daily Contest Handoff

_Last updated: 2026-04-09_

## 1) Current architecture

Daily Contest MVP is implemented as a single global contest per date at `/contest`.

- UI page: `app/contest/page.tsx`
- API routes:
  - `GET /api/contests/today`
  - `POST /api/contests/create-today`
  - `GET /api/contests/lineup`
  - `POST /api/contests/lineup`
  - `GET /api/contests/leaderboard`
- Shared server orchestration: `lib/contest-server.ts`
- Shared contest rules/validation: `lib/daily-contest.ts`

The contest record is keyed by `contest_date` and rebuilt from the same-day slate.

## 2) Canonical data sources reused

No parallel scoring/player systems were introduced.

- Same scoring formula: `lib/scoring-config.ts` → `calcFantasyPoints`
- Same position normalization: `lib/player-metadata.ts` + `normalizePosition`
- Team code normalization: `lib/i18n.ts` → `normalizeTeamCode`
- Same player identity source: `player_stats_cache.player_id` (BDL integer ID)

## 3) Contest rules (enforced)

### Pool generation rules

1. Use same-day BDL games slate only (teams playing on `contest_date`)
2. Pull players from `player_stats_cache` for only those teams
3. Exclude `injury = 'Out'`
4. Exclude invalid positions (`normalizePosition(...) === 'N/A'`)
5. No hard 80-player cap
6. Assign tiers only after full filtered pool is built and ranked by FPTS/G

### Lineup rules

- T1: exactly 1
- T2: exactly 1
- T3: exactly 1
- T4: exactly 2

Enforced in:
- UI selection logic (`app/contest/page.tsx`)
- Save/Submit client pre-check (`validateTierSelections`)
- Server-side validation in `POST /api/contests/lineup`

## 4) Current routes

- `GET /contest`
- `GET /api/contests/today?date=YYYY-MM-DD`
- `POST /api/contests/create-today` body optional `{ date }`
- `GET /api/contests/lineup?userId=...&date=...`
- `POST /api/contests/lineup` body `{ userId, playerIds, mode, date }`
- `GET /api/contests/leaderboard?date=...`

## 5) Current DB tables

Migration: `supabase/migrations/023_daily_contest_mvp.sql`

- `daily_contests`
  - unique `contest_date`
  - `player_pool` JSONB snapshot
- `user_lineups`
  - unique `(contest_id, user_id)`
  - `player_ids` JSONB
  - `projected_fpts`, `is_submitted`

FK correction in migration:
- Drops existing `user_lineups_user_id_fkey` if present
- Recreates FK to `public.users(id)`

## 6) What is solved

- `/contest` canonical URL exists
- API route set for contest lifecycle exists
- Pool built from same-day slate (not static top-N)
- No 80-player cap
- Out/invalid-position players excluded
- Tier rules explicit and enforced client + server
- Feature discoverability added in top nav, homepage, and discover page CTA

## 7) What is still open

- Production preview/runtime verification depends on deployed Supabase schema migration being applied
- Live scoring settlement for completed contests (currently leaderboard uses projected FPTS from selected players)
- Auth hardening for server-side user identity (current API accepts `userId` from session payload and verifies presence in `public.users`)

## 8) Key gotchas / pitfalls

1. If migration `023_daily_contest_mvp.sql` is not applied to the active Supabase project, lineup save will fail.
2. If `public.users` row is missing for a logged-in auth account, lineup upsert is rejected by server precheck before FK violation.
3. Keep score math in `calcFantasyPoints` only — do not duplicate formula in contest code.
4. Keep position mapping in `player-metadata` only — do not add contest-local position maps.
5. If BDL key/env is missing, same-day slate build cannot run (`BDL_API_KEY` required).
