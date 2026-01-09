"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getPlayers, Player } from "@/lib/store";

// 雷达图组件
function RadarChart({ players, stats }: { players: Player[], stats: string[] }) {
  const { t } = useLang();
  const size = 300;
  const center = size / 2;
  const radius = 120;
  const levels = 5;
  
  const colors = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444"];
  
  const statLabels: Record<string, { zh: string; en: string }> = {
    ppg: { zh: "得分", en: "PTS" },
    rpg: { zh: "篮板", en: "REB" },
    apg: { zh: "助攻", en: "AST" },
    spg: { zh: "抢断", en: "STL" },
    bpg: { zh: "盖帽", en: "BLK" },
    fg: { zh: "命中率", en: "FG%" },
  };
  
  const maxValues: Record<string, number> = {
    ppg: 35, rpg: 15, apg: 12, spg: 2.5, bpg: 4, fg: 70,
  };
  
  const angleStep = (2 * Math.PI) / stats.length;
  
  const getPoint = (value: number, maxValue: number, index: number) => {
    const normalizedValue = Math.min(Math.max(value / maxValue, 0), 1);
    const angle = index * angleStep - Math.PI / 2;
    const r = normalizedValue * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };
  
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const r = (radius / levels) * level;
    const points = stats.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    gridLines.push(<polygon key={level} points={points} fill="none" stroke="var(--border-color)" strokeWidth="1" opacity={0.5} />);
  }
  
  const axisLines = stats.map((_, i) => {
    const angle = i * angleStep - Math.PI / 2;
    return <line key={i} x1={center} y1={center} x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)} stroke="var(--border-color)" strokeWidth="1" opacity={0.5} />;
  });
  
  const labels = stats.map((stat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const labelRadius = radius + 25;
    return <text key={stat} x={center + labelRadius * Math.cos(angle)} y={center + labelRadius * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" fill="var(--text-secondary)" fontSize="12" fontWeight="500">{t(statLabels[stat]?.zh || stat, statLabels[stat]?.en || stat)}</text>;
  });
  
  const playerPolygons = players.map((player, playerIndex) => {
    const points = stats.map((stat, i) => {
      const value = player[stat as keyof Player] as number || 0;
      const point = getPoint(value, maxValues[stat], i);
      return `${point.x},${point.y}`;
    }).join(" ");
    
    return (
      <g key={player.id}>
        <polygon points={points} fill={colors[playerIndex]} fillOpacity={0.2} stroke={colors[playerIndex]} strokeWidth="2" />
        {stats.map((stat, i) => {
          const value = player[stat as keyof Player] as number || 0;
          const point = getPoint(value, maxValues[stat], i);
          return <circle key={`${player.id}-${stat}`} cx={point.x} cy={point.y} r="4" fill={colors[playerIndex]} />;
        })}
      </g>
    );
  });
  
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridLines}
      {axisLines}
      {playerPolygons}
      {labels}
    </svg>
  );
}

export default function ComparePage() {
  const { t } = useLang();
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  
  const colors = ["#f59e0b", "#3b82f6", "#22c55e", "#ef4444"];
  const radarStats = ["ppg", "rpg", "apg", "spg", "bpg", "fg"];
  
  useEffect(() => {
    const players = getPlayers();
    setAllPlayers(players);
    if (players.length >= 2) {
      setSelectedPlayers([players[0], players[1]]);
    }
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

  return (
    <div className="app">
      <Header />
      
      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("球员对比", "Player Comparison")}</h1>
          <p className="page-desc">{t("对比球员数据，做出更明智的选秀决策", "Compare player stats to make smarter draft decisions")}</p>
        </div>
        
        {/* Selected Players */}
        <div style={{ display: "flex", gap: 16, marginBottom: 40, flexWrap: "wrap" }}>
          {selectedPlayers.map((player, index) => (
            <div key={player.id} style={{ background: "var(--bg-card)", border: `2px solid ${colors[index]}`, borderRadius: 16, padding: 20, width: 200, position: "relative" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: colors[index], display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#000", fontSize: 14 }}>
                  {player.name.split(' ').map(n => n[0]).join('')}
                </div>
                <button onClick={() => removePlayer(player.id)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 18 }}>✕</button>
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>{player.name}</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{player.team} · {player.position}</p>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>{player.ppg}</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>PPG</span></div>
                <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>{player.rpg}</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>RPG</span></div>
                <div style={{ textAlign: "center" }}><span style={{ display: "block", fontSize: 18, fontWeight: 700 }}>{player.apg}</span><span style={{ fontSize: 11, color: "var(--text-muted)" }}>APG</span></div>
              </div>
            </div>
          ))}
          
          {selectedPlayers.length < 4 && (
            <div onClick={() => setShowSearch(true)} style={{ background: "var(--bg-card)", border: "2px dashed var(--border-color)", borderRadius: 16, padding: 20, width: 200, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--text-muted)" }}>
              <div style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--bg-secondary)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 12 }}>+</div>
              <span>{t("添加球员", "Add Player")}</span>
            </div>
          )}
        </div>
        
        {/* Search Modal */}
        {showSearch && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowSearch(false)}>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, width: "90%", maxWidth: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ marginBottom: 16 }}>{t("搜索球员", "Search Player")}</h3>
              <input
                type="text"
                style={{ width: "100%", background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, padding: "12px 16px", color: "var(--text-primary)", fontSize: 16, marginBottom: 16 }}
                placeholder={t("输入球员名字或球队...", "Enter player name or team...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              <div style={{ flex: 1, overflowY: "auto", marginBottom: 16 }}>
                {filteredPlayers.map(player => (
                  <div key={player.id} onClick={() => addPlayer(player)} style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, cursor: "pointer" }}>
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#000", fontSize: 12 }}>{player.name.split(' ').map(n => n[0]).join('')}</div>
                    <div style={{ flex: 1 }}>
                      <span style={{ display: "block", fontWeight: 500 }}>{player.name}</span>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{player.team} · {player.position}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: "var(--accent)" }}>{player.ppg} PPG</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowSearch(false)} style={{ width: "100%", padding: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)", borderRadius: 8, color: "var(--text-primary)", cursor: "pointer" }}>{t("取消", "Cancel")}</button>
            </div>
          </div>
        )}
        
        {selectedPlayers.length >= 2 && (
          <>
            {/* Radar Chart */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>{t("能力雷达图", "Stats Radar")}</h2>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
                <RadarChart players={selectedPlayers} stats={radarStats} />
                <div style={{ display: "flex", gap: 24, flexWrap: "wrap", justifyContent: "center" }}>
                  {selectedPlayers.map((player, index) => (
                    <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 16, height: 16, borderRadius: 4, background: colors[index] }} />
                      <span style={{ fontWeight: 500 }}>{player.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* Stats Table */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24, marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>{t("完整数据表", "Full Stats Table")}</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>{t("数据", "Stat")}</th>
                      {selectedPlayers.map((player, index) => (
                        <th key={player.id} style={{ padding: "12px 16px", textAlign: "left", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: colors[index] }}>{player.name.split(' ').pop()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { key: "team", label: t("球队", "Team") },
                      { key: "position", label: t("位置", "Position") },
                      { key: "age", label: t("年龄", "Age") },
                      { key: "ppg", label: "PPG" },
                      { key: "rpg", label: "RPG" },
                      { key: "apg", label: "APG" },
                      { key: "spg", label: "SPG" },
                      { key: "bpg", label: "BPG" },
                      { key: "fg", label: "FG%" },
                      { key: "ft", label: "FT%" },
                      { key: "tov", label: "TOV" },
                      { key: "adp", label: "ADP" },
                    ].map(({ key, label }) => {
                      const values = selectedPlayers.map(p => p[key as keyof Player] as number);
                      const isNumeric = typeof values[0] === "number";
                      const best = isNumeric ? (key === "tov" ? Math.min(...values) : Math.max(...values)) : null;
                      
                      return (
                        <tr key={key}>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)" }}>{label}</td>
                          {selectedPlayers.map((p, i) => {
                            const value = p[key as keyof Player];
                            const isBest = isNumeric && value === best;
                            return (
                              <td key={p.id} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-color)", color: isBest ? "var(--accent)" : "inherit", fontWeight: isBest ? 700 : 400 }}>
                                {key === "fg" || key === "ft" ? `${value}%` : value}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Verdict Cards */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>{t("对比结论", "Comparison Verdict")}</h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 20 }}>
                {selectedPlayers.map((player, index) => {
                  const scores = {
                    scoring: player.ppg / 35 * 100,
                    rebounding: player.rpg / 15 * 100,
                    playmaking: player.apg / 12 * 100,
                    defense: ((player.spg / 2.5) + (player.bpg / 4)) / 2 * 100,
                    efficiency: ((player.fg / 70) + (player.ft / 95)) / 2 * 100,
                  };
                  const overall = Object.values(scores).reduce((a, b) => a + b, 0) / 5;
                  
                  return (
                    <div key={player.id} style={{ background: "var(--bg-secondary)", border: `2px solid ${colors[index]}`, borderRadius: 12, padding: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                        <span style={{ fontWeight: 600 }}>{player.name}</span>
                        <span style={{ fontSize: 28, fontWeight: 700, color: colors[index] }}>{overall.toFixed(0)}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {[
                          { key: "scoring", label: t("得分", "Scoring") },
                          { key: "rebounding", label: t("篮板", "Rebounding") },
                          { key: "playmaking", label: t("组织", "Playmaking") },
                          { key: "defense", label: t("防守", "Defense") },
                          { key: "efficiency", label: t("效率", "Efficiency") },
                        ].map(({ key, label }) => (
                          <div key={key} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <span style={{ width: 60, fontSize: 12, color: "var(--text-muted)" }}>{label}</span>
                            <div style={{ flex: 1, height: 8, background: "var(--bg-card)", borderRadius: 4, overflow: "hidden" }}>
                              <div style={{ width: `${scores[key as keyof typeof scores]}%`, height: "100%", background: colors[index], borderRadius: 4 }} />
                            </div>
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
