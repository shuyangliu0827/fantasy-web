import { PLAYER_POSITIONS } from "./player-positions.ts";

const CORE_POSITIONS = new Set(["PG", "SG", "SF", "PF", "C"]);

const GENERIC_TOKEN_EXPANSION: Record<string, string[]> = {
  G: ["PG", "SG"],
  F: ["SF", "PF"],
  "G-F": ["SG", "SF"],
  "F-G": ["SG", "SF"],
  "F-C": ["PF", "C"],
  "C-F": ["PF", "C"],
};

const CANONICAL_COMBOS: string[][] = [
  ["PG", "SG"],
  ["PF", "C"],
  ["SG", "SF"],
  ["SF", "PF"],
];

function canonicalizeFromSet(set: Set<string>): string {
  if (set.size === 1) return [...set][0];
  if (set.size >= 4 && set.has("SG") && set.has("SF")) return "SG/SF";

  for (const combo of CANONICAL_COMBOS) {
    if (combo.every((p) => set.has(p))) {
      return combo.join("/");
    }
  }

  if (set.has("PG") || set.has("SG")) return "PG/SG";
  if (set.has("SF") || set.has("PF")) return "SF/PF";
  if (set.has("C")) return "C";
  return "N/A";
}

export function normalizeFantasyPosition(position: string, playerName?: string): string {
  const override = playerName ? PLAYER_POSITIONS[playerName] : undefined;
  if (override) return override;

  const raw = (position || "").trim().toUpperCase();
  if (!raw) return "N/A";

  if (CORE_POSITIONS.has(raw)) return raw;

  const normalized = raw.replace(/\s+/g, "").replace(/-/g, "/");
  const tokens = normalized.split("/").filter(Boolean);
  if (tokens.length === 0) return "N/A";

  const expanded = new Set<string>();
  for (const token of tokens) {
    if (CORE_POSITIONS.has(token)) {
      expanded.add(token);
      continue;
    }
    const mapped = GENERIC_TOKEN_EXPANSION[token];
    if (mapped) mapped.forEach((p) => expanded.add(p));
  }

  if (expanded.size === 0) return "N/A";
  return canonicalizeFromSet(expanded);
}
