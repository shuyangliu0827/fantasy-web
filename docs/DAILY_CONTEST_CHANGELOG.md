# Daily Contest Changelog

## 2026-04-09
- Commit: (this commit on branch work)
- Added Daily Contest MVP implementation for `/contest` with API routes under `app/api/contests/*`.
- Added shared contest rule module (`lib/daily-contest.ts`) to centralize:
  - pool filtering constraints,
  - tier assignment,
  - tier validation,
  - lineup projection scoring.
- Added shared server contest orchestration (`lib/contest-server.ts`) to:
  - fetch same-day slate teams from BDL games endpoint,
  - build filtered pool from `player_stats_cache`,
  - upsert and fetch `daily_contests`.
- Added DB migration `023_daily_contest_mvp.sql`:
  - creates `daily_contests` and `user_lineups`,
  - normalizes `user_lineups_user_id_fkey` to `public.users(id)`.
- Added UI discoverability updates:
  - top nav includes Daily Contest,
  - homepage feature card links to `/contest`,
  - discover page CTA links to `/contest`.

### Why
- Resolve blocking lineup FK errors by making schema intent explicit and enforcing user existence precheck.
- Ensure pool generation is true same-day slate, uncapped, and filtered before tiering.
- Make tier rule enforcement complete and deterministic across client and server.
- Improve feature discoverability across app surfaces.

### Remaining
- Confirm migration is applied on the exact preview/prod Supabase project in use.
- Add post-game finalized scoring for leaderboard (currently projected points).
