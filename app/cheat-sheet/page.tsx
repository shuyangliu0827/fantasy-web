"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getPlayers, getWatchlist, Player } from "@/lib/store";

export default function CheatSheetPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"tiers" | "positions">("tiers");

  useEffect(() => {
    setPlayers(getPlayers());
    const wl = getWatchlist();
    setWatchlist(wl.map(w => w.playerId));
    // Load drafted players from localStorage
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
    if (rank <= 5) return { tier: 1, label: "Tier 1 - 精英", color: "#fbbf24" };
    if (rank <= 12) return { tier: 2, label: "Tier 2 - 首轮", color: "#3b82f6" };
    if (rank <= 24) return { tier: 3, label: "Tier 3 - 次轮", color: "#10b981" };
    if (rank <= 50) return { tier: 4, label: "Tier 4 - 中轮", color: "#8b5cf6" };
    return { tier: 5, label: "Tier 5 - 后轮", color: "#64748b" };
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
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-title">蓝本</span>
              <span className="logo-sub">Fantasy 篮球决策平台</span>
            </div>
          </Link>
          <Link href="/" className="btn btn-ghost">← 返回首页</Link>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          <Link href="/" className="nav-link">首页</Link>
          <Link href="/rankings" className="nav-link">球员排名</Link>
          <Link href="/draft-guide" className="nav-link">选秀指南</Link>
          <Link href="/cheat-sheet" className="nav-link active">备忘单</Link>
          <Link href="/how-to-play" className="nav-link">新手入门</Link>
          <Link href="/my-team" className="nav-link">我的球队</Link>
          <Link href="/mock-draft" className="nav-link">模拟选秀</Link>
        </div>
      </nav>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">选秀备忘单 Cheat Sheet</h1>
          <p className="page-desc">实时选秀助手，点击球员名字标记为已被选走</p>
        </div>

        <div className="cheatsheet-controls">
          <div className="view-toggle">
            <button 
              className={`toggle-btn ${viewMode === "tiers" ? "active" : ""}`}
              onClick={() => setViewMode("tiers")}
            >
              按 Tier 分组
            </button>
            <button 
              className={`toggle-btn ${viewMode === "positions" ? "active" : ""}`}
              onClick={() => setViewMode("positions")}
            >
              按位置分组
            </button>
          </div>
          <div className="cheatsheet-actions">
            <span className="drafted-count">{drafted.length} 人已被选</span>
            <button className="btn btn-ghost" onClick={clearDrafted}>清除标记</button>
            <button className="btn btn-ghost" onClick={() => window.print()}>打印</button>
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
          <div className="legend-item"><span className="legend-dot watchlist"></span> 关注列表</div>
          <div className="legend-item"><span className="legend-dot drafted"></span> 已被选走</div>
          <p className="legend-tip">点击球员名字可以标记/取消标记为已被选走，数据会自动保存</p>
        </div>
      </main>
    </div>
  );
}
