# Repo Health Baseline (2026-04-04)

This note establishes a **practical, verifiable baseline** for future patches.

## What was broken before this update

### 1) `npm test` instability
- The test runner (`node --experimental-strip-types`) runs TypeScript directly under Node ESM semantics.
- `lib/fantasy-scoring.ts` imported sibling modules without explicit `.ts` extensions, which worked in Next bundling but failed in Node test runtime with `ERR_MODULE_NOT_FOUND`.
- Result: tests failed for infrastructure reasons rather than business logic regressions.

### 2) No explicit typecheck command
- The repo had no `npm run typecheck` script, so TS regressions were easy to miss.

### 3) `npm run lint` had heavy pre-existing debt
- Full lint still reports many pre-existing errors/warnings across unrelated surfaces (hooks rules, explicit `any`, image warnings, etc.).
- This made full-repo lint unsuitable as a fast merge gate in current state.

## What was fixed in this update

### Test runner reliability
- Updated `lib/fantasy-scoring.ts` imports to explicit `.ts` specifiers for Node ESM test compatibility.
- `npm test` now passes consistently in this environment.

### Typecheck baseline
- Added `npm run typecheck` (`tsc --noEmit`).
- Fixed discovered TS issue in roster cached player shape (`position` missing in `CachedPlayerStats`).

### Lint baseline (core)
- Added `npm run lint:core` to lint stable, high-signal baseline files:
  - tests
  - canonical scoring/week/canonical-pipeline/player-metadata libs
- This is a reliable lint gate while full-repo lint debt is being paid down incrementally.

### Smoke tests
- Added `npm run test:smoke` covering critical data-flow logic:
  - canonical pipeline invariants
  - weekly/daily fantasy scoring behavior
  - lineup/idempotency + slot eligibility logic

## Current known debt (not solved here)
- Full `npm run lint` still fails due pre-existing repo-wide issues outside this baseline hardening task.
- Test runtime still prints `MODULE_TYPELESS_PACKAGE_JSON` warning (non-blocking); tests pass.

## Required pre-merge commands going forward
1. `npm run typecheck`
2. `npm run lint:core`
3. `npm run test:smoke`

Optional (debt visibility):
- `npm run lint` (expected to fail until full lint cleanup initiative is completed).

