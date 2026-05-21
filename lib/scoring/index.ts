// lib/scoring/index.ts
//
// Façade for fantasy scoring math. Single source of truth for the
// ESPN-default weights, league weight overrides, and the calcFantasyPoints
// function used by daily contest + season-long lineups.
//
// This is a re-export layer over lib/fantasy/shared/*. Existing imports
// from those paths continue to work; new code should prefer
// "@/lib/scoring" so the surface stays stable.
//
// Note: real-league box-score scoring for basketball_* games uses a
// separate aggregator in lib/basketball/aggregate (surfaced via
// @/lib/league-management). Do not confuse the two.

export * from "@/lib/fantasy/shared/scoring-config";
export * from "@/lib/fantasy/shared/scoring-rules";
