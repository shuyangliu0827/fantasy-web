"use client";

import { useState, useEffect, useCallback } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { formatDateStr } from "@/lib/week-utils";
import { STRATEGY_PRESETS, type StrategyKey, RADAR_STATS, RADAR_MAX_VALUES } from "@/lib/compare-strategy-presets";
import { generateCompareResult, reweightPlayer, ESPN_DEFAULT_WEIGHTS } from "@/lib/compare-engine";
import type { PointsWeights } from "@/lib/compare-engine";
import type { CompareMode, CompareResult, DecisionView, Timeframe } from "@/lib/compare-types";

// Components
import ModeSwitch from "@/components/compare/ModeSwitch";
import TimeframeSelector from "@/components/compare/TimeframeSelector";
import PlayerSelectCard from "@/components/compare/PlayerSelectCard";
import PlayerSearchModal, { type PlayerSummary } from "@/components/compare/PlayerSearchModal";
import DecisionViewTabs from "@/components/compare/DecisionViewTabs";
import QuickDecisionSummary from "@/components/compare/QuickDecisionSummary";
import KeyEdgeSummary from "@/components/compare/KeyEdgeSummary";
import StatDimensionGroup, { type StatRow } from "@/components/compare/StatDimensionGroup";
import RiskNotes from "@/components/compare/RiskNotes";
import RadarChart from "@/components/compare/RadarChart";
import CategoryPreview from "@/components/compare/CategoryPreview";
import ScoringWeightsPanel from "@/components/compare/ScoringWeightsPanel";

import { FONT, COLORS, PLAYER_COLORS } from "@/components/compare/constants";

// ─────────────────────────────────────────────────────────────
// Stat dimension configurations
// ─────────────────────────────────────────────────────────────

function buildDimensions(result: CompareResult) {
  const [a, b] = result.players;

  const production: StatRow[] = [
    { key: "fptsPerGame",    label: "FPTS/G",   labelZh: "FPTS/场",  values: [a.fptsPerGame, b.fptsPerGame],   format: "decimal1", higherIsBetter: true,  max: 60  },
    { key: "ppg",            label: "PTS/G",    labelZh: "得分/场",    values: [a.ppg, b.ppg],                   format: "decimal1", higherIsBetter: true,  max: 40  },
    { key: "rpg",            label: "REB/G",    labelZh: "篮板/场",    values: [a.rpg, b.rpg],                   format: "decimal1", higherIsBetter: true,  max: 18  },
    { key: "apg",            label: "AST/G",    labelZh: "助攻/场",    values: [a.apg, b.apg],                   format: "decimal1", higherIsBetter: true,  max: 14  },
    { key: "spg",            label: "STL/G",    labelZh: "抢断/场",    values: [a.spg, b.spg],                   format: "decimal1", higherIsBetter: true,  max: 3   },
    { key: "bpg",            label: "BLK/G",    labelZh: "盖帽/场",    values: [a.bpg, b.bpg],                   format: "decimal1", higherIsBetter: true,  max: 4   },
    { key: "fg3mPg",         label: "3PM/G",    labelZh: "三分/场",    values: [a.fg3mPg, b.fg3mPg],             format: "decimal1", higherIsBetter: true,  max: 5   },
    { key: "tov",            label: "TOV/G",    labelZh: "失误/场",    values: [a.tov, b.tov],                   format: "decimal1", higherIsBetter: false, max: 6   },
    { key: "mpg",            label: "MIN/G",    labelZh: "上场时间",   values: [a.mpg, b.mpg],                   format: "decimal1", higherIsBetter: true,  max: 40  },
    { key: "gp",             label: "GP",       labelZh: "出场次数",   values: [a.gp, b.gp],                     format: "integer",  higherIsBetter: true         },
  ];

  const form: StatRow[] = [
    { key: "last5FptsAvg", label: "Last 5 FPTS/G",  labelZh: "近5场FPTS",  values: [a.last5FptsAvg, b.last5FptsAvg], format: "decimal1", higherIsBetter: true,  max: 60 },
    { key: "trendDelta",   label: "Trend Δ",         labelZh: "状态变化",      values: [a.trendDelta,   b.trendDelta],   format: "decimal1", higherIsBetter: true         },
  ];

  const stability: StatRow[] = [
    { key: "consistencyScore", label: "Consistency",  labelZh: "稳定性评分", values: [a.consistencyScore, b.consistencyScore], format: "score",    higherIsBetter: true,  max: 100 },
    { key: "stdDev",           label: "Std Dev",      labelZh: "标准差",     values: [a.stdDev, b.stdDev],                     format: "decimal1", higherIsBetter: false        },
    { key: "floor",            label: "Floor",        labelZh: "下限",       values: [a.floor, b.floor],                       format: "decimal1", higherIsBetter: true         },
    { key: "ceiling",          label: "Ceiling",      labelZh: "上限",       values: [a.ceiling, b.ceiling],                   format: "decimal1", higherIsBetter: true         },
    { key: "boomRate",         label: "Boom Rate",    labelZh: "爆发率",     values: [Math.round(a.boomRate * 100), Math.round(b.boomRate * 100)], format: "integer", higherIsBetter: true, max: 60 },
    { key: "bustRate",         label: "Bust Rate",    labelZh: "哑火率",     values: [Math.round(a.bustRate * 100), Math.round(b.bustRate * 100)], format: "integer", higherIsBetter: false, max: 60 },
  ];

  const availability: StatRow[] = [
    { key: "gamesPlayed",    label: "Games Played",     labelZh: "已出场",    values: [a.gamesPlayed, b.gamesPlayed],       format: "integer",  higherIsBetter: true  },
    { key: "gamesAvailable", label: "Games Available",  labelZh: "可出场",    values: [a.gamesAvailable, b.gamesAvailable], format: "integer",  higherIsBetter: true  },
    { key: "playRate",       label: "Play Rate",        labelZh: "出场率",    values: [Math.round(a.playRate * 100), Math.round(b.playRate * 100)], format: "integer", higherIsBetter: true, max: 100 },
    { key: "fgPct",          label: "FG%",              labelZh: "命中率",    values: [a.fgPct, b.fgPct],                   format: "decimal1", higherIsBetter: true,  max: 70 },
    { key: "ftPct",          label: "FT%",              labelZh: "罚球%",     values: [a.ftPct, b.ftPct],                   format: "decimal1", higherIsBetter: true,  max: 100 },
  ];

  const schedule: StatRow[] = [
    { key: "next7Games",     label: "Next 7-Day Games", labelZh: "未来7天比赛", values: [a.next7Games, b.next7Games], format: "integer", higherIsBetter: true, max: 5, isMocked: true },
  ];

  return { production, form, stability, availability, schedule };
}

// ─────────────────────────────────────────────────────────────
// Main Page Component
// ─────────────────────────────────────────────────────────────

export default function ComparePage() {
  const { t } = useLang();

  // Core state
  const [mode, setMode] = useState<CompareMode>("points");
  const [timeframe, setTimeframe] = useState<Timeframe>("season");
  const [view, setView] = useState<DecisionView>("overview");
  const [playerIds, setPlayerIds] = useState<[string | null, string | null]>([null, null]);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Search
  const [showSearch, setShowSearch] = useState<0 | 1 | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerSummary[]>([]);

  // Scoring weights — default to ESPN, user can customize
  const [scoringWeights, setScoringWeights] = useState<PointsWeights>({ ...ESPN_DEFAULT_WEIGHTS });

  // Legacy strategy panel (collapsed by default — preserved for backwards compat)
  const [showStrategyPanel, setShowStrategyPanel] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("balanced");
  const [showCustom, setShowCustom] = useState(false);
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({ ppg: 1, rpg: 1, apg: 1, spg: 1, bpg: 1, fg: 1, ft: 1, tov: 1 });

  const currentWeights = showCustom ? customWeights : STRATEGY_PRESETS[activeStrategy].weights;
  const highlightedAxes = Object.entries(currentWeights).filter(([, v]) => v > 1).map(([k]) => k);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load all players for search modal + seed defaults
  useEffect(() => {
    fetch("/api/nba-stats")
      .then(r => r.json())
      .then(data => {
        const players: PlayerSummary[] = (data.players ?? []).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          team: p.team,
          position: p.position,
          fptsAvg: p.fptsAvg ?? 0,
        }));
        setAllPlayers(players);
        // Seed top 2 players as defaults
        if (players.length >= 2) {
          setPlayerIds([players[0].id, players[1].id]);
        }
      })
      .catch(() => {
        // non-fatal — user can manually add players
      });
  }, []);

  // Fetch compare data whenever player IDs or timeframe changes
  const fetchCompareStats = useCallback(async (ids: [string, string], tf: Timeframe) => {
    setIsLoading(true);
    setError(null);
    try {
      const date = formatDateStr(new Date());
      const res = await fetch(`/api/compare-stats?players=${ids.join(",")}&timeframe=${tf}&date=${date}`);
      const data = await res.json();
      if (data.status === "error") {
        setError(data.message ?? t("加载失败，请重试", "Failed to load stats. Please try again."));
        setCompareResult(null);
      } else if (data.result) {
        setCompareResult(data.result);
      }
    } catch {
      setError(t("网络错误，请检查连接", "Network error. Please check your connection."));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (playerIds[0] && playerIds[1]) {
      fetchCompareStats([playerIds[0], playerIds[1]], timeframe);
    }
  }, [playerIds, timeframe, fetchCompareStats]);

  // Apply custom scoring weights + re-run engine (client-side, no fetch needed)
  const activeResult = compareResult
    ? (() => {
        const reweighted = compareResult.players.map(p => reweightPlayer(p, scoringWeights));
        return { ...compareResult, players: reweighted, ...generateCompareResult(reweighted) };
      })()
    : null;

  const handleSelectPlayer = (slot: 0 | 1, id: string) => {
    setPlayerIds(prev => {
      const next: [string | null, string | null] = [...prev] as [string | null, string | null];
      next[slot] = id;
      return next;
    });
    setShowSearch(null);
  };

  const handleRemovePlayer = (slot: 0 | 1) => {
    setPlayerIds(prev => {
      const next: [string | null, string | null] = [...prev] as [string | null, string | null];
      next[slot] = null;
      return next;
    });
    setCompareResult(null);
  };

  const playerA = activeResult?.players[0] ?? null;
  const playerB = activeResult?.players[1] ?? null;

  // Scenario text for current view
  const scenarioRec = activeResult?.scenarioRecommendations[view];

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: FONT }}>
      <LightHeader activeHref="/compare" />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "20px 12px 40px" : "32px 20px 60px" }}>

        {/* ── Page Header ── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: COLORS.textPrimary, margin: "0 0 6px 0" }}>
            {t("球员对比", "Player Comparison")}
          </h1>
          <p style={{ fontSize: 14, color: COLORS.textSecondary, margin: 0 }}>
            {t("H2H 积分制决策工具 — 快速对比、场景推荐、多时间段分析", "H2H Points decision tool — compare, analyze, and decide")}
          </p>
        </div>

        {/* ── Mode Switch ── */}
        <ModeSwitch mode={mode} onChange={setMode} />

        {/* ── Player Selection Row ── */}
        <div style={{ display: "flex", gap: isMobile ? 8 : 12, marginBottom: 20, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <PlayerSelectCard
              player={activeResult?.players[0] ?? null}
              color={PLAYER_COLORS[0]}
              onRemove={() => handleRemovePlayer(0)}
              onAddClick={() => setShowSearch(0)}
              isMobile={isMobile}
              isLoading={isLoading}
            />
          </div>

          {/* VS divider */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: isMobile ? 28 : 40,
            minHeight: 120,
            fontWeight: 800,
            fontSize: isMobile ? 13 : 16,
            color: COLORS.textMuted,
            flexShrink: 0,
          }}>
            VS
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <PlayerSelectCard
              player={activeResult?.players[1] ?? null}
              color={PLAYER_COLORS[1]}
              onRemove={() => handleRemovePlayer(1)}
              onAddClick={() => setShowSearch(1)}
              isMobile={isMobile}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* ── Scoring Weights ── */}
        <ScoringWeightsPanel weights={scoringWeights} onChange={setScoringWeights} isMobile={isMobile} />

        {/* ── Timeframe Selector ── */}
        <TimeframeSelector timeframe={timeframe} onChange={setTimeframe} isLoading={isLoading} />

        {/* ── Loading indicator ── */}
        {isLoading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: COLORS.textMuted }}>
            <div style={{ display: "inline-block", width: 28, height: 28, border: "3px solid #e5e7eb", borderTopColor: COLORS.navy, borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
            <div style={{ marginTop: 12, fontSize: 14 }}>{t("加载对比数据中...", "Loading comparison data...")}</div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* ── Error banner ── */}
        {error && !isLoading && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12,
            padding: "14px 18px", marginBottom: 20, color: "#991b1b", fontSize: 14,
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <span>⚠️</span>
            <span>{error}</span>
            <button
              onClick={() => playerIds[0] && playerIds[1] && fetchCompareStats([playerIds[0], playerIds[1]], timeframe)}
              style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: "#991b1b", background: "none", border: "1px solid #fca5a5", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: FONT }}
            >
              {t("重试", "Retry")}
            </button>
          </div>
        )}

        {/* ══ Points Mode Main Content ══ */}
        {mode === "points" && activeResult && !isLoading && playerA && playerB && (
          <>
            {/* Decision View Tabs */}
            <DecisionViewTabs
              view={view}
              onChange={setView}
              recommendations={activeResult.scenarioRecommendations}
            />

            {/* Quick Decision Summary */}
            <QuickDecisionSummary result={activeResult} isMobile={isMobile} />

            {/* Key Edges */}
            <KeyEdgeSummary
              edges={activeResult.keyEdges}
              playerAId={playerA.playerId}
              isMobile={isMobile}
            />

            {/* Scenario Recommendation text */}
            {scenarioRec && (
              <div style={{
                background: COLORS.card,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `4px solid ${COLORS.navy}`,
                borderRadius: "0 12px 12px 0",
                padding: "14px 18px",
                marginBottom: 20,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.navy, letterSpacing: "0.5px", marginBottom: 6 }}>
                  {t("场景建议", "SCENARIO INSIGHT")} ·{" "}
                  {({ overview: t("总览", "Overview"), draft: t("选秀", "Draft"), trade: t("交易", "Trade"), shortterm: t("短期", "Short-Term"), stability: t("稳定性", "Stability") } as Record<DecisionView, string>)[view]}
                </div>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.textSecondary, lineHeight: 1.6, fontFamily: FONT }}>
                  {t(scenarioRec.reasoningZh, scenarioRec.reasoning)}
                </p>
                <div style={{ marginTop: 8, display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: scenarioRec.confidence === "high" ? COLORS.greenLight : scenarioRec.confidence === "medium" ? COLORS.amberLight : COLORS.bg,
                    color: scenarioRec.confidence === "high" ? "#166534" : scenarioRec.confidence === "medium" ? "#92400e" : COLORS.textMuted,
                    padding: "2px 8px", borderRadius: 999,
                  }}>
                    {t(
                      scenarioRec.confidence === "high" ? "高置信度" : scenarioRec.confidence === "medium" ? "中置信度" : "低置信度",
                      scenarioRec.confidence === "high" ? "High Confidence" : scenarioRec.confidence === "medium" ? "Moderate" : "Close Call"
                    )}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.navy }}>→ {scenarioRec.winnerName}</span>
                </div>
              </div>
            )}

            {/* Stat Dimension Groups */}
            {(() => {
              const dims = buildDimensions(activeResult);
              return (
                <>
                  <StatDimensionGroup title="Production" titleZh="产出" icon="⚡" stats={dims.production} players={[playerA, playerB]} isMobile={isMobile} defaultExpanded />
                  <StatDimensionGroup title="Form" titleZh="近期状态" icon="📈" stats={dims.form} players={[playerA, playerB]} isMobile={isMobile} defaultExpanded />
                  <StatDimensionGroup title="Stability" titleZh="稳定性" icon="🛡" stats={dims.stability} players={[playerA, playerB]} isMobile={isMobile} defaultExpanded={!isMobile} />
                  <StatDimensionGroup title="Availability" titleZh="出场率" icon="🏥" stats={dims.availability} players={[playerA, playerB]} isMobile={isMobile} defaultExpanded={!isMobile} />
                  <StatDimensionGroup title="Schedule (Est.)" titleZh="赛程（预估）" icon="📅" stats={dims.schedule} players={[playerA, playerB]} isMobile={isMobile} defaultExpanded={false} />
                </>
              );
            })()}

            {/* Risk Notes */}
            <RiskNotes notes={activeResult.riskNotes} playerAId={playerA.playerId} />

            {/* Radar Chart — secondary visual */}
            <div style={{
              background: COLORS.card,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 12,
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, margin: 0 }}>
                  {t("能力雷达图", "Stats Radar")}
                </h3>
                <span style={{ fontSize: 11, color: COLORS.textMuted }}>{t("辅助参考", "Secondary visual")}</span>
              </div>
              <p style={{ fontSize: 12, color: COLORS.textMuted, margin: "0 0 16px 0" }}>
                {t("基于赛季平均数据 — 请以上方决策摘要为主要参考", "Based on season averages. See Decision Summary above for primary analysis.")}
              </p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
                <RadarChart
                  players={activeResult.players.slice(0, 2).map((p, i) => ({
                    id: p.playerId,
                    name: p.playerName,
                    color: PLAYER_COLORS[i],
                    stats: {
                      ppg: p.ppg, rpg: p.rpg, apg: p.apg,
                      spg: p.spg, bpg: p.bpg,
                      fg: p.fgPct, ft: p.ftPct, tov: p.tov,
                    },
                  }))}
                  axes={RADAR_STATS as unknown as string[]}
                  maxValues={RADAR_MAX_VALUES}
                  axisLabels={{
                    ppg: { zh: "得分", en: "PTS" },
                    rpg: { zh: "篮板", en: "REB" },
                    apg: { zh: "助攻", en: "AST" },
                    spg: { zh: "抢断", en: "STL" },
                    bpg: { zh: "盖帽", en: "BLK" },
                    fg:  { zh: "命中率", en: "FG%" },
                    ft:  { zh: "罚球", en: "FT%" },
                    tov: { zh: "失误", en: "TOV" },
                  }}
                  highlightedAxes={highlightedAxes}
                  size={isMobile ? 280 : 320}
                />
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
                  {activeResult.players.slice(0, 2).map((p, i) => (
                    <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 3, background: PLAYER_COLORS[i], display: "inline-block" }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.textSecondary }}>{p.playerName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Legacy Strategy Panel (collapsed by default) ── */}
            <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 12 }}>
              <button
                onClick={() => setShowStrategyPanel(s => !s)}
                style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", fontFamily: FONT }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🏷</span>
                  <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>{t("球员能力侧重 / 分析策略", "Player Profile & Strategy")}</span>
                  <span style={{ fontSize: 11, color: COLORS.textMuted, fontWeight: 400 }}>{t("（影响雷达图显示）", "(affects radar chart)")}</span>
                </div>
                <span style={{ color: COLORS.textMuted, fontSize: 14, transform: showStrategyPanel ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
              </button>

              {showStrategyPanel && (
                <div style={{ padding: "4px 20px 20px" }}>
                  <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                    <button onClick={() => setShowCustom(false)} style={{ padding: "6px 14px", borderRadius: 8, background: !showCustom ? COLORS.navy : COLORS.bg, color: !showCustom ? "#fff" : COLORS.textSecondary, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>{t("预设", "Presets")}</button>
                    <button onClick={() => setShowCustom(true)} style={{ padding: "6px 14px", borderRadius: 8, background: showCustom ? COLORS.navy : COLORS.bg, color: showCustom ? "#fff" : COLORS.textSecondary, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: FONT }}>{t("自定义权重", "Custom")}</button>
                  </div>

                  {!showCustom ? (
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
                      {(Object.entries(STRATEGY_PRESETS) as [StrategyKey, typeof STRATEGY_PRESETS[StrategyKey]][]).map(([key, preset]) => (
                        <button
                          key={key}
                          onClick={() => setActiveStrategy(key)}
                          style={{
                            padding: "10px 12px", borderRadius: 10, textAlign: "left", fontFamily: FONT,
                            background: activeStrategy === key ? COLORS.navy : COLORS.bg,
                            color: activeStrategy === key ? "#fff" : COLORS.textSecondary,
                            border: activeStrategy === key ? `2px solid ${COLORS.navy}` : `2px solid ${COLORS.border}`,
                            cursor: "pointer", transition: "all 0.15s",
                          }}
                        >
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{t(preset.name, preset.nameEn)}</div>
                          {key.startsWith("punt_") && <div style={{ fontSize: 10, opacity: 0.75, marginTop: 2 }}>Punt</div>}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
                      {[
                        { key: "ppg", label: t("得分 (PPG)", "Points (PPG)") },
                        { key: "rpg", label: t("篮板 (RPG)", "Rebounds (RPG)") },
                        { key: "apg", label: t("助攻 (APG)", "Assists (APG)") },
                        { key: "spg", label: t("抢断 (SPG)", "Steals (SPG)") },
                        { key: "bpg", label: t("盖帽 (BPG)", "Blocks (BPG)") },
                        { key: "fg",  label: t("命中率 (FG%)", "Field Goal (FG%)") },
                        { key: "ft",  label: t("罚球 (FT%)", "Free Throw (FT%)") },
                        { key: "tov", label: t("失误 (TOV)", "Turnovers (TOV)") },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textSecondary }}>{label}</span>
                            <span style={{ fontSize: 12, fontWeight: 700, color: customWeights[key] === 0 ? COLORS.red : customWeights[key] > 1 ? COLORS.navy : COLORS.textMuted }}>
                              {customWeights[key] === 0 ? "OFF" : `×${customWeights[key]}`}
                            </span>
                          </div>
                          <input type="range" min="0" max="2" step="0.5" value={customWeights[key]} onChange={e => setCustomWeights(w => ({ ...w, [key]: parseFloat(e.target.value) }))} style={{ width: "100%", accentColor: COLORS.navy }} />
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: COLORS.textMuted }}>
                            <span>{t("忽略", "Off")}</span><span>{t("正常", "Normal")}</span><span>{t("重要", "High")}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {/* ══ Categories Mode ══ */}
        {mode === "categories" && activeResult && (
          <CategoryPreview players={activeResult.players} isMobile={isMobile} />
        )}

        {/* ── Empty state when no players selected ── */}
        {!isLoading && !activeResult && (!playerIds[0] || !playerIds[1]) && (
          <div style={{
            textAlign: "center", padding: isMobile ? "40px 20px" : "60px 40px",
            color: COLORS.textMuted, background: COLORS.card, borderRadius: 16,
            border: `1px dashed ${COLORS.border}`,
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.textSecondary, margin: "0 0 8px 0" }}>
              {t("请选择两名球员进行对比", "Select two players to compare")}
            </h3>
            <p style={{ fontSize: 14, margin: 0 }}>
              {t("点击上方卡片添加球员", "Click the cards above to add players")}
            </p>
          </div>
        )}
      </main>

      {/* ── Player Search Modal ── */}
      <PlayerSearchModal
        isOpen={showSearch !== null}
        onClose={() => setShowSearch(null)}
        onSelect={(id, _name) => showSearch !== null && handleSelectPlayer(showSearch, id)}
        excludeIds={playerIds.filter(Boolean) as string[]}
        allPlayers={allPlayers}
      />
    </div>
  );
}
