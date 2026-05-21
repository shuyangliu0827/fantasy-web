// lib/fantasy/index.ts
//
// Façade for the **fantasy** domain — season-long fantasy leagues that
// live on the `leagues` table plus the Daily Contest layer. This module
// is the single import point for fantasy-only helpers.
//
// IMPORTANT (Rule E):
//   Do NOT mix fantasy commissioner logic with basketball League
//   Management Center logic. The `leagues` table (slug-based,
//   commissioner_id, BDL integer player IDs) is intentionally separate
//   from `basketball_leagues` (UUID-based, role tables, real-world
//   custom box scores). For basketball management helpers, import from
//   "@/lib/league-management" instead.

// Daily contest layer: auth, fetch wrapper, lineup/salary/positions,
// pool building, settling, week math.
export * from "./daily";

// Season-long layer: matchup generation, roster history.
export * from "./season";

// Scoring rules and week utilities shared across daily + season.
// (Note: ./shared exports overlap with @/lib/scoring — both paths are
// intentional so importers can choose the most descriptive surface.)
export * from "./shared";
