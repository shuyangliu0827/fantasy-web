# Lint Debt Map
_Blueprint Fantasy — 161 issues across 44 files — Analyzed: 2026-04-04_

---

## Section 1 — Issue Type Breakdown

| Rule | Count | Type | Severity | Affects prod correctness? |
|---|---|---|---|---|
| `@typescript-eslint/no-explicit-any` | 68 | Type safety | Medium | Indirectly — hides bugs at compile time |
| `@typescript-eslint/no-unused-vars` | 30 | Dead code | Low | No |
| `@next/next/no-img-element` | 22 | Performance | Low | No |
| `react-hooks/exhaustive-deps` | 17 | Stale closure | Medium–High | Two instances touch scoring display |
| `react-hooks/set-state-in-effect` | 11 | React anti-pattern | Low–Medium | No runtime failure, extra renders |
| `react-hooks/immutability` (fn-before-decl) | 8 | Hook tracking | Low | Works at runtime via JS hoisting |
| `react-hooks/purity` | 2 | Impure render | Medium | In non-critical `mock-draft` feature only |
| `prefer-const` | 3 | Style | Low | No |
| **TOTAL** | **161** | | | |

---

## Section 2 — File-by-File Debt Map

Columns: **any** = no-explicit-any · **unused** = no-unused-vars · **img** = no-img-element · **deps** = exhaustive-deps · **setState** = set-state-in-effect · **hoisted** = fn-before-decl · **purity** = impure-in-render · **const** = prefer-const

### API Routes (`app/api/`)

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `draft/route.ts` | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 2 | **14** | Legacy (superseded by Realtime) |
| `compare-stats/route.ts` | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **9** | Secondary — compare tool |
| `nba-stats/route.ts` | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **4** | Core — season averages |
| `trade-email/route.ts` | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | Secondary — trade flow |
| `nba-games/route.ts` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** ✅ | **Core — live schedule** |
| `nba-game-stats/route.ts` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** ✅ | **Core — live box scores** |

**API subtotal: 28 issues.** The two live-data routes central to the March 2026 regression are **clean**. Remaining issues are concentrated in legacy (`draft`) and secondary (`compare-stats`) routes.

---

### League Pages — Core Product (`app/league/[slug]/`)

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `page.tsx` (league hub) | 12 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | **14** | Core |
| `roster/page.tsx` | 0 | 3 | 0 | 1 | 0 | 0 | 0 | 0 | **4** | **Core — primary product** |
| `board/page.tsx` (draft board) | 0 | 2 | 0 | 1 | 0 | 1 | 0 | 0 | **4** | Core during draft period |
| `settings/page.tsx` | 1 | 0 | 2 | 1 | 0 | 0 | 0 | 0 | **4** | Secondary — admin only |
| `members/page.tsx` | 1 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | **3** | Secondary |
| `schedule/page.tsx` | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | **3** | Secondary |
| `standings/page.tsx` | 0 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | **3** | Core — rankings |
| `scoreboard/page.tsx` | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | **Core — scoring display** |
| `matchup/[matchupId]/page.tsx` | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | Core |
| `trade/page.tsx` | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **1** | Secondary |
| `free-agents/page.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **0** ✅ | Core |

**Notable: `roster/page.tsx` is nearly clean** — only 3 unused vars and 1 stale dep warning. The recent fixes did not introduce new lint issues here.

**Scoreboard `deps` issue detail:**
`scoreboard/page.tsx:250` — `useMemo` that computes `matchupCards` (displayed scores) is missing `getPlayerDayStats` and `leagueWeights` from its deps array. Both are derived from values already in the deps (`weekDayStats`, `playerStatsCache`, `league`), so in practice the memo re-runs when those change. Actual stale-display risk is **low** but the linter is correct that this is imprecise.

---

### League Root (`app/league/`)

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `page.tsx` (league list) | 3 | 1 | 0 | 1 | 0 | 1 | 0 | 0 | **6** | Core — entry point |
| `join/page.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | Secondary |

---

### Public / Content Pages (`app/` root)

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `u/[username]/page.tsx` | 9 | 1 | 2 | 1 | 1 | 0 | 0 | 0 | **14** | Non-critical — profiles |
| `discover/new/page.tsx` | 0 | 5 | 2 | 0 | 0 | 0 | 0 | 0 | **7** | Non-critical — community |
| `discover/[id]/page.tsx` | 0 | 0 | 4 | 1 | 0 | 1 | 0 | 0 | **6** | Non-critical — community |
| `news/new/page.tsx` | 0 | 1 | 2 | 1 | 1 | 0 | 0 | 0 | **5** | Non-critical — admin |
| `draft-guide/page.tsx` | 0 | 0 | 2 | 0 | 2 | 0 | 0 | 0 | **4** | Non-critical — content |
| `mock-draft/page.tsx` | 0 | 0 | 0 | 0 | 0 | 0 | 2 | 1 | **3** | Non-critical — practice tool |
| `rankings/page.tsx` | 0 | 2 | 0 | 1 | 0 | 0 | 0 | 0 | **3** | Secondary — discovery |
| `discover/page.tsx` | 0 | 0 | 2 | 0 | 1 | 0 | 0 | 0 | **3** | Non-critical — community |
| `compare/page.tsx` | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | Secondary — compare tool |
| `page.tsx` (home) | 0 | 1 | 0 | 0 | 1 | 0 | 0 | 0 | **2** | Core — landing page |
| `cheat-sheet/page.tsx` | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | Non-critical — content |
| `auth/confirm/page.tsx` | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | Secondary — auth |

**`mock-draft/page.tsx` purity detail:**
`Math.random()` and `Date.now()` called inside a function that runs during render. Both are in `mock-draft` only — a practice simulation feature with no connection to live scoring or lineup saving. The `Math.random()` picks an AI opponent's selection; `Date.now()` timestamps draft completion. Neither affects any real fantasy data.

---

### Components

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `Header.tsx` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | **Core — on every page** |
| `LightHeader.tsx` | 0 | 0 | 1 | 0 | 1 | 0 | 0 | 0 | **2** | Core — on every page |
| `LeagueNav.tsx` | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 0 | **2** | **Core — league navigation** |
| `DraftRoom.tsx` | 0 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | **1** | Core during draft |
| `compare/CategoryPreview.tsx` | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | Secondary |
| `compare/QuickDecisionSummary.tsx` | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | Secondary |
| `DraftWinsSection.tsx` | 0 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | **2** | Secondary |
| `HomeHeroShowcase.tsx` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | Marketing — landing |
| `PlayerRevealVisual.tsx` | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 | **1** | Marketing — landing |
| `HeroSection.tsx` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | **1** | Marketing — landing |
| `PlayerAvatar.tsx` | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | **1** | Shared — player display |

**`Header.tsx` / `LightHeader.tsx` setState detail:**
`setUser(getSessionUser())` called synchronously in `useEffect`. This is a localStorage read on mount to hydrate auth state. It causes an extra render on every page load. The pattern works correctly but is suboptimal — the fix is to initialize `user` state directly from `getSessionUser()` in `useState()` instead.

**`LeagueNav.tsx` fn-before-declaration detail:**
`loadPendingCount()` is called inside `useEffect` before its function declaration below. Works via hoisting. The companion `exhaustive-deps` warning for `loadPendingCount` is caused by the same pattern — the linter can't track the function as a stable dep.

**`DraftRoom.tsx` deps detail:**
`useCallback` at line 463 is missing `league.id` from its dependency array. The callback broadcasts picks via the draft channel, which is keyed on `league.id`. Since `league.id` is stable for the entire lifecycle of a draft session, this is a **very low runtime risk** but technically incorrect.

---

### Library (`lib/`)

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `store.ts` | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | **6** | **Core — central data layer** |
| `lang.tsx` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | Core — all pages |
| `useIsMobile.ts` | 0 | 0 | 0 | 0 | 1 | 0 | 0 | 0 | **1** | Core — all responsive layouts |
| `balldontlie.ts` | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | **2** | Core — BDL HTTP wrapper |

**`lib/store.ts` unused vars detail:**
- `:647` `deleteCommentsError` — unused destructured error from a Supabase call. Dead variable.
- `:677` `data` — unused destructured return value. Dead variable.
- `:992` `userIds` — array built from `members.map(m => m.user_id)` but never consumed. Looks like a removed feature that left its setup behind.

**`lib/balldontlie.ts` unused vars:** Two exported symbols that are imported nowhere else. Candidates for removal.

**Shared hook `set-state-in-effect` detail:**
- `lib/lang.tsx:20` — `setLangState(saved)` called synchronously in `useEffect([], [])` to restore language preference from localStorage. Fix: pass `getSessionUser()`-style initializer to `useState`.
- `lib/useIsMobile.ts:12` — `setIsMobile(mq.matches)` to initialize responsive state. Same pattern. Fix: use `useState(() => window.matchMedia(...).matches)` initializer (requires SSR guard since `window` is unavailable server-side).

---

### Supabase Edge Function

| File | any | unused | img | deps | setState | hoisted | purity | const | Total | Code path |
|---|---|---|---|---|---|---|---|---|---|---|
| `refresh-nba-stats/index.ts` | 8 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **8** | Background — season avgs |

**Why `any` here is structurally unavoidable:** The Edge Function runs in Deno and cannot import TypeScript types from `lib/`. The `any` types are all on BDL API response fields. The fix would require defining local BDL response type interfaces within the Edge Function file itself — valid work, no external dependencies needed.

---

## Section 3 — Severity Classification

### High-risk engineering debt (correctness/reliability risk)

None. All critical data paths (`nba-games`, `nba-game-stats`, core lib modules) are lint-clean. No active runtime failures are caused by the current lint issues.

### Medium-risk maintainability debt (latent risk, will bite during future changes)

| Issue | Files | Risk |
|---|---|---|
| `any` in `lib/store.ts` | `lib/store.ts` | Central data layer — untyped params hide schema drift |
| `any` in `app/league/[slug]/page.tsx` (12×) | `app/league/[slug]/page.tsx` | League hub — untyped Supabase responses |
| `any` in `app/api/nba-stats/route.ts` (4×) | `app/api/nba-stats/route.ts` | Season avg route — BDL response untyped |
| Missing deps on `scoreboard` useMemo | `scoreboard/page.tsx:250` | Stale score display if scoring deps change identity |
| Missing dep `league.id` in DraftRoom | `DraftRoom.tsx:463` | Stale broadcast if league object changes during draft |
| `exhaustive-deps` on `loadData` pattern (8×) | 8 league pages | Stale page data if slug prop changes mid-session |
| Unused `userIds` in store.ts | `lib/store.ts:992` | Dead setup code from removed feature; misleads future devs |
| `setLineupForDate` imported but not used in roster page | `roster/page.tsx:13` | Dead import from refactor; signals incomplete cleanup |

### Low-risk style/cleanup debt (safe to defer)

| Issue | Files | Notes |
|---|---|---|
| `any` in API routes (draft, compare-stats) | `draft/route.ts`, `compare-stats/route.ts` | Legacy/secondary routes |
| `any` in public pages (`u/[username]`, `league/page.tsx` non-critical paths) | Multiple | Low-traffic or static pages |
| `any` in Edge Function | `refresh-nba-stats/index.ts` | Structural (Deno cannot import from lib/) |
| All `no-unused-vars` in public pages | discover, news, rankings | Dead imports and leftover state |
| All `no-img-element` (22×) | Multiple | Performance advisory only |
| `set-state-in-effect` in pages | Multiple pages | Init patterns that work; extra render on mount only |
| `react-hooks/immutability` fn-before-decl | 8 pages | Works via hoisting; style only |
| `purity` in mock-draft | `mock-draft/page.tsx` | Isolated practice feature |
| `prefer-const` (3×) | draft route, mock-draft | Auto-fixable |

---

## Section 4 — Staged Cleanup Plan

### P1 — Fix now (targeted, high ROI)

**Goal:** Close medium-risk correctness gaps in core paths. Small, surgical changes.

**P1-A: Fix the two stale-dep issues in core scoring/draft paths**

| File | Line | Fix |
|---|---|---|
| `app/league/[slug]/scoreboard/page.tsx` | 250 | Add `getPlayerDayStats` and `leagueWeights` to the `useMemo` dep array. Since both are derived from existing deps, this is a one-line addition per dep. |
| `components/DraftRoom.tsx` | 463 | Add `league.id` to the `useCallback` dep array. |

Effort: ~15 minutes. Zero logic change.

**P1-B: Remove dead imports in `roster/page.tsx` and `lib/store.ts`**

| File | Issue | Fix |
|---|---|---|
| `app/league/[slug]/roster/page.tsx:13` | `setLineupForDate` imported but never used | Remove from import line |
| `app/league/[slug]/roster/page.tsx:636-637` | `played` and `game` unused destructuring | Remove unused variables from destructure or prefix with `_` |
| `lib/store.ts:992` | `userIds` built but never consumed | Delete the line |
| `lib/store.ts:647,677` | `deleteCommentsError` and `data` unused | Remove destructured names |

Effort: ~20 minutes. Pure dead-code removal.

**P1-C: Fix `prefer-const` (auto-fixable)**

Run `npm run lint -- --fix` — this only auto-fixes the 3 `prefer-const` violations in `app/api/draft/route.ts` and `app/mock-draft/page.tsx`. Verify diff before committing.

Effort: 5 minutes.

**P1 total impact:** Eliminates ~10 issues, cleans up the roster page and store (the two files most recently modified), and closes the scoreboard/draft stale-dep risk.

---

### P2 — Fix within the next 1–2 sessions

**Goal:** Eliminate the repeated `loadData` anti-pattern and fix shared hooks. These are pervasive but all follow the same pattern so one focused session handles most of it.

**P2-A: Fix `loadData`/`loadInsight` fn-before-declaration pattern (8 files)**

Pattern to fix: `useEffect(() => { loadData(); }, [slug])` where `loadData` is declared below the hook.

Standard fix: move the function declaration above the `useEffect`, then add it to the deps array (or wrap with `useCallback` if the function itself has deps).

Files: `board/page.tsx`, `members/page.tsx`, `schedule/page.tsx`, `standings/page.tsx`, `league/page.tsx`, `discover/[id]/page.tsx`, `components/LeagueNav.tsx`, `components/PlayerRevealVisual.tsx`

Effort: ~1.5 hours. Mechanical but touches 8 files — do in one PR with smoke test.

**P2-B: Fix shared hooks (`lib/lang.tsx`, `lib/useIsMobile.ts`)**

These are `set-state-in-effect` in hooks used on every page. Fixing them reduces mount flicker for all users.

- `lib/lang.tsx:20`: Change `const [lang, setLangState] = useState<Lang>("zh")` + effect to `const [lang, setLangState] = useState<Lang>(() => { ... })` — lazy initializer reads localStorage once.
- `lib/useIsMobile.ts:12`: Change `const [isMobile, setIsMobile] = useState(false)` to `useState(() => typeof window !== 'undefined' ? window.matchMedia(...).matches : false)`.

Effort: ~30 minutes.

**P2-C: Type `lib/store.ts` `any` instances (3 occurrences)**

The 3 `any` in store.ts are the most important to fix because `store.ts` is the central data layer. Each `any` here makes a cross-cutting API surface untyped.

Effort: ~45 minutes (requires reading context at each site).

**P2-D: Remove `lib/balldontlie.ts` unused exports (2 occurrences)**

Check if the two unused exports are dead code or need to be used somewhere. If dead: delete.

Effort: 15 minutes.

**P2 total impact:** Eliminates ~30 issues, cleans up all core shared code, and makes the repeated `loadData` pattern consistent. After P2, the only remaining debt is in secondary pages and the Edge Function.

---

### P3 — Defer (safe, low-impact, non-blocking)

**P3-A: `no-explicit-any` in API routes and pages (remaining ~58 instances)**

Priority order within P3:
1. `app/api/nba-stats/route.ts` (4×) — BDL response typing, medium-value
2. `app/league/[slug]/page.tsx` (12×) — league hub, medium-value
3. `app/api/compare-stats/route.ts` (9×) — secondary route
4. `app/api/draft/route.ts` (12×) — legacy route (least urgent)
5. `supabase/functions/refresh-nba-stats/index.ts` (8×) — define BDL types locally in Deno file
6. All page-level `any` (discover, u/[username], etc.)

Do these file-by-file as part of normal development rather than a dedicated sweep.

**P3-B: `no-img-element` (22 instances)**

Replace `<img>` with Next.js `<Image>` for performance gains. Recommend doing by page group:
1. `components/PlayerAvatar.tsx` first — shared component, highest leverage
2. `LightHeader.tsx` — visible on every league page
3. Remaining pages as time allows

Note: Next.js `<Image>` requires `width`/`height` props or `fill` + a sized container. Each conversion needs visual QA.

**P3-C: `set-state-in-effect` in pages (~9 remaining after P2-B)**

All follow the `setUser(getSessionUser())` pattern on mount. After fixing the shared hooks in P2-B, the page-level instances can be addressed lazily — they're not shared code, each is self-contained.

**P3-D: `no-unused-vars` in public/community pages (~23 remaining after P1-B)**

Dead imports and unused state in discover, draft-guide, news, u/[username]. Safe to remove. No logic impact.

**P3-E: `purity` in `mock-draft/page.tsx`**

Move `Math.random()` and `Date.now()` out of the render cycle into event handlers or refs. Low urgency — practice tool only.

**P3 total impact:** Eliminates remaining ~120 issues. All style/type-coverage improvements with no user-visible changes.

---

## Section 5 — Summary Matrix

| Priority | Issues resolved | Key wins | Effort |
|---|---|---|---|
| **P1** | ~10 | Closes scoreboard/draft stale deps; cleans roster + store | 1 hour |
| **P2** | ~30 | Eliminates shared hook double-renders; cleans central data layer | 3 hours |
| **P3** | ~120 | Type coverage, perf (images), dead code removal | 6–10 hours (over time) |

After P1+P2, the repo's **core product paths will have zero lint issues**. The remaining P3 debt is entirely in secondary pages, the legacy draft route, and the Edge Function.

---

## Section 6 — Files That Are Already Clean

The following files in critical paths have **zero lint issues** today and should stay that way:

```
app/api/nba-games/route.ts          ✅  Live schedule route
app/api/nba-game-stats/route.ts     ✅  Live box score route
app/league/[slug]/free-agents/page.tsx  ✅  Free agents page
lib/fantasy-scoring.ts              ✅  Scoring engine
lib/canonical-pipeline.ts           ✅  filterValidStats + computeStandings
lib/week-utils.ts                   ✅  Date math
lib/scoring-config.ts               ✅  ESPN weights + calcFantasyPoints
lib/lineup.ts                       ✅  autoSetLineup
lib/roster-history.ts               ✅  Historical roster reconstruction
lib/player-metadata.ts              ✅  Position normalization
lib/fantasy-matchups.ts             ✅  Matchup generation
tests/canonical-pipeline.test.ts    ✅
tests/fantasy-scoring.test.ts       ✅
tests/lineup.test.ts                ✅
tests/player-metadata.test.ts       ✅
```

Guard rule: any PR touching these files must not introduce new lint issues. The `npm run lint:core` gate already enforces this for the lib files and tests.
