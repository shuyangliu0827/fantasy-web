# Cleanup & Monitoring Checklist
_Blueprint Fantasy — Generated: 2026-04-04_

---

## Monitoring (Ongoing — No Code Required)

- [ ] **Verify BDL key in Vercel** — after any env var change, confirm `BDL_API_KEY` is set in Vercel dashboard production environment
- [ ] **Verify BDL key in Supabase** — after any key rotation, update Supabase Edge Function secret `BDL_API_KEY` separately
- [ ] **Check Edge Function freshness** — if users report stale season averages, check `SELECT MAX(updated_at) FROM player_stats_cache` — should be within 2 hours
- [ ] **Annual: update NBA_FINALS_END_UTC** in `lib/week-utils.ts:104` — currently set to `2026-06-22`, must be updated each season before the Finals

---

## P1 — Quick Wins (< 30 min each)

- [ ] Add `"type": "module"` to `package.json` to eliminate Node test runner warnings
- [ ] Run `rm -rf .next` to clear stale dev-mode type stubs (fixes the 2 typecheck errors for deleted `test-db` and `waiver-wire` pages)
- [ ] Fix the 3 auto-fixable lint errors: run `npm run lint -- --fix` (only affects `prefer-const` in `app/api/draft/route.ts`)

---

## P2 — Medium Priority (1–4 hours total)

### React Hook correctness (17 `exhaustive-deps` violations)

These are spread across page components. Missing `useEffect` dependencies can cause effects to run with stale values — subtle data-refresh bugs.

Files to review:
- `app/auth/confirm/page.tsx` — missing `t` in deps
- `app/cheat-sheet/page.tsx` — missing `loadPlayers` in deps
- Multiple league pages — review each missing dep to determine if it should be added or if the effect should be restructured

**Note:** Adding missing deps can change behavior. Audit each case; don't bulk-add blindly.

### `setStateInEffect` patterns (44 instances across `lib/lang.tsx`, `lib/useIsMobile.ts`, and pages)

The most impactful fixes are in the two shared hooks:
- `lib/lang.tsx:20` — initialize lang state from localStorage inside `useState()` initializer instead of a `useEffect`
- `lib/useIsMobile.ts:12` — same pattern for responsive breakpoint

These two affect every page. Low runtime risk but worth cleaning up to reduce render overhead.

---

## P3 — Backlog (Tech Debt, No User Impact)

### Replace `any` types in API routes (68 instances)

Affects: `app/api/compare-stats/route.ts` (9), `app/api/draft/route.ts` (15), `app/api/nba-stats/route.ts` (4), `supabase/functions/refresh-nba-stats/index.ts` (8), `lib/store.ts` (3)

The Supabase Edge Function (`refresh-nba-stats`) uses `any` extensively but cannot import TypeScript types from `lib/` (Deno runtime). The BDL API response types could be defined inline in that file.

### Replace `<img>` tags with Next.js `<Image>` (22 instances)

Affects multiple page components and `components/PlayerAvatar.tsx`. The `<Image>` component from `next/image` auto-optimizes images, reducing bandwidth and improving Core Web Vitals.

### Fix hoisted function declaration pattern (8 instances)

Affects `app/discover/[id]/page.tsx`, `app/discover/new/page.tsx`, `app/discover/page.tsx`, and others. Functions called before their `function` declaration in the file. Works due to JavaScript hoisting but flagged as maintenance risk. Fix: move declarations above their usage.

---

## P4 — Architecture Watch Items (Future Consideration)

### `nba-games` in-memory cache is single-entry

The current cache stores one `{key, data, timestamp}` entry. If the roster page and scoreboard page request different date ranges in the same server instance, they thrash the cache. Low risk currently (most pages use the same week range) but worth noting if more date-range requests are added.

File: `app/api/nba-games/route.ts:35`

### Lineup data stored in both localStorage and Supabase

The dual-write pattern (localStorage first, Supabase async) means a browser crash between the two writes could leave the user with a saved local lineup that Supabase doesn't know about. On next load, the DB value wins. Edge case, but users may perceive lineup changes being lost.

### Scoring formula duplicated in Edge Function

`lib/scoring-config.ts` has `calcFantasyPoints()`. The Edge Function at `supabase/functions/refresh-nba-stats/index.ts` has its own copy of `FANTASY_WEIGHTS` and `calcFpts()` (cannot import from `lib/` in Deno). A comment notes they must stay in sync. If the scoring formula is ever changed, both must be updated.

### `fantasy_teams.wins/losses/ties` can drift

Rule D mandates that standings are always recomputed from `matchups` rows via `computeStandingsFromMatchups()`. The columns on `fantasy_teams` are not canonical. This is documented and enforced in code, but the columns should either be removed or clearly marked as display-cache-only to prevent future confusion.

---

## Reference: Recent Fixes (April 2026)

| Commit | Description |
|---|---|
| `ae3e55c` | Cache poisoning fix (API routes no longer cache BDL error responses); polling error no longer clears live stats; lock enforcement hardened |
| `23dc3a3` | UTC/local date mismatch fix: roster page and store now use local timezone for date keys, matching BDL's US Eastern game date convention |
