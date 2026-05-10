import { PLAYER_POSITIONS } from "./positions";

const POSITION_ORDER: Record<string, number> = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 };
const CANONICAL_PAIRS = new Set(["PG/SG", "SG/SF", "SF/PF", "PF/C"]);

export function toCanonicalPlayerKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function normalizePosition(raw?: string): string {
  if (!raw) return "N/A";
  const clean = raw.toUpperCase().replace(/\s+/g, "");
  if (clean === "G") return "PG/SG";
  if (clean === "F") return "SF/PF";
  if (clean === "G-F" || clean === "F-G") return "SG/SF";
  if (clean === "G/F" || clean === "F/G") return "SG/SF";
  if (clean === "F-C" || clean === "C-F") return "PF/C";
  if (clean === "F/C" || clean === "C/F") return "PF/C";

  const tokens = clean.split("/").map((t) => t.trim()).filter(Boolean);
  const deduped = Array.from(new Set(tokens))
    .filter((t) => t in POSITION_ORDER)
    .sort((a, b) => POSITION_ORDER[a] - POSITION_ORDER[b]);

  if (deduped.length === 0) return "N/A";
  if (deduped.length === 1) return deduped[0];

  const pair = `${deduped[0]}/${deduped[1]}`;
  if (CANONICAL_PAIRS.has(pair)) return pair;
  return pair;
}

export function getCanonicalPlayerPosition(name: string, rawPosition?: string): string {
  const override = PLAYER_POSITIONS[name];
  if (override) return normalizePosition(override);
  return normalizePosition(rawPosition);
}
