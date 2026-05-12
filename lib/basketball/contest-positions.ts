// lib/basketball/contest-positions.ts
//
// Position-slot eligibility for authorized-league fantasy contests.
// Mirrors the NBA DFS helper at lib/fantasy/daily/positions.ts but uses
// 0-indexed slots to match the basketball contest schema
// (basketball_user_lineup_players.slot starts at 0; see migration 032).
//
// Canonical position strings are stored on basketball_players.position
// and admins choose one from CANONICAL_POSITIONS. Combo positions
// ("PG/SG") are OR-based: eligible for slot 0 OR slot 1.

export const SLOT_LABELS = ["PG", "SG", "SF", "PF", "C"] as const;
export const LINEUP_SIZE = SLOT_LABELS.length;

const SLOT_POSITION: Record<number, string> = {
  0: "PG",
  1: "SG",
  2: "SF",
  3: "PF",
  4: "C",
};

export const CANONICAL_POSITIONS = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "PG/SG",
  "SG/SF",
  "SF/PF",
  "PF/C",
] as const;
export type CanonicalPosition = (typeof CANONICAL_POSITIONS)[number];

const CANONICAL_SET = new Set<string>(CANONICAL_POSITIONS);

export function isCanonicalPosition(p: string | null | undefined): p is CanonicalPosition {
  return !!p && CANONICAL_SET.has(p);
}

/**
 * Split a stored position string into its component primary positions.
 *
 *   "PG"      → ["PG"]
 *   "PG/SG"   → ["PG", "SG"]
 *   ""/null   → []
 *
 * Unknown tokens (e.g. legacy free-text values) are silently dropped so
 * a malformed value can't crash the lineup builder; in that case the
 * player is just ineligible for every slot.
 */
export function parsePositions(position: string | null | undefined): string[] {
  if (!position) return [];
  return position
    .toUpperCase()
    .split("/")
    .map((p) => p.trim())
    .filter((p) => p === "PG" || p === "SG" || p === "SF" || p === "PF" || p === "C");
}

export function isEligibleForContestSlot(
  position: string | null | undefined,
  slot: number,
): boolean {
  const required = SLOT_POSITION[slot];
  if (!required) return false;
  return parsePositions(position).includes(required);
}

/**
 * Slot indices [0..4] the player could fill. If `openSlots` is provided
 * the returned list is intersected with it so callers can ask "which
 * empty slots can this player still fill?".
 */
export function getEligibleSlots(
  position: string | null | undefined,
  openSlots?: number[],
): number[] {
  const positions = parsePositions(position);
  const all: number[] = [];
  for (let slot = 0; slot < LINEUP_SIZE; slot++) {
    if (positions.includes(SLOT_POSITION[slot])) all.push(slot);
  }
  if (!openSlots) return all;
  const openSet = new Set(openSlots);
  return all.filter((s) => openSet.has(s));
}
