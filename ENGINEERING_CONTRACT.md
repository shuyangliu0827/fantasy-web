# Engineering Contract for Data-Flow Changes

Use this checklist for every PR touching player data, scoring, or schedule logic.

## 1) Single-source metadata rule
- [ ] Do not introduce page-local position normalization logic when shared helpers exist.
- [ ] Player identity and metadata should flow from canonical sources; avoid parallel ad-hoc maps.
- [ ] Same player should render same position across rankings / roster / matchup / free-agents / compare.

## 2) Date/season correctness rule
- [ ] Do not compute season/date-sensitive values at module load when request-time evaluation is required.
- [ ] Use UTC-safe helpers for date boundaries and scoring windows.
- [ ] Historical dates must remain deterministic and not depend on mutable “today” assumptions.

## 3) Live-data caching rule
- [ ] Explicitly document cache ownership for any endpoint (DB-first, API-first, TTL, fallback).
- [ ] Avoid accidental static caching for live-data endpoints.
- [ ] Never allow null/empty API results to overwrite valid historical stored stats.

## 4) Pipeline clarity rule
- [ ] Clearly separate:
  - player metadata
  - season aggregate stats
  - daily game stats
  - derived fantasy scoring
- [ ] If a view consumes more than one layer, document merge precedence.

## 5) Baseline verification rule
Before merge, run:
- [ ] `npm run typecheck`
- [ ] `npm run lint:core`
- [ ] `npm run test:smoke`

If full lint/test fail due known debt, call that out explicitly and confirm baseline gates passed.
