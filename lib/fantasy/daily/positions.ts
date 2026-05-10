// lib/contest-positions.ts
//
// Position-slot eligibility for the Daily Contest MVP.
//
// ── Design rules ──────────────────────────────────────────────
// 1. Uses canonical position strings already stored in player_stats_cache.position,
//    which are produced by getCanonicalPlayerPosition() → normalizePosition().
//    Format examples: "PG", "SG/SF", "PF/C", "N/A"
//
// 2. Combo positions are treated as OR:
//    "PG/SG" → eligible for slot 1 (PG) OR slot 2 (SG)
//    "SF/PF" → eligible for slot 3 (SF) OR slot 4 (PF)
//    "PF/C"  → eligible for slot 4 (PF) OR slot 5 (C)
//
// 3. No new position system. No name-based fallbacks. Parsing is purely
//    string-split on "/" with lowercase normalisation.
//
// ── Slot → required position ──────────────────────────────────
// The five contest slots map 1-to-1 to the five base positions.

export const SLOT_POSITION: Record<number, string> = {
  1: "pg",
  2: "sg",
  3: "sf",
  4: "pf",
  5: "c",
};

/** Display label for each slot shown in the lineup UI. */
export const SLOT_LABEL: Record<number, string> = {
  1: "PG",
  2: "SG",
  3: "SF",
  4: "PF",
  5: "C",
};

/**
 * Parses a canonical position string into an array of lowercase base positions.
 *
 * Input comes directly from player_stats_cache.position — no external API calls,
 * no name matching, no fallbacks.
 *
 * Examples:
 *   "PG"    → ["pg"]
 *   "PG/SG" → ["pg", "sg"]
 *   "SF/PF" → ["sf", "pf"]
 *   "PF/C"  → ["pf", "c"]
 *   "N/A"   → []
 */
export function parsePositions(position: string): string[] {
  if (!position || position === "N/A") return [];
  return position
    .toLowerCase()
    .split("/")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Returns true if a player with the given canonical position string is eligible
 * for the given contest slot number (1–5).
 *
 * Logic: split position on "/", check if the slot's required base position
 * appears in the resulting array.
 *
 * Examples:
 *   isEligibleForContestSlot("PG/SG", 1) → true  (slot 1 requires "pg")
 *   isEligibleForContestSlot("PG/SG", 2) → true  (slot 2 requires "sg")
 *   isEligibleForContestSlot("PG/SG", 3) → false (slot 3 requires "sf")
 *   isEligibleForContestSlot("C",     5) → true
 *   isEligibleForContestSlot("N/A",   1) → false
 */
export function isEligibleForContestSlot(position: string, slot: number): boolean {
  const required = SLOT_POSITION[slot];
  if (!required) return false;
  return parsePositions(position).includes(required);
}
