// lib/compare-strategy-presets.ts
// Legacy strategy presets extracted from the original compare page.
// These drive the secondary "Player Profile" radar chart panel —
// they are NOT the primary comparison framework (that is DecisionView).

export const STRATEGY_PRESETS = {
  balanced:   { name: "均衡",     nameEn: "Balanced",      weights: { ppg: 1,   rpg: 1,   apg: 1,   spg: 1,   bpg: 1,   fg: 1,   ft: 1,   tov: 1   } },
  scoring:    { name: "得分手",   nameEn: "Scoring Focus", weights: { ppg: 2,   rpg: 0.5, apg: 1,   spg: 0.5, bpg: 0.5, fg: 1,   ft: 1.5, tov: 0.5 } },
  assists:    { name: "组织核心", nameEn: "Playmaker",     weights: { ppg: 1,   rpg: 0.5, apg: 2,   spg: 1,   bpg: 0.5, fg: 1,   ft: 1,   tov: 1.5 } },
  rebounds:   { name: "篮板怪兽", nameEn: "Rebounder",     weights: { ppg: 0.5, rpg: 2,   apg: 0.5, spg: 0.5, bpg: 1.5, fg: 1,   ft: 0.5, tov: 0.5 } },
  defense:    { name: "防守悍将", nameEn: "Defensive",     weights: { ppg: 0.5, rpg: 1,   apg: 0.5, spg: 2,   bpg: 2,   fg: 0.5, ft: 0.5, tov: 0.5 } },
  efficiency: { name: "效率优先", nameEn: "Efficiency",    weights: { ppg: 1,   rpg: 0.5, apg: 0.5, spg: 0.5, bpg: 0.5, fg: 2,   ft: 2,   tov: 2   } },
  punt_ft:    { name: "放弃罚球", nameEn: "Punt FT%",      weights: { ppg: 1.2, rpg: 1.2, apg: 1.2, spg: 1.2, bpg: 1.2, fg: 1.5, ft: 0,   tov: 1   } },
  punt_fg:    { name: "放弃命中率", nameEn: "Punt FG%",    weights: { ppg: 1.2, rpg: 1,   apg: 1.5, spg: 1.2, bpg: 1,   fg: 0,   ft: 1.5, tov: 1.2 } },
  punt_to:    { name: "放弃失误", nameEn: "Punt TO",       weights: { ppg: 1.5, rpg: 1,   apg: 1.5, spg: 1,   bpg: 1,   fg: 1,   ft: 1,   tov: 0   } },
};

export type StrategyKey = keyof typeof STRATEGY_PRESETS;

export const RADAR_STATS = ["ppg", "rpg", "apg", "spg", "bpg", "fg", "ft", "tov"] as const;

export const RADAR_MAX_VALUES: Record<string, number> = {
  ppg: 35, rpg: 15, apg: 12, spg: 2.5, bpg: 4, fg: 70, ft: 95, tov: 5,
};
