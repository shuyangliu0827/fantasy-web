"use client";

import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { getPlayers, Player } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const COLORS = ["#1e3a8a", "#f59e0b", "#22c55e", "#ef4444"];
const TEXT_ON_COLOR = ["#fff", "#000", "#fff", "#fff"];

// 雷达图组件
function RadarChart({ players, stats, weights }: { players: Player[], stats: string[], weights: Record<string, number> }) {
  const { t } = useLang();
  const size = 320;
  const center = size / 2;
  const radius = 130;
  const levels = 5;

  const statLabels: Record<string, { zh: string; en: string }> = {
    ppg: { zh: "得分", en: "PTS" },
    rpg: { zh: "篮板", en: "REB" },
    apg: { zh: "助攻", en: "AST" },
    spg: { zh: "抢断", en: "STL" },
    bpg: { zh: "盖帽", en: "BLK" },
    fg: { zh: "命中率", en: "FG%" },
    ft: { zh: "罚球", en: "FT%" },
    tov: { zh: "失误", en: "TOV" },
  };

  const maxValues: Record<string, number> = {
    ppg: 35, rpg: 15, apg: 12, spg: 2.5, bpg: 4, fg: 70, ft: 95, tov: 5,
  };

  const angleStep = (2 * Math.PI) / stats.length;

  const getPoint = (value: number, maxValue: number, index: number, statKey: string) => {
    let normalizedValue = statKey === "tov" ? 1 - (value / maxValue) : value / maxValue;
    normalizedValue = Math.min(Math.max(normalizedValue, 0), 1);
    const weight = weights[statKey] || 1;
    const visualRadius = radius * (0.7 + weight * 0.3);
    const angle = index * angleStep - Math.PI / 2;
    const r = normalizedValue * visualRadius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const r = (radius / levels) * level;
    const points = stats.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    gridLines.push(<polygon key={level} points={points} fill="none" stroke="#e5e7eb" strokeWidth="1" opacity={0.7} />);
  }

  const axisLines = stats.map((stat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const weight = weights[stat] || 1;
    return (
      <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)}
        stroke={weight > 1 ? "#1e3a8a" : "#d1d5db"}
        strokeWidth={weight > 1 ? 2 : 1}
        opacity={weight > 1 ? 0.8 : 0.5}
      />
    );
  });

  const labels = stats.map((stat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const labelRadius = radius + 30;
    const weight = weights[stat] || 1;
    return (
      <text key={stat} x={center + labelRadius * Math.cos(angle)} y={center + labelRadius * Math.sin(angle)}
        textAnchor="middle" dominantBaseline="middle"
        fill={weight > 1 ? "#1e3a8a" : "#6b7280"}
        fontSize="12" fontWeight={weight > 1 ? 700 : 500}>
        {t(statLabels[stat]?.zh || stat, statLabels[stat]?.en || stat)}
        {weight > 1 && <tspan fontSize="10"> ×{weight}</tspan>}
      </text>
    );
  });

  const playerPolygons = players.map((player, playerIndex) => {
    const color = COLORS[playerIndex] || "#64748b";
    const points = stats.map((stat, i) => {
      const value = player[stat as keyof Player] as number || 0;
      const point = getPoint(value, maxValues[stat], i, stat);
      return `${point.x},${point.y}`;
    }).join(" ");

    return (
      <g key={player.id}>
        <polygon points={points} fill={color} fillOpacity={0.15} stroke={color} strokeWidth="2.5" />
        {stats.map((stat, i) => {
          const value = player[stat as keyof Player] as number || 0;
          const point = getPoint(value, maxValues[stat], i, stat);
          return <circle key={`${player.id}-${stat}`} cx={point.x} cy={point.y} r="5" fill={color} />;
        })}
      </g>
    );
  });

  return (
    <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, display: "block" }}>
      {gridLines}
      {axisLines}
      {playerPolygons}
      {labels}
    </svg>
  );
}

// 预设策略配置
const STRATEGY_PRESETS = {
  balanced: { name: "均衡", nameEn: "Balanced", weights: { ppg: 1, rpg: 1, apg: 1, spg: 1, bpg: 1, fg: 1, ft: 1, tov: 1 } },
  scoring: { name: "得分手", nameEn: "Scoring Focus", weights: { ppg: 2, rpg: 0.5, apg: 1, spg: 0.5, bpg: 0.5, fg: 1, ft: 1.5, tov: 0.5 } },
  assists: { name: "组织核心", nameEn: "Playmaker", weights: { ppg: 1, rpg: 0.5, apg: 2, spg: 1, bpg: 0.5, fg: 1, ft: 1, tov: 1.5 } },
  rebounds: { name: "篮板怪兽", nameEn: "Rebounder", weights: { ppg: 0.5, rpg: 2, apg: 0.5, spg: 0.5, bpg: 1.5, fg: 1, ft: 0.5, tov: 0.5 } },
  defense: { name: "防守悍将", nameEn: "Defensive", weights: { ppg: 0.5, rpg: 1, apg: 0.5, spg: 2, bpg: 2, fg: 0.5, ft: 0.5, tov: 0.5 } },
  efficiency: { name: "效率优先", nameEn: "Efficiency", weights: { ppg: 1, rpg: 0.5, apg: 0.5, spg: 0.5, bpg: 0.5, fg: 2, ft: 2, tov: 2 } },
  punt_ft: { name: "放弃罚球", nameEn: "Punt FT%", weights: { ppg: 1.2, rpg: 1.2, apg: 1.2, spg: 1.2, bpg: 1.2, fg: 1.5, ft: 0, tov: 1 } },
  punt_fg: { name: "放弃命中率", nameEn: "Punt FG%", weights: { ppg: 1.2, rpg: 1, apg: 1.5, spg: 1.2, bpg: 1, fg: 0, ft: 1.5, tov: 1.2 } },
  punt_to: { name: "放弃失误", nameEn: "Punt TO", weights: { ppg: 1.5, rpg: 1, apg: 1.5, spg: 1, bpg: 1, fg: 1, ft: 1, tov: 0 } },
};

type StrategyKey = keyof typeof STRATEGY_PRESETS;

export default function ComparePage() {
  const { t } = useLang();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<StrategyKey>("balanced");
  const [customWeights, setCustomWeights] = useState<Record<string, number>>({ ppg: 1, rpg: 1, apg: 1, spg: 1, bpg: 1, fg: 1, ft: 1, tov: 1 });
  const [showCustom, setShowCustom] = useState(false);

  const radarStats = ["ppg", "rpg", "apg", "spg", "bpg", "fg", "ft", "tov"];

  const currentWeights = showCustom ? customWeights : STRATEGY_PRESETS[activeStrategy].weights;

  useEffect(() => {
    const players = getPlayers();
    setAllPlayers(players);
    if (players.length >= 2) {
      setSelectedPlayers([players[0], players[1]]);
    }
  }, []);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filteredPlayers = allPlayers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.team.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 10);

  const addPlayer = (player: Player) => {
    if (selectedPlayers.length < 4 && !selectedPlayers.find(p => p.id === player.id)) {
      setSelectedPlayers([...selectedPlayers, player]);
    }
    setShowSearch(false);
    setSearchQuery("");
  };

  const removePlayer = (playerId: string) => {
    setSelectedPlayers(selectedPlayers.filter(p => p.id !== playerId));
  };

  const calculateWeightedScore = (player: Player) => {
    const maxValues: Record<string, number> = { ppg: 35, rpg: 15, apg: 12, spg: 2.5, bpg: 4, fg: 70, ft: 95, tov: 5 };
    let totalScore = 0;
    let totalWeight = 0;
    Object.entries(currentWeights).forEach(([stat, weight]) => {
      if (weight === 0) return;
      const value = player[stat as keyof Player] as number || 0;
      let normalized = stat === "tov" ? 1 - (value / maxValues[stat]) : value / maxValues[stat];
      normalized = Math.min(Math.max(normalized, 0), 1);
      totalScore += normalized * weight * 100;
      totalWeight += weight;
    });
    return totalWeight > 0 ? totalScore / totalWeight : 0;
  };

  const calculateCategoryScores = (player: Player) => {
    const maxValues: Record<string, number> = { ppg: 35, rpg: 15, apg: 12, spg: 2.5, bpg: 4, fg: 70, ft: 95, tov: 5 };
    return {
      scoring: (player.ppg / maxValues.ppg) * 100 * (currentWeights.ppg || 1),
      rebounding: (player.rpg / maxValues.rpg) * 100 * (currentWeights.rpg || 1),
      playmaking: (player.apg / maxValues.apg) * 100 * (currentWeights.apg || 1),
      steals: (player.spg / maxValues.spg) * 100 * (currentWeights.spg || 1),
      blocks: (player.bpg / maxValues.bpg) * 100 * (currentWeights.bpg || 1),
      fieldGoal: (player.fg / maxValues.fg) * 100 * (currentWeights.fg || 1),
      freeThrow: (player.ft / maxValues.ft) * 100 * (currentWeights.ft || 1),
      turnovers: (1 - player.tov / maxValues.tov) * 100 * (currentWeights.tov || 1),
    };
  };

  const getPlayerType = (player: Player) => {
    const scores = calculateCategoryScores(player);
    const types = [];
    if (scores.scoring > 70) types.push({ label: t("得分手", "Scorer"), color: "#ef4444" });
    if (scores.rebounding > 70) types.push({ label: t("篮板手", "Rebounder"), color: "#22c55e" });
    if (scores.playmaking > 70) types.push({ label: t("组织者", "Facilitator"), color: "#3b82f6" });
    if (scores.steals > 60 && scores.blocks > 60) types.push({ label: t("防守者", "Defender"), color: "#8b5cf6" });
    if (scores.fieldGoal > 80 && scores.freeThrow > 80) types.push({ label: t("高效率", "Efficient"), color: "#f59e0b" });
    return types.length > 0 ? types : [{ label: t("全能型", "All-Around"), color: "#64748b" }];
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/compare" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "20px 12px" : "32px 16px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px 0" }}>
            {t("球员对比", "Player Comparison")}
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            {t("高级数据分析，自定义权重，Punt 策略模拟", "Advanced analytics with custom weights and Punt strategy simulation")}
          </p>
        </div>

        {/* Selected Players */}
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          {selectedPlayers.map((player, index) => {
            const score = calculateWeightedScore(player);
            const types = getPlayerType(player);
            const color = COLORS[index] || "#64748b";
            const textOnColor = TEXT_ON_COLOR[index] || "#fff";
            return (
              <div key={player.id} style={{ background: "#fff", border: `2px solid ${color}`, borderRadius: 16, padding: 20, width: isMobile ? "100%" : 220, position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                <button onClick={() => removePlayer(player.id)} style={{ position: "absolute", top: 12, right: 12, background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>✕</button>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: textOnColor, fontSize: 14, flexShrink: 0 }}>
                    {player.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 28, fontWeight: 700, color: color }}>{score.toFixed(0)}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{t("综合评分", "Score")}</div>
                  </div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 4px 0" }}>{player.name}</h3>
                <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 12px 0" }}>{player.team} · {player.position}</p>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {types.map((type, i) => (
                    <span key={i} style={{ background: type.color + "18", color: type.color, padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{type.label}</span>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#111827" }}>{player.ppg}</span><span style={{ fontSize: 10, color: "#9ca3af" }}>PPG</span></div>
                  <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#111827" }}>{player.rpg}</span><span style={{ fontSize: 10, color: "#9ca3af" }}>RPG</span></div>
                  <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 16, fontWeight: 700, color: "#111827" }}>{player.apg}</span><span style={{ fontSize: 10, color: "#9ca3af" }}>APG</span></div>
                </div>
              </div>
            );
          })}

          {selectedPlayers.length < 4 && (
            <div onClick={() => setShowSearch(true)} style={{ background: "#fff", border: "2px dashed #d1d5db", borderRadius: 16, padding: 20, width: isMobile ? "100%" : 220, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#9ca3af", minHeight: 200, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 12, color: "#9ca3af" }}>+</div>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t("添加球员", "Add Player")}</span>
            </div>
          )}
        </div>

        {/* Strategy Selection */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>{t("分析策略", "Analysis Strategy")}</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCustom(false)} style={{ padding: "7px 14px", borderRadius: 8, background: !showCustom ? "#1e3a8a" : "#f3f4f6", color: !showCustom ? "#fff" : "#374151", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                {t("预设策略", "Presets")}
              </button>
              <button onClick={() => setShowCustom(true)} style={{ padding: "7px 14px", borderRadius: 8, background: showCustom ? "#1e3a8a" : "#f3f4f6", color: showCustom ? "#fff" : "#374151", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: FONT }}>
                {t("自定义权重", "Custom")}
              </button>
            </div>
          </div>

          {!showCustom ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
              {(Object.entries(STRATEGY_PRESETS) as [StrategyKey, typeof STRATEGY_PRESETS[StrategyKey]][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setActiveStrategy(key)}
                  style={{
                    padding: "12px 16px",
                    borderRadius: 10,
                    background: activeStrategy === key ? "#1e3a8a" : "#f9fafb",
                    color: activeStrategy === key ? "#fff" : "#374151",
                    border: activeStrategy === key ? "2px solid #1e3a8a" : "2px solid #e5e7eb",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: FONT,
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{t(preset.name, preset.nameEn)}</div>
                  {key.startsWith("punt_") && (
                    <div style={{ fontSize: 11, opacity: 0.75, marginTop: 4 }}>Punt {t("策略", "Strategy")}</div>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
              {[
                { key: "ppg", label: t("得分 (PPG)", "Points (PPG)") },
                { key: "rpg", label: t("篮板 (RPG)", "Rebounds (RPG)") },
                { key: "apg", label: t("助攻 (APG)", "Assists (APG)") },
                { key: "spg", label: t("抢断 (SPG)", "Steals (SPG)") },
                { key: "bpg", label: t("盖帽 (BPG)", "Blocks (BPG)") },
                { key: "fg", label: t("命中率 (FG%)", "Field Goal (FG%)") },
                { key: "ft", label: t("罚球 (FT%)", "Free Throw (FT%)") },
                { key: "tov", label: t("失误 (TOV)", "Turnovers (TOV)") },
              ].map(({ key, label }) => (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: customWeights[key] === 0 ? "#ef4444" : customWeights[key] > 1 ? "#1e3a8a" : "#9ca3af" }}>
                      {customWeights[key] === 0 ? "OFF" : `×${customWeights[key]}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.5"
                    value={customWeights[key]}
                    onChange={(e) => setCustomWeights({ ...customWeights, [key]: parseFloat(e.target.value) })}
                    style={{ width: "100%", accentColor: "#1e3a8a" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#9ca3af" }}>
                    <span>{t("忽略", "Off")}</span>
                    <span>{t("正常", "Normal")}</span>
                    <span>{t("重要", "High")}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Search Modal */}
        {showSearch && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowSearch(false)}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, width: "90%", maxWidth: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: "#111827" }}>{t("搜索球员", "Search Player")}</h3>
              <input
                type="text"
                style={{ width: "100%", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, padding: "12px 16px", color: "#111827", fontSize: 15, marginBottom: 16, outline: "none", fontFamily: FONT, boxSizing: "border-box" }}
                placeholder={t("输入球员名字或球队...", "Enter player name or team...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
                {filteredPlayers.map(player => {
                  const score = calculateWeightedScore(player);
                  return (
                    <div key={player.id} onClick={() => addPlayer(player)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 8, cursor: "pointer", transition: "background 0.1s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#1e3a8a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#fff", fontSize: 12, flexShrink: 0 }}>{player.name.split(' ').map(n => n[0]).join('')}</div>
                      <div style={{ flex: 1 }}>
                        <span style={{ display: "block", fontWeight: 600, color: "#111827", fontSize: 14 }}>{player.name}</span>
                        <span style={{ fontSize: 13, color: "#6b7280" }}>{player.team} · {player.position}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ display: "block", fontWeight: 700, color: "#1e3a8a", fontSize: 15 }}>{score.toFixed(0)}</span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>{t("评分", "Score")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => setShowSearch(false)} style={{ width: "100%", padding: 12, background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, color: "#374151", cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: FONT }}>{t("取消", "Cancel")}</button>
            </div>
          </div>
        )}

        {selectedPlayers.length >= 2 && (
          <>
            {/* Radar Chart */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 6px 0" }}>{t("能力雷达图", "Stats Radar")}</h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px 0" }}>{t("高亮轴表示当前策略重点关注的数据类别", "Highlighted axes indicate stats emphasized by current strategy")}</p>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                <RadarChart players={selectedPlayers} stats={radarStats} weights={currentWeights} />
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
                  {selectedPlayers.map((player, index) => {
                    const color = COLORS[index] || "#64748b";
                    return (
                      <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 16, height: 16, borderRadius: 4, background: color, display: "inline-block" }} />
                        <span style={{ fontWeight: 500, color: "#374151", fontSize: 14 }}>{player.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: color }}>({calculateWeightedScore(player).toFixed(0)})</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Category Breakdown */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, marginBottom: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 20px 0" }}>{t("类别详细分析", "Category Breakdown")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
                {[
                  { key: "ppg", label: t("得分", "Scoring"), max: 35 },
                  { key: "rpg", label: t("篮板", "Rebounds"), max: 15 },
                  { key: "apg", label: t("助攻", "Assists"), max: 12 },
                  { key: "spg", label: t("抢断", "Steals"), max: 2.5 },
                  { key: "bpg", label: t("盖帽", "Blocks"), max: 4 },
                  { key: "fg", label: t("命中率", "FG%"), max: 70 },
                  { key: "ft", label: t("罚球", "FT%"), max: 95 },
                  { key: "tov", label: t("失误(越低越好)", "Turnovers (lower=better)"), max: 5, reverse: true },
                ].map(({ key, label, max, reverse }) => {
                  const weight = currentWeights[key as keyof typeof currentWeights] || 1;
                  const isDisabled = weight === 0;
                  return (
                    <div key={key} style={{ opacity: isDisabled ? 0.4 : 1 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#374151" }}>{label}</span>
                        {weight > 1 && <span style={{ fontSize: 11, background: "#1e3a8a", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>×{weight} {t("权重", "weight")}</span>}
                        {isDisabled && <span style={{ fontSize: 11, background: "#ef4444", color: "#fff", padding: "2px 6px", borderRadius: 4 }}>PUNT</span>}
                      </div>
                      {selectedPlayers.map((player, index) => {
                        const value = player[key as keyof Player] as number;
                        const percentage = reverse ? ((1 - value / max) * 100) : (value / max * 100);
                        const color = COLORS[index] || "#64748b";
                        return (
                          <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ width: 80, fontSize: 12, color: "#6b7280" }}>{player.name.split(' ').pop()}</span>
                            <div style={{ flex: 1, height: 20, background: "#f3f4f6", borderRadius: 10, overflow: "hidden", position: "relative" }}>
                              <div style={{ width: `${Math.min(percentage, 100)}%`, height: "100%", background: color, borderRadius: 10, transition: "width 0.5s ease" }} />
                            </div>
                            <span style={{ width: 50, textAlign: "right", fontSize: 13, fontWeight: 600, color: "#111827" }}>{value}{key === "fg" || key === "ft" ? "%" : ""}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Final Verdict */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 6px 0" }}>{t("综合评估", "Final Verdict")}</h2>
              <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 24px 0" }}>
                {t(`基于「${showCustom ? "自定义" : STRATEGY_PRESETS[activeStrategy].name}」策略的评分`,
                  `Scores based on "${showCustom ? "Custom" : STRATEGY_PRESETS[activeStrategy].nameEn}" strategy`)}
              </p>

              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
                {selectedPlayers.sort((a, b) => calculateWeightedScore(b) - calculateWeightedScore(a)).map((player, index) => {
                  const score = calculateWeightedScore(player);
                  const cats = calculateCategoryScores(player);
                  const rank = index + 1;
                  const barColor = rank === 1 ? "#1e3a8a" : "#9ca3af";

                  return (
                    <div key={player.id} style={{ background: "#f9fafb", border: `2px solid ${rank === 1 ? "#1e3a8a" : "#e5e7eb"}`, borderRadius: 16, padding: 24, position: "relative" }}>
                      {rank === 1 && (
                        <div style={{ position: "absolute", top: -12, left: 20, background: "#1e3a8a", color: "#fff", padding: "4px 12px", borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                          👑 {t("推荐", "RECOMMENDED")}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, marginTop: rank === 1 ? 8 : 0 }}>
                        <div>
                          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{player.name}</div>
                          <div style={{ fontSize: 13, color: "#6b7280" }}>{player.team} · {player.position}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 36, fontWeight: 700, color: rank === 1 ? "#1e3a8a" : "#374151" }}>{score.toFixed(0)}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{t("综合评分", "Overall")}</div>
                        </div>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                        {[
                          { key: "scoring", label: t("得分", "Scoring"), value: cats.scoring },
                          { key: "rebounding", label: t("篮板", "Rebounds"), value: cats.rebounding },
                          { key: "playmaking", label: t("组织", "Playmaking"), value: cats.playmaking },
                          { key: "steals", label: t("抢断", "Steals"), value: cats.steals },
                          { key: "blocks", label: t("盖帽", "Blocks"), value: cats.blocks },
                          { key: "fieldGoal", label: t("命中率", "FG%"), value: cats.fieldGoal },
                        ].map(({ key, label, value }) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{label}</div>
                              <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                                <div style={{ width: `${Math.min(value, 100)}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                              </div>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 600, width: 24, color: "#374151" }}>{value.toFixed(0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
