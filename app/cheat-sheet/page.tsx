"use client";

import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getPlayers, getWatchlist, Player } from "@/lib/store";

export default function CheatSheetPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"tiers" | "positions">("tiers");

  useEffect(() => {
    setPlayers(getPlayers());
    const wl = getWatchlist();
    setWatchlist(wl.map(w => w.playerId));
    const savedDrafted = localStorage.getItem("bp_cheatsheet_drafted");
    if (savedDrafted) setDrafted(JSON.parse(savedDrafted));
  }, []);

  const toggleDrafted = (playerId: string) => {
    const newDrafted = drafted.includes(playerId)
      ? drafted.filter(id => id !== playerId)
      : [...drafted, playerId];
    setDrafted(newDrafted);
    localStorage.setItem("bp_cheatsheet_drafted", JSON.stringify(newDrafted));
  };

  const clearDrafted = () => {
    setDrafted([]);
    localStorage.removeItem("bp_cheatsheet_drafted");
  };

  const getTier = (rank: number) => {
    if (rank <= 5) return { tier: 1, label: t("Tier 1 - 精英", "Tier 1 - Elite"), color: "#fbbf24" };
    if (rank <= 12) return { tier: 2, label: t("Tier 2 - 首轮", "Tier 2 - First Round"), color: "#3b82f6" };
    if (rank <= 24) return { tier: 3, label: t("Tier 3 - 次轮", "Tier 3 - Second Round"), color: "#10b981" };
    if (rank <= 50) return { tier: 4, label: t("Tier 4 - 中轮", "Tier 4 - Mid Rounds"), color: "#8b5cf6" };
    return { tier: 5, label: t("Tier 5 - 后轮", "Tier 5 - Late Rounds"), color: "#64748b" };
  };

  const playersByTier = players.reduce((acc, p) => {
    const { tier } = getTier(p.rank);
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(p);
    return acc;
  }, {} as Record<number, Player[]>);

  const playersByPosition = players.reduce((acc, p) => {
    const mainPos = p.position.split("/")[0];
    if (!acc[mainPos]) acc[mainPos] = [];
    acc[mainPos].push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("选秀备忘单", "Draft Cheat Sheet")}</h1>
          <p className="page-desc">{t("实时选秀助手，点击球员名字标记为已被选走", "Live draft assistant. Click player names to mark as drafted")}</p>
        </div>

        <div className="cheatsheet-controls">
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === "tiers" ? "active" : ""}`}
              onClick={() => setViewMode("tiers")}
            >
              {t("按 Tier 分组", "By Tier")}
            </button>
            <button 
              className={`toggle-btn ${viewMode === "positions" ? "active" : ""}`}
              onClick={() => setViewMode("positions")}
            >
              {t("按位置分组", "By Position")}
            </button>
          </div>
          <div className="cheatsheet-actions">
            <span className="drafted-count">{drafted.length} {t("人已被选", "drafted")}</span>
            <button className="btn btn-ghost" onClick={clearDrafted}>{t("清除标记", "Clear")}</button>
            <button className="btn btn-ghost" onClick={() => window.print()}>{t("打印", "Print")}</button>
          </div>
        </div>

        {viewMode === "tiers" ? (
          <div className="cheatsheet-tiers">
            {[1, 2, 3, 4, 5].map(tier => {
              const tierInfo = getTier(tier === 1 ? 1 : tier === 2 ? 6 : tier === 3 ? 13 : tier === 4 ? 25 : 51);
              const tierPlayers = playersByTier[tier] || [];
              return (
                <div key={tier} className="tier-section" style={{ borderColor: tierInfo.color }}>
                  <h3 className="tier-header" style={{ background: tierInfo.color }}>{tierInfo.label}</h3>
                  <div className="tier-players">
                    {tierPlayers.map(p => (
                      <div 
                        key={p.id} 
                        className={`cheat-player ${drafted.includes(p.id) ? "drafted" : ""} ${watchlist.includes(p.id) ? "watchlist" : ""}`}
                        onClick={() => toggleDrafted(p.id)}
                      >
                        <span className="cheat-rank">{p.rank}</span>
                        <span className="cheat-name">{p.name}</span>
                        <span className="cheat-pos">{p.position}</span>
                        <span className="cheat-team">{p.team}</span>
                        {watchlist.includes(p.id) && <span className="cheat-star">★</span>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cheatsheet-positions">
            {["PG", "SG", "SF", "PF", "C"].map(pos => (
              <div key={pos} className="position-column">
                <h3 className="position-header">{pos}</h3>
                <div className="position-players">
                  {(playersByPosition[pos] || []).slice(0, 15).map(p => (
                    <div 
                      key={p.id} 
                      className={`cheat-player ${drafted.includes(p.id) ? "drafted" : ""} ${watchlist.includes(p.id) ? "watchlist" : ""}`}
                      onClick={() => toggleDrafted(p.id)}
                    >
                      <span className="cheat-rank">{p.rank}</span>
                      <span className="cheat-name">{p.name}</span>
                      {watchlist.includes(p.id) && <span className="cheat-star">★</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="cheatsheet-legend">
          <div className="legend-item"><span className="legend-dot watchlist"></span> {t("关注列表", "Watchlist")}</div>
          <div className="legend-item"><span className="legend-dot drafted"></span> {t("已被选走", "Drafted")}</div>
          <p className="legend-tip">{t("点击球员名字可以标记/取消标记为已被选走，数据会自动保存", "Click player names to mark/unmark as drafted. Data saves automatically")}</p>
        </div>
      </main>
    </div>
  );
}
