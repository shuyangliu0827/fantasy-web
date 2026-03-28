// lib/compare-engine.ts
// Pure TypeScript recommendation engine for player comparison.
// No React, no network calls. Takes CompareStats[], returns analysis.
// Can run server-side (in API route) or client-side (on view tab switch).

import type {
  CompareStats,
  CompareResult,
  DecisionView,
  GameLog,
  KeyEdge,
  QuickDecision,
  RiskNote,
  ScenarioRecommendation,
} from './compare-types';

// ─────────────────────────────────────────────────────────────
// Stability computation (exported so API route can reuse)
// ─────────────────────────────────────────────────────────────

export interface StabilityMetrics {
  consistencyScore: number;
  stdDev: number;
  floor: number;
  ceiling: number;
  boomRate: number;
  bustRate: number;
  recentTrend: 'up' | 'flat' | 'down';
  last5FptsAvg: number;
  trendDelta: number;
  hasSmallSample: boolean;
}

export function computeStabilityFromLogs(gameLogs: GameLog[], fptsPerGame: number): StabilityMetrics {
  const scores = gameLogs.filter(g => g.played).map(g => g.fpts);
  const n = scores.length;

  if (n < 3) {
    return {
      consistencyScore: 50,
      stdDev: 0,
      floor: fptsPerGame,
      ceiling: fptsPerGame,
      boomRate: 0,
      bustRate: 0,
      recentTrend: 'flat',
      last5FptsAvg: fptsPerGame,
      trendDelta: 0,
      hasSmallSample: true,
    };
  }

  const mean = scores.reduce((a, b) => a + b, 0) / n;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0;

  // Percentiles
  const sorted = [...scores].sort((a, b) => a - b);
  const floor = sorted[Math.floor(n * 0.25)] ?? mean;
  const ceiling = sorted[Math.floor(n * 0.75)] ?? mean;

  // Boom / bust using 1 SD bands
  const boomThreshold = mean + stdDev;
  const bustThreshold = Math.max(0, mean - stdDev);
  const boomRate = scores.filter(s => s >= boomThreshold).length / n;
  const bustRate = scores.filter(s => s <= bustThreshold).length / n;

  // Consistency: 0 CV = 100, 1.0 CV = 0
  const consistencyScore = Math.max(0, Math.min(100, Math.round((1 - cv) * 100)));

  // Trend: compare last 5 vs overall
  const last5 = scores.slice(-5);
  const last5FptsAvg = last5.reduce((a, b) => a + b, 0) / last5.length;
  const trendDelta = last5FptsAvg - mean;
  const trendThreshold = mean * 0.08;
  const recentTrend: 'up' | 'flat' | 'down' =
    trendDelta > trendThreshold ? 'up' :
    trendDelta < -trendThreshold ? 'down' : 'flat';

  return {
    consistencyScore,
    stdDev: Math.round(stdDev * 10) / 10,
    floor: Math.round(floor * 10) / 10,
    ceiling: Math.round(ceiling * 10) / 10,
    boomRate: Math.round(boomRate * 100) / 100,
    bustRate: Math.round(bustRate * 100) / 100,
    recentTrend,
    last5FptsAvg: Math.round(last5FptsAvg * 10) / 10,
    trendDelta: Math.round(trendDelta * 10) / 10,
    hasSmallSample: false,
  };
}

/** Heuristic stability for when no game logs are available (lastSeason fallback) */
export function estimateStabilityHeuristic(fptsPerGame: number, mpg: number): StabilityMetrics {
  const estimatedCV = 0.35 - (Math.min(mpg, 36) / 36) * 0.10;
  const stdDev = fptsPerGame * estimatedCV;
  return {
    consistencyScore: Math.max(0, Math.min(100, Math.round((1 - estimatedCV) * 100))),
    stdDev: Math.round(stdDev * 10) / 10,
    floor: Math.round(Math.max(0, fptsPerGame - stdDev) * 10) / 10,
    ceiling: Math.round((fptsPerGame + stdDev) * 10) / 10,
    boomRate: 0.2,
    bustRate: 0.2,
    recentTrend: 'flat',
    last5FptsAvg: fptsPerGame,
    trendDelta: 0,
    hasSmallSample: true,
  };
}

// ─────────────────────────────────────────────────────────────
// Key Edges
// ─────────────────────────────────────────────────────────────

const EDGE_DIMENSIONS: Array<{
  key: keyof CompareStats;
  label: string;
  labelZh: string;
  threshold: number;
  higherIsBetter: boolean;
}> = [
  { key: 'fptsPerGame',      label: 'FPTS/G',        labelZh: '场均FPTS',   threshold: 0.5,  higherIsBetter: true  },
  { key: 'consistencyScore', label: 'Consistency',   labelZh: '稳定性',      threshold: 5,    higherIsBetter: true  },
  { key: 'playRate',         label: 'Availability',  labelZh: '出场率',      threshold: 0.05, higherIsBetter: true  },
  { key: 'fg3mPg',           label: '3PM/G',         labelZh: '三分/场',     threshold: 0.3,  higherIsBetter: true  },
  { key: 'floor',            label: 'Floor',         labelZh: '下限',        threshold: 1.0,  higherIsBetter: true  },
  { key: 'ceiling',          label: 'Ceiling',       labelZh: '上限',        threshold: 2.0,  higherIsBetter: true  },
  { key: 'last5FptsAvg',     label: 'Recent Form',   labelZh: '近期状态',    threshold: 0.5,  higherIsBetter: true  },
];

export function generateKeyEdges(players: CompareStats[]): KeyEdge[] {
  if (players.length < 2) return [];
  const [a, b] = players;
  const edges: KeyEdge[] = [];

  for (const dim of EDGE_DIMENSIONS) {
    const valA = (a[dim.key] as number) ?? 0;
    const valB = (b[dim.key] as number) ?? 0;
    const rawDiff = valA - valB;
    if (Math.abs(rawDiff) < dim.threshold) continue;

    const maxVal = Math.max(valA, valB);
    const pctDiff = maxVal > 0 ? Math.abs(rawDiff) / maxVal : 0;
    const significance: KeyEdge['significance'] =
      pctDiff > 0.15 ? 'major' : pctDiff > 0.07 ? 'moderate' : 'minor';

    const winner = dim.higherIsBetter ? (valA >= valB ? a : b) : (valA <= valB ? a : b);
    const loser  = winner.playerId === a.playerId ? b : a;
    const winnerVal = winner.playerId === a.playerId ? valA : valB;
    const loserVal  = loser.playerId  === a.playerId ? valA : valB;

    const diff = Math.abs(rawDiff);
    let label: string;
    if (dim.key === 'playRate' || dim.key === 'boomRate' || dim.key === 'bustRate') {
      label = `+${(diff * 100).toFixed(0)}%`;
    } else if (dim.key === 'consistencyScore') {
      label = `+${diff.toFixed(0)} pts`;
    } else {
      label = `+${diff.toFixed(1)}`;
    }

    edges.push({
      category: dim.label,
      categoryZh: dim.labelZh,
      winnerId: winner.playerId,
      winnerName: winner.playerName,
      loserId: loser.playerId,
      loserName: loser.playerName,
      winnerValue: Math.round(winnerVal * 10) / 10,
      loserValue: Math.round(loserVal * 10) / 10,
      diff: Math.round(diff * 10) / 10,
      pctDiff: Math.round(pctDiff * 100) / 100,
      significance,
      label,
    });
  }

  // Sort by significance then pctDiff, cap at 5
  const order: Record<KeyEdge['significance'], number> = { major: 0, moderate: 1, minor: 2 };
  return edges
    .sort((a, b) => order[a.significance] - order[b.significance] || b.pctDiff - a.pctDiff)
    .slice(0, 5);
}

// ─────────────────────────────────────────────────────────────
// Quick Decision
// ─────────────────────────────────────────────────────────────

export function generateQuickDecision(players: CompareStats[]): QuickDecision {
  if (players.length < 2) {
    const p = players[0];
    return {
      recommendedPlayerId: p.playerId,
      recommendedPlayerName: p.playerName,
      scenario: 'Points League',
      reason: 'Only one player selected for comparison.',
      reasonZh: '仅选择了一名球员进行对比。',
      confidence: 'low',
    };
  }

  const [a, b] = players;
  const fptsDiff = Math.abs(a.fptsPerGame - b.fptsPerGame);
  const winner = a.fptsPerGame >= b.fptsPerGame ? a : b;
  const loser  = winner.playerId === a.playerId ? b : a;

  let confidence: QuickDecision['confidence'];
  let reason: string;
  let reasonZh: string;

  if (fptsDiff >= 3.0) {
    confidence = 'high';
    reason = `${winner.playerName} averages ${fptsDiff.toFixed(1)} more fantasy points per game — a clear production advantage.`;
    reasonZh = `${winner.playerName} 场均多得 ${fptsDiff.toFixed(1)} fpts，生产力优势明显。`;
  } else if (fptsDiff >= 1.0) {
    confidence = 'medium';
    if (winner.consistencyScore > loser.consistencyScore + 5) {
      reason = `${winner.playerName} leads in both production (+${fptsDiff.toFixed(1)} FPTS/G) and consistency (${winner.consistencyScore} vs ${loser.consistencyScore}).`;
      reasonZh = `${winner.playerName} 在产出（+${fptsDiff.toFixed(1)} fpts/场）和稳定性（${winner.consistencyScore} vs ${loser.consistencyScore}）上均占优势。`;
    } else {
      reason = `${winner.playerName} has a modest production edge (+${fptsDiff.toFixed(1)} FPTS/G). Stats are otherwise comparable.`;
      reasonZh = `${winner.playerName} 产出略胜一筹（+${fptsDiff.toFixed(1)} fpts/场），其他数据较为接近。`;
    }
  } else {
    // Very close — use consistency as tiebreaker
    confidence = 'low';
    const consistWinner = a.consistencyScore >= b.consistencyScore ? a : b;
    const consistLoser  = consistWinner.playerId === a.playerId ? b : a;
    if (a.consistencyScore !== b.consistencyScore) {
      reason = `Production is nearly identical (${Math.abs(fptsDiff).toFixed(1)} FPTS/G difference). ${consistWinner.playerName} has the edge in consistency (${consistWinner.consistencyScore} vs ${consistLoser.consistencyScore}).`;
      reasonZh = `两人产出几乎持平（差距 ${Math.abs(fptsDiff).toFixed(1)} fpts/场）。${consistWinner.playerName} 在稳定性上更胜一筹（${consistWinner.consistencyScore} vs ${consistLoser.consistencyScore}）。`;
      return {
        recommendedPlayerId: consistWinner.playerId,
        recommendedPlayerName: consistWinner.playerName,
        scenario: 'Points League',
        reason,
        reasonZh,
        confidence,
      };
    } else {
      reason = `These players are very evenly matched. ${winner.playerName} edges ahead slightly by production.`;
      reasonZh = `两人实力极为接近，${winner.playerName} 在产出上略微领先。`;
    }
  }

  return {
    recommendedPlayerId: winner.playerId,
    recommendedPlayerName: winner.playerName,
    scenario: 'Points League',
    reason,
    reasonZh,
    confidence,
  };
}

// ─────────────────────────────────────────────────────────────
// Scenario Recommendations
// ─────────────────────────────────────────────────────────────

type DimWeights = {
  fptsPerGame: number;
  consistencyScore: number;
  last5FptsAvg: number;
  playRate: number;
  ceiling: number;
  floor: number;
  next7Games: number;
};

const VIEW_WEIGHTS: Record<DecisionView, DimWeights> = {
  overview:   { fptsPerGame: 0.45, consistencyScore: 0.20, last5FptsAvg: 0.15, playRate: 0.15, ceiling: 0.05, floor: 0.00, next7Games: 0.00 },
  draft:      { fptsPerGame: 0.30, consistencyScore: 0.10, last5FptsAvg: 0.05, playRate: 0.15, ceiling: 0.40, floor: 0.00, next7Games: 0.00 },
  trade:      { fptsPerGame: 0.40, consistencyScore: 0.25, last5FptsAvg: 0.10, playRate: 0.20, ceiling: 0.05, floor: 0.00, next7Games: 0.00 },
  shortterm:  { fptsPerGame: 0.20, consistencyScore: 0.10, last5FptsAvg: 0.40, playRate: 0.15, ceiling: 0.05, floor: 0.00, next7Games: 0.10 },
  stability:  { fptsPerGame: 0.15, consistencyScore: 0.45, last5FptsAvg: 0.00, playRate: 0.20, ceiling: 0.00, floor: 0.20, next7Games: 0.00 },
};

const VIEW_CONTEXT: Record<DecisionView, { label: string; labelZh: string }> = {
  overview:  { label: 'overall in Points League',         labelZh: '积分联赛综合表现' },
  draft:     { label: 'as a draft pick (season upside)',  labelZh: '选秀价值（赛季上限）' },
  trade:     { label: 'for a trade (long-term value)',    labelZh: '交易价值（长期）' },
  shortterm: { label: 'short-term (next 1–2 weeks)',      labelZh: '短期价值（近1-2周）' },
  stability: { label: 'for consistent output',            labelZh: '稳定性与安全性' },
};

function scorePlayerForView(player: CompareStats, other: CompareStats, weights: DimWeights): number {
  const dims: (keyof DimWeights)[] = ['fptsPerGame', 'consistencyScore', 'last5FptsAvg', 'playRate', 'ceiling', 'floor', 'next7Games'];
  let total = 0;
  for (const dim of dims) {
    const w = weights[dim];
    if (w === 0) continue;
    const selfVal  = (player[dim as keyof CompareStats] as number) ?? 0;
    const otherVal = (other[dim as keyof CompareStats] as number) ?? 0;
    const maxVal = Math.max(selfVal, otherVal);
    const normalized = maxVal > 0 ? selfVal / maxVal : 0.5;
    total += normalized * w;
  }
  return total;
}

export function generateScenarioRecommendations(
  players: CompareStats[]
): Partial<Record<DecisionView, ScenarioRecommendation>> {
  if (players.length < 2) return {};
  const [a, b] = players;
  const result: Partial<Record<DecisionView, ScenarioRecommendation>> = {};

  for (const view of Object.keys(VIEW_WEIGHTS) as DecisionView[]) {
    const weights = VIEW_WEIGHTS[view];
    const scoreA = scorePlayerForView(a, b, weights);
    const scoreB = scorePlayerForView(b, a, weights);
    const winner = scoreA >= scoreB ? a : b;
    const loser  = winner.playerId === a.playerId ? b : a;
    const diff = Math.abs(scoreA - scoreB);
    const confidence: ScenarioRecommendation['confidence'] =
      diff > 0.12 ? 'high' : diff > 0.05 ? 'medium' : 'low';

    const ctx = VIEW_CONTEXT[view];
    const reasoning     = `${winner.playerName} is the stronger choice ${ctx.label}.`;
    const reasoningZh   = `在${ctx.labelZh}方面，${winner.playerName} 是更优选择。`;

    // Override with richer text for specific views
    let richEn = reasoning;
    let richZh = reasoningZh;

    if (view === 'draft') {
      richEn = `${winner.playerName} offers a higher ceiling (${winner.ceiling} FPTS) — a better bet for season-long upside in drafts.`;
      richZh = `${winner.playerName} 上限更高（${winner.ceiling} fpts），选秀中具备更大的赛季潜力。`;
    } else if (view === 'stability') {
      richEn = `${winner.playerName} is the safer pick with a consistency score of ${winner.consistencyScore} and floor of ${winner.floor} FPTS.`;
      richZh = `${winner.playerName} 更安全稳定，稳定性评分 ${winner.consistencyScore}，下限 ${winner.floor} fpts。`;
    } else if (view === 'shortterm') {
      const trend = winner.recentTrend === 'up' ? 'hot right now' : winner.recentTrend === 'down' ? 'the safer recent play' : 'consistent recently';
      richEn = `${winner.playerName} is ${trend} (last 5 avg: ${winner.last5FptsAvg} FPTS) — better short-term value.`;
      richZh = `${winner.playerName} 近期状态${winner.recentTrend === 'up' ? '上升' : winner.recentTrend === 'down' ? '较稳' : '平稳'}（近5场均 ${winner.last5FptsAvg} fpts），短期价值更高。`;
    } else if (view === 'trade') {
      richEn = `${winner.playerName} brings better long-term trade value: ${winner.fptsPerGame} FPTS/G with ${winner.gp} games played and ${(winner.playRate * 100).toFixed(0)}% availability.`;
      richZh = `${winner.playerName} 长期交易价值更高：场均 ${winner.fptsPerGame} fpts，${winner.gp} 场出场率 ${(winner.playRate * 100).toFixed(0)}%。`;
    }

    result[view] = {
      view,
      winnerId: winner.playerId,
      winnerName: winner.playerName,
      reasoning: richEn,
      reasoningZh: richZh,
      confidence,
    };

    void loser; // suppress unused var warning
  }

  return result;
}

// ─────────────────────────────────────────────────────────────
// Risk Notes
// ─────────────────────────────────────────────────────────────

export function generateRiskNotes(players: CompareStats[]): RiskNote[] {
  const notes: RiskNote[] = [];

  for (const player of players) {
    const playerNotes: RiskNote[] = [];

    if (player.injuryStatus) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'availability_risk',
        message: `Currently listed as ${player.injuryStatus}.`,
        messageZh: `当前伤情状态：${player.injuryStatus}。`,
        severity: 'warning',
      });
    }

    if (player.playRate < 0.75 && !player.injuryStatus) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'availability_risk',
        message: `Has played only ${(player.playRate * 100).toFixed(0)}% of available games — availability risk.`,
        messageZh: `仅参加了 ${(player.playRate * 100).toFixed(0)}% 的可用比赛，存在出场风险。`,
        severity: 'warning',
      });
    }

    if (player.gp < 10) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'small_sample',
        message: `Only ${player.gp} games in this window — treat stats with caution.`,
        messageZh: `当前时间窗口内仅有 ${player.gp} 场数据，请谨慎参考。`,
        severity: 'info',
      });
    }

    if (player.trendDelta > player.fptsPerGame * 0.15 && player.gp >= 5) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'hot_streak',
        message: `On a hot streak — last 5 games avg ${player.last5FptsAvg} FPTS vs season avg ${player.fptsPerGame}. May not sustain.`,
        messageZh: `近期状态火热，近5场均分 ${player.last5FptsAvg} vs 赛季均分 ${player.fptsPerGame}，注意能否持续。`,
        severity: 'info',
      });
    } else if (player.trendDelta < -player.fptsPerGame * 0.15 && player.gp >= 5) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'cold_streak',
        message: `Performance dipping — last 5 games avg ${player.last5FptsAvg} FPTS vs season avg ${player.fptsPerGame}.`,
        messageZh: `近期状态下滑，近5场均分 ${player.last5FptsAvg} vs 赛季均分 ${player.fptsPerGame}。`,
        severity: 'warning',
      });
    }

    if (player.consistencyScore < 45 && !playerNotes.find(n => n.type === 'small_sample')) {
      playerNotes.push({
        playerId: player.playerId,
        playerName: player.playerName,
        type: 'consistency_warning',
        message: `High variance player: floor ${player.floor} FPTS, ceiling ${player.ceiling} FPTS. Boom-or-bust risk.`,
        messageZh: `高波动球员：下限 ${player.floor} fpts，上限 ${player.ceiling} fpts，爆发或哑火风险并存。`,
        severity: 'info',
      });
    }

    // Keep max 3 notes per player
    notes.push(...playerNotes.slice(0, 3));
  }

  return notes;
}

// ─────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────

export function generateCompareResult(
  players: CompareStats[]
): Omit<CompareResult, 'players' | 'meta'> {
  return {
    quickDecision: generateQuickDecision(players),
    keyEdges: generateKeyEdges(players),
    scenarioRecommendations: generateScenarioRecommendations(players),
    riskNotes: generateRiskNotes(players),
  };
}
