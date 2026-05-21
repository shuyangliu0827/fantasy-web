// lib/stats/index.ts
//
// Façade for shared stats helpers — null-safe stat pipelines, BDL
// minute parsing, stat label localization, NBA schedule + Ball Don't
// Lie wrappers. New code should import from "@/lib/stats" so the
// surface stays stable as internals move.
//
// Layering: this module exposes raw stat plumbing that's shared by
// fantasy AND basketball domains. Domain-specific aggregation lives in
// @/lib/scoring (fantasy) and @/lib/league-management (basketball
// box scores via lib/basketball/aggregate).

// Stat label localization (used by both fantasy and basketball UIs).
export * from "@/lib/basketball/stat-labels";

// Canonical stats pipeline (Rule A: null-safe BDL writes; Rule D:
// standings computed from matchups).
export * from "@/lib/shared/canonical-pipeline";

// Ball Don't Lie wrapper + parseMinutes() canonical parser.
export * from "@/lib/nba/balldontlie";

// NBA schedule helpers + mock schedule.
export * from "@/lib/nba/games";
export * from "@/lib/nba/schedule-mock";
