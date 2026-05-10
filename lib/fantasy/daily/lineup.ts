/**
 * lib/lineup.ts
 * Pure, side-effect-free lineup helpers.
 * No Supabase dependency — safe to import in tests and server-side code.
 */

import { PLAYER_POSITIONS } from "@/lib/players/positions";
import type { RosterPlayer, LineupMap } from "@/lib/shared/store";

// ── Slot eligibility ─────────────────────────────────────────────────────────

/** Which positions are eligible for each lineup slot. */
export const SLOT_ELIGIBLE: Record<string, string[]> = {
  PG:    ["PG"],
  SG:    ["SG"],
  SF:    ["SF"],
  PF:    ["PF"],
  C:     ["C"],
  G:     ["PG", "SG"],
  F:     ["SF", "PF", "C"],
  UTIL1: ["PG", "SG", "SF", "PF", "C"],
  UTIL2: ["PG", "SG", "SF", "PF", "C"],
  UTIL3: ["PG", "SG", "SF", "PF", "C"],
  BE1:   ["PG", "SG", "SF", "PF", "C"],
  BE2:   ["PG", "SG", "SF", "PF", "C"],
  BE3:   ["PG", "SG", "SF", "PF", "C"],
};

/**
 * Expands generic NBA API positions to specific fantasy positions.
 * The NBA API sometimes returns "G", "F", "G-F", "F-C", etc.
 * Fantasy slots only recognize PG, SG, SF, PF, C.
 */
const GENERIC_POSITION_MAP: Record<string, string[]> = {
  "G":   ["PG", "SG"],
  "F":   ["SF", "PF"],
  "C":   ["C"],
  "G-F": ["PG", "SG", "SF", "PF"],
  "F-G": ["PG", "SG", "SF", "PF"],
  "F-C": ["SF", "PF", "C"],
  "C-F": ["PF", "C"],
};

/**
 * Returns true if a player with the given position string is eligible for slot.
 * Position may be multi-value (e.g. "PG/SG", "PF/C") or a generic API value
 * like "G" or "F" which is normalized to specific fantasy positions.
 */
export function isEligibleForSlot(playerPosition: string, slot: string): boolean {
  const eligible = SLOT_ELIGIBLE[slot];
  if (!eligible) return false;

  // Expand each token: if it's a generic position, replace with specific ones
  const positions: string[] = [];
  for (const token of playerPosition.split("/").map(p => p.trim())) {
    const expanded = GENERIC_POSITION_MAP[token];
    if (expanded) {
      positions.push(...expanded);
    } else {
      positions.push(token);
    }
  }

  return positions.some(p => eligible.includes(p));
}

// ── Quick Lineup (自动排阵) ───────────────────────────────────────────────────

/**
 * Compute a Quick Lineup for a given roster.
 *
 * Pure function — no localStorage reads, no side effects.
 * Calling with identical inputs always returns an identical result (idempotent).
 *
 * Algorithm (greedy, deterministic):
 *   priority value = GAME_DAY_BONUS * hasGame(p) + p.ppg
 *   Fill constrained slots first (PG→C), then flexible (G, F), then UTIL, then bench.
 *   Each player is assigned at most once.
 *   If no eligible player is available for a slot, that slot is left empty.
 *   Empty slots are NEVER filled by duplicating a player.
 *
 * @param roster           Active players eligible for assignment (already filtered to date).
 * @param lockedSlots      Assignments that must remain fixed (e.g. game already started).
 *                         Locked players are excluded from re-assignment to any other slot.
 * @param playersWithGames Set of player IDs who have a scheduled game on the target date.
 *                         These receive a large priority bonus so they beat equally-ranked
 *                         players who are sitting out that day.
 */
export function autoSetLineup(
  roster: RosterPlayer[],
  lockedSlots: LineupMap = {},
  playersWithGames: Set<string> = new Set(),
): LineupMap {
  // Large enough that any player with a game outranks any player without,
  // regardless of PPG difference (NBA season max PPG is ~40).
  const GAME_DAY_BONUS = 1000;

  // Start from locked assignments — locked slots and locked players are frozen.
  const lineup: LineupMap = { ...lockedSlots };
  const assigned = new Set<string>(Object.values(lockedSlots));
  const filledSlots = new Set<string>(Object.keys(lockedSlots));

  const slotOrder = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3", "BE1", "BE2", "BE3"];

  for (const slot of slotOrder) {
    if (filledSlots.has(slot)) continue; // Locked slot — do not touch

    const eligible = roster
      .filter(p => {
        if (assigned.has(p.id)) return false;
        // Use PLAYER_POSITIONS override for accurate multi-position eligibility
        const pos = PLAYER_POSITIONS[p.name] || p.position;
        return isEligibleForSlot(pos, slot);
      })
      .sort((a, b) => {
        const aVal = (playersWithGames.has(a.id) ? GAME_DAY_BONUS : 0) + a.ppg;
        const bVal = (playersWithGames.has(b.id) ? GAME_DAY_BONUS : 0) + b.ppg;
        if (bVal !== aVal) return bVal - aVal;
        // Deterministic tie-breaker: stable sort by id so identical inputs → identical output
        return a.id < b.id ? -1 : 1;
      });

    if (eligible.length > 0) {
      lineup[slot] = eligible[0].id;
      assigned.add(eligible[0].id);
    }
    // No eligible player available → slot stays empty (no duplication)
  }

  return lineup;
}
