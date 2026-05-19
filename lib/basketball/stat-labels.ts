// lib/basketball/stat-labels.ts
//
// Bilingual display labels for basketball stat keys, used by both the
// public box score / player stat tables and the live scorekeeping panel.
// Keep the keys aligned with basketball_player_game_stats columns so we
// can drive table headers from a single source.
//
// Positions (PG/SG/SF/PF/C/G/F) are intentionally NOT translated — these
// are basketball-standard abbreviations the product exposes the same way
// regardless of language.

export type StatKey =
  | "min"
  | "pts"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov"
  | "fgm"
  | "fga"
  | "fg3m"
  | "fg3a"
  | "ftm"
  | "fta"
  | "fg"
  | "fg3"
  | "ft"
  | "fpts";

const ZH: Record<StatKey, string> = {
  min: "上场",
  pts: "得分",
  reb: "篮板",
  ast: "助攻",
  stl: "抢断",
  blk: "盖帽",
  tov: "失误",
  fgm: "投中",
  fga: "出手",
  fg3m: "三分中",
  fg3a: "三分出手",
  ftm: "罚中",
  fta: "罚球",
  fg: "投篮",
  fg3: "三分",
  ft: "罚球",
  fpts: "梦幻分",
};

const EN: Record<StatKey, string> = {
  min: "MIN",
  pts: "PTS",
  reb: "REB",
  ast: "AST",
  stl: "STL",
  blk: "BLK",
  tov: "TOV",
  fgm: "FGM",
  fga: "FGA",
  fg3m: "3PM",
  fg3a: "3PA",
  ftm: "FTM",
  fta: "FTA",
  fg: "FG",
  fg3: "3P",
  ft: "FT",
  fpts: "FPTS",
};

export function statLabel(stat: StatKey, lang: "zh" | "en"): string {
  return (lang === "zh" ? ZH : EN)[stat] ?? stat;
}

// Event button labels for the live scorekeeping panel.
import type { StatEventType } from "@/lib/basketball/events";

type EventLabels = { zh: string; en: string };

const EVENT_LABELS: Record<StatEventType, EventLabels> = {
  two_pt_made: { zh: "+2", en: "+2" },
  two_pt_missed: { zh: "两分不中", en: "2 miss" },
  three_pt_made: { zh: "+3", en: "+3" },
  three_pt_missed: { zh: "三分不中", en: "3 miss" },
  ft_made: { zh: "罚球命中", en: "FT+" },
  ft_missed: { zh: "罚球不中", en: "FT−" },
  reb: { zh: "篮板", en: "REB" },
  ast: { zh: "助攻", en: "AST" },
  stl: { zh: "抢断", en: "STL" },
  blk: { zh: "盖帽", en: "BLK" },
  tov: { zh: "失误", en: "TOV" },
};

export function eventLabel(type: StatEventType, lang: "zh" | "en"): string {
  const entry = EVENT_LABELS[type];
  if (!entry) return type;
  return lang === "zh" ? entry.zh : entry.en;
}
