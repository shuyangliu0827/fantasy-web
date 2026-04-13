import type { AppLanguage } from "./language-labels";

export type LineupInsightPlayer = {
  id?: string;
  name: string;
  slot?: string;
  position?: string;
  projectedPoints?: number;
  hasGame?: boolean;
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
  activeStarters: LineupInsightPlayer[];
  inactiveStarters: LineupInsightPlayer[];
  topPlayers: LineupInsightPlayer[];
  watchPlayer?: LineupInsightPlayer;
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
  hasEnoughActivePlayersForNarrative: boolean;
  highlightStrategy: "active_top2_watch1" | "active_two_simple" | "active_one_focus" | "no_active" | "active_no_scores";
  watchPlayerIsCloseCall: boolean;
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
  const activeStarters = starters.filter((starter) => starter.hasGame === true);
  const inactiveStarters = starters.filter((starter) => starter.hasGame !== true);

  const starterWithProj = activeStarters.filter((p) => typeof p.projectedPoints === "number") as Array<LineupInsightPlayer & { projectedPoints: number }>;
  const benchWithProj = bench.filter((p) => typeof p.projectedPoints === "number") as Array<LineupInsightPlayer & { projectedPoints: number }>;

  const projectedTotal = starterWithProj.length > 0
    ? roundOne(starterWithProj.reduce((sum, player) => sum + player.projectedPoints, 0))
    : undefined;

  const sortedActiveByProjection = [...activeStarters].sort((a, b) => (b.projectedPoints ?? -Infinity) - (a.projectedPoints ?? -Infinity));
  const activeWithProjection = sortedActiveByProjection.filter(
    (player): player is LineupInsightPlayer & { projectedPoints: number } => typeof player.projectedPoints === "number"
  );
  let topPlayers: LineupInsightPlayer[] = [];
  let watchPlayer: LineupInsightPlayer | undefined;
  let watchPlayerIsCloseCall = false;
  let highlightStrategy: LineupInsight["highlightStrategy"] = "no_active";

  if (activeStarters.length === 0) {
    highlightStrategy = "no_active";
  } else if (activeWithProjection.length === 0) {
    highlightStrategy = "active_no_scores";
    topPlayers = activeStarters.slice(0, Math.min(2, activeStarters.length));
  } else if (activeStarters.length >= 3 && activeWithProjection.length >= 3) {
    highlightStrategy = "active_top2_watch1";
    topPlayers = activeWithProjection.slice(0, 2);
    watchPlayer = activeWithProjection[activeWithProjection.length - 1];
    const secondLowest = activeWithProjection[activeWithProjection.length - 2];
    const watchProjection = watchPlayer.projectedPoints ?? 0;
    watchPlayerIsCloseCall = !!secondLowest && Math.abs(secondLowest.projectedPoints - watchProjection) <= 2;
  } else if (activeStarters.length >= 2) {
    highlightStrategy = "active_two_simple";
    topPlayers = activeWithProjection.length > 0
      ? activeWithProjection.slice(0, Math.min(2, activeWithProjection.length))
      : activeStarters.slice(0, 2);
  } else {
    highlightStrategy = "active_one_focus";
    topPlayers = activeWithProjection.length > 0 ? [activeWithProjection[0]] : [activeStarters[0]];
  }

  const corePlayers = topPlayers;

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

  const riskyPlayers = activeStarters
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
    strategyType === "aggressive" ? "upside_call" : watchPlayer ? "bench_debate" : "agree_or_disagree";

  return {
    starters,
    bench,
    activeStarters,
    inactiveStarters,
    topPlayers,
    watchPlayer,
    corePlayers,
    riskyPlayers,
    benchedNotables,
    biggestDecision,
    strategyType,
    projectedTotal,
    interactionPromptCode,
    hasEnoughActivePlayersForNarrative: activeStarters.length >= 3 && activeWithProjection.length >= 3,
    highlightStrategy,
    watchPlayerIsCloseCall,
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
  const core = insight.topPlayers.map((p) => p.name).join(" 和 ");
  const hook = insight.highlightStrategy === "no_active"
    ? "你们会先观望，还是提前做调整？"
    : "你们会继续信这套吗？";

  const title = insight.lineupWeek ? "这周阵容，我这样押" : "今晚阵容，我这样下判断";
  const projected = typeof insight.projectedTotal === "number" ? `预计总分大概 ${insight.projectedTotal.toFixed(1)}。` : "";
  if (insight.highlightStrategy === "no_active") {
    return {
      title,
      body: `阵容先按计划放好了，不过今天这天赛程可聊的 active 点不多。${projected}\n${hook}`.trim(),
      lineupSummary: `首发: ${insight.starters.map((p) => p.name).join("、")}\n替补: ${insight.bench.map((p) => p.name).join("、") || "无"}`,
    };
  }

  if (insight.highlightStrategy === "active_one_focus") {
    const only = insight.topPlayers[0]?.name || insight.activeStarters[0]?.name || "这位先发";
    return {
      title,
      body: `今天这套我会先盯 ${only} 这个点。${projected}\n其他位置先求稳，等临场再看波动。\n${hook}`.trim(),
      lineupSummary: `首发: ${insight.starters.map((p) => p.name).join("、")}\n替补: ${insight.bench.map((p) => p.name).join("、") || "无"}`,
    };
  }

  if (insight.highlightStrategy === "active_two_simple" || insight.highlightStrategy === "active_no_scores") {
    const focus = core || insight.activeStarters.map((p) => p.name).join(" 和 ");
    return {
      title,
      body: `今天这套我主要还是信 ${focus} 这几个 active 点。${projected}\n目前先不做太激进的排序判断，先看比赛开局。\n${hook}`.trim(),
      lineupSummary: `首发: ${insight.starters.map((p) => p.name).join("、")}\n替补: ${insight.bench.map((p) => p.name).join("、") || "无"}`,
    };
  }

  const watch = insight.watchPlayer?.name || "这个点";
  const watchLine = insight.watchPlayerIsCloseCall
    ? `${watch} 这边和前面差距其实很小，我反而觉得他很值得关注。`
    : `${watch} 这边虽然当前预测不算最高，但我还是想看看他能不能打出超过预期的表现。`;

  return {
    title,
    body: `今天这套我主要还是信 ${core} 这两个点。${projected}\n他们会是我今天最主要的输出来源。\n${watchLine}\n${hook}`.trim(),
    lineupSummary: `首发: ${insight.starters.map((p) => p.name).join("、")}\n替补: ${insight.bench.map((p) => p.name).join("、") || "无"}`,
  };
}

export function renderLineupPostEn(insight: LineupInsight): { title: string; body: string; lineupSummary: string } {
  const core = insight.topPlayers.map((p) => p.name).join(" and ");
  const hook = insight.highlightStrategy === "no_active"
    ? "Would you hold this setup or start rotating early?"
    : "Would you keep this setup as is?";

  const title = insight.lineupWeek ? "My lineup approach for this week" : "My call on tonight's lineup";
  const projected = typeof insight.projectedTotal === "number" ? `Projected total is around ${insight.projectedTotal.toFixed(1)}.` : "";
  if (insight.highlightStrategy === "no_active") {
    return {
      title,
      body: `Lineup is set, but today’s slate doesn’t give me many active talking points yet. ${projected}\n${hook}`.trim(),
      lineupSummary: formatCompactSummary(insight),
    };
  }

  if (insight.highlightStrategy === "active_one_focus") {
    const only = insight.topPlayers[0]?.name || insight.activeStarters[0]?.name || "this starter";
    return {
      title,
      body: `I’m mainly focused on ${only} for this slate. ${projected}\nThe rest of the lineup is more about stability until games tip off.\n${hook}`.trim(),
      lineupSummary: formatCompactSummary(insight),
    };
  }

  if (insight.highlightStrategy === "active_two_simple" || insight.highlightStrategy === "active_no_scores") {
    const focus = core || insight.activeStarters.map((p) => p.name).join(" and ");
    return {
      title,
      body: `I’m mainly leaning on ${focus} to carry this lineup tonight. ${projected}\nI’m keeping the read simple for now and waiting on game flow before making sharper calls.\n${hook}`.trim(),
      lineupSummary: formatCompactSummary(insight),
    };
  }

  const watch = insight.watchPlayer?.name || "this starter";
  const watchLine = insight.watchPlayerIsCloseCall
    ? `${watch} is close to the same projection tier, so I still think he’s worth watching.`
    : `${watch} doesn’t project quite as high, but he still has room to beat expectation.`;

  return {
    title,
    body: `I’m mainly leaning on ${core} to carry this lineup tonight. ${projected}\nThey look like my strongest anchors among today’s active starters.\n${watchLine}\n${hook}`.trim(),
    lineupSummary: formatCompactSummary(insight),
  };
}

export function renderLineupPostDraft(insight: LineupInsight, lang: AppLanguage) {
  return lang === "zh" ? renderLineupPostZh(insight) : renderLineupPostEn(insight);
}
