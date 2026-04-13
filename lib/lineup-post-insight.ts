import type { AppLanguage } from "./language-labels";

export type LineupInsightPlayer = {
  id?: string;
  name: string;
  slot?: string;
  position?: string;
  projectedPoints?: number;
};

export type BuildLineupInsightInput = {
  starters: LineupInsightPlayer[];
  bench?: LineupInsightPlayer[];
  lineupDate?: string;
  lineupWeek?: number;
};

export type LineupInsight = {
  starters: LineupInsightPlayer[];
  bench: LineupInsightPlayer[];
  corePlayers: LineupInsightPlayer[];
  riskyPlayers: LineupInsightPlayer[];
  benchedNotables: LineupInsightPlayer[];
  biggestDecision?: {
    starter: LineupInsightPlayer;
    bench: LineupInsightPlayer;
    projectedGap?: number;
  };
  strategyType: "safe" | "balanced" | "aggressive";
  projectedTotal?: number;
  interactionPromptCode: "agree_or_disagree" | "bench_debate" | "upside_call";
  lineupDate?: string;
  lineupWeek?: number;
};

function normalizePosition(value?: string): string[] {
  if (!value) return [];
  return value.replace(/\//g, "-").split("-").map((item) => item.trim().toUpperCase()).filter(Boolean);
}

function slotCompatible(slot?: string, benchPos?: string): boolean {
  if (!slot || !benchPos) return false;
  const normalized = normalizePosition(benchPos);
  if (normalized.length === 0) return false;
  if (slot.startsWith("UTIL")) return true;
  if (slot === "G") return normalized.includes("PG") || normalized.includes("SG");
  if (slot === "F") return normalized.includes("SF") || normalized.includes("PF");
  if (slot.startsWith("BE")) return true;
  return normalized.includes(slot);
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildLineupInsight(input: BuildLineupInsightInput): LineupInsight {
  const starters = input.starters ?? [];
  const bench = input.bench ?? [];

  const starterWithProj = starters.filter((p) => typeof p.projectedPoints === "number") as Array<LineupInsightPlayer & { projectedPoints: number }>;
  const benchWithProj = bench.filter((p) => typeof p.projectedPoints === "number") as Array<LineupInsightPlayer & { projectedPoints: number }>;

  const projectedTotal = starterWithProj.length > 0
    ? roundOne(starterWithProj.reduce((sum, player) => sum + player.projectedPoints, 0))
    : undefined;

  const sortedStarters = [...starters].sort((a, b) => (b.projectedPoints ?? -Infinity) - (a.projectedPoints ?? -Infinity));
  const corePlayers = sortedStarters.slice(0, Math.min(2, sortedStarters.length));

  const sortedBench = [...bench].sort((a, b) => (b.projectedPoints ?? -Infinity) - (a.projectedPoints ?? -Infinity));
  const topBench = sortedBench[0];

  let biggestDecision: LineupInsight["biggestDecision"];
  if (topBench && typeof topBench.projectedPoints === "number") {
    const topBenchProjection = topBench.projectedPoints;
    const comparableStarters = starters.filter((starter) => slotCompatible(starter.slot, topBench.position));
    const candidateStarters = comparableStarters.length > 0 ? comparableStarters : starters;
    const closestStarter = [...candidateStarters]
      .filter((starter) => typeof starter.projectedPoints === "number")
      .sort((a, b) => Math.abs((a.projectedPoints ?? 0) - topBenchProjection) - Math.abs((b.projectedPoints ?? 0) - topBenchProjection))[0];

    if (closestStarter) {
      biggestDecision = {
        starter: closestStarter,
        bench: topBench,
        projectedGap: roundOne((closestStarter.projectedPoints ?? 0) - topBenchProjection),
      };
    }
  }

  const benchedNotables = sortedBench
    .filter((player): player is LineupInsightPlayer & { projectedPoints: number } => typeof player.projectedPoints === "number")
    .filter((player) => {
      if (!biggestDecision?.starter.projectedPoints) return player.projectedPoints >= 25;
      return player.projectedPoints >= biggestDecision.starter.projectedPoints - 3;
    })
    .slice(0, 2);

  const riskyPlayers = starters
    .filter((starter) => {
      if (typeof starter.projectedPoints !== "number") return true;
      if (!projectedTotal || starters.length === 0) return false;
      const avg = projectedTotal / starters.length;
      return starter.projectedPoints < avg * 0.75;
    })
    .slice(0, 2);

  let strategyType: LineupInsight["strategyType"] = "balanced";
  if (riskyPlayers.length >= 2 || (biggestDecision?.projectedGap !== undefined && biggestDecision.projectedGap <= 2.0)) {
    strategyType = "aggressive";
  } else if (riskyPlayers.length === 0 && (!biggestDecision || (biggestDecision.projectedGap ?? 0) >= 5)) {
    strategyType = "safe";
  }

  const interactionPromptCode: LineupInsight["interactionPromptCode"] =
    strategyType === "aggressive" ? "upside_call" : biggestDecision ? "bench_debate" : "agree_or_disagree";

  return {
    starters,
    bench,
    corePlayers,
    riskyPlayers,
    benchedNotables,
    biggestDecision,
    strategyType,
    projectedTotal,
    interactionPromptCode,
    lineupDate: input.lineupDate,
    lineupWeek: input.lineupWeek,
  };
}

function formatCompactSummary(insight: LineupInsight): string {
  const starters = insight.starters.map((p) => p.name).join(" / ");
  const bench = insight.bench.map((p) => p.name).join(" / ");
  if (!bench) return starters;
  return `${starters} | BENCH: ${bench}`;
}

export function renderLineupPostZh(insight: LineupInsight): { title: string; body: string; lineupSummary: string } {
  const core = insight.corePlayers.map((p) => p.name).join("、") || "这套首发";
  const strategyLine = insight.strategyType === "safe"
    ? "今天偏稳一点，先把基础分拿住。"
    : insight.strategyType === "aggressive"
    ? "今天我更看重上限，阵容会更激进。"
    : "今天走平衡思路，稳定和上限都要。";

  const decisionLine = insight.biggestDecision
    ? `最纠结的是 ${insight.biggestDecision.starter.name} 和 ${insight.biggestDecision.bench.name}，最后我还是先发前者。`
    : "最难的是边缘位取舍，最后还是按整体搭配来。";

  const hook = insight.interactionPromptCode === "upside_call"
    ? "你会跟我一样搏上限，还是会更保守？"
    : insight.interactionPromptCode === "bench_debate"
    ? "这个替补取舍你会怎么选？"
    : "这套阵容你会打几分？";

  const title = insight.lineupWeek ? "这周阵容，我这样押" : "今晚阵容，我这样下判断";
  const projected = typeof insight.projectedTotal === "number" ? `预计总分大概 ${insight.projectedTotal.toFixed(1)}。` : "";

  return {
    title,
    body: `${strategyLine}\n核心我押 ${core}。${projected}\n${decisionLine}\n${hook}`.trim(),
    lineupSummary: `首发: ${insight.starters.map((p) => p.name).join("、")}\n替补: ${insight.bench.map((p) => p.name).join("、") || "无"}`,
  };
}

export function renderLineupPostEn(insight: LineupInsight): { title: string; body: string; lineupSummary: string } {
  const core = insight.corePlayers.map((p) => p.name).join(", ") || "this starting group";
  const strategyLine = insight.strategyType === "safe"
    ? "I played this one fairly safe to lock in a strong floor."
    : insight.strategyType === "aggressive"
    ? "I leaned aggressive tonight and prioritized ceiling."
    : "I went balanced tonight, mixing stability with upside.";

  const decisionLine = insight.biggestDecision
    ? `Toughest call was ${insight.biggestDecision.starter.name} vs ${insight.biggestDecision.bench.name}, and I stuck with ${insight.biggestDecision.starter.name}.`
    : "The toughest part was the edge slots, so I prioritized fit over noise.";

  const hook = insight.interactionPromptCode === "upside_call"
    ? "Would you chase upside here or play it safer?"
    : insight.interactionPromptCode === "bench_debate"
    ? "Did I bench the wrong guy?"
    : "How would you rate this lineup call?";

  const title = insight.lineupWeek ? "My lineup approach for this week" : "My call on tonight's lineup";
  const projected = typeof insight.projectedTotal === "number" ? `Projected total is around ${insight.projectedTotal.toFixed(1)}.` : "";

  return {
    title,
    body: `${strategyLine}\nI’m building around ${core}. ${projected}`.trim() + `\n${decisionLine}\n${hook}`,
    lineupSummary: formatCompactSummary(insight),
  };
}

export function renderLineupPostDraft(insight: LineupInsight, lang: AppLanguage) {
  return lang === "zh" ? renderLineupPostZh(insight) : renderLineupPostEn(insight);
}
