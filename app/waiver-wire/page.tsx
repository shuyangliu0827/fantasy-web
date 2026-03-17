"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getPlayers, Player, getSessionUser, addToWatchlist, removeFromWatchlist, getWatchlist } from "@/lib/store";

type WaiverPlayer = Player & {
  addRate: number;
  dropRate: number;
  ownedPct: number;
  recentGames: { pts: number; reb: number; ast: number }[];
};

export default function WaiverWirePage() {
  const [lang, setLang] = useState<"zh" | "en">("zh");
  const [tab, setTab] = useState<"adds" | "drops" | "trending">("adds");
  const [players, setPlayers] = useState<WaiverPlayer[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const basePlayers = getPlayers();
    // Add waiver-specific data
    const waiverPlayers: WaiverPlayer[] = basePlayers.map(p => ({
      ...p,
      addRate: Math.random() * 30,
      dropRate: Math.random() * 20,
      ownedPct: 50 + Math.random() * 50,
      recentGames: [
        { pts: Math.floor(p.ppg + (Math.random() - 0.5) * 10), reb: Math.floor(p.rpg + (Math.random() - 0.5) * 5), ast: Math.floor(p.apg + (Math.random() - 0.5) * 4) },
        { pts: Math.floor(p.ppg + (Math.random() - 0.5) * 10), reb: Math.floor(p.rpg + (Math.random() - 0.5) * 5), ast: Math.floor(p.apg + (Math.random() - 0.5) * 4) },
        { pts: Math.floor(p.ppg + (Math.random() - 0.5) * 10), reb: Math.floor(p.rpg + (Math.random() - 0.5) * 5), ast: Math.floor(p.apg + (Math.random() - 0.5) * 4) },
      ],
    }));
    setPlayers(waiverPlayers);
    setWatchlist(getWatchlist().map(w => w.playerId));
    setUser(getSessionUser());
  }, []);

  const sortedPlayers = [...players].sort((a, b) => {
    if (tab === "adds") return b.addRate - a.addRate;
    if (tab === "drops") return b.dropRate - a.dropRate;
    return (b.addRate - b.dropRate) - (a.addRate - a.dropRate); // trending
  });

  const displayPlayers = sortedPlayers.slice(0, 15);

  const toggleWatchlist = (playerId: string) => {
    if (!user) {
      alert(lang === "zh" ? "请先登录" : "Please login first");
      return;
    }
    if (watchlist.includes(playerId)) {
      removeFromWatchlist(playerId);
      setWatchlist(watchlist.filter(id => id !== playerId));
    } else {
      addToWatchlist(playerId);
      setWatchlist([...watchlist, playerId]);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
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
            <span className="logo-title">蓝本</span>
          </Link>
          <nav className="main-nav">
            <Link href="/">Home</Link>
            <Link href="/rankings">Rankings</Link>
            <Link href="/draft-guide">Draft Guide</Link>
            <Link href="/waiver-wire" className="active">Waiver Wire</Link>
            <Link href="/how-to-play">How to Play</Link>
          </nav>
          <button 
            className="lang-toggle"
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          >
            {lang === "zh" ? "EN" : "中文"}
          </button>
        </div>
      </header>

      <main className="content-area">
        <div className="page-header">
          <h1>{lang === "zh" ? "交易市场" : "Waiver Wire"}</h1>
          <p>{lang === "zh" ? "查看最近热门的加入和放弃球员" : "See trending adds and drops across all leagues"}</p>
        </div>

        {/* Tab Selector */}
        <div className="waiver-tabs">
          <button 
            className={`waiver-tab ${tab === "adds" ? "active" : ""}`}
            onClick={() => setTab("adds")}
          >
            <span className="tab-icon"></span>
            {lang === "zh" ? "热门加入" : "Hot Adds"}
          </button>
          <button 
            className={`waiver-tab ${tab === "drops" ? "active" : ""}`}
            onClick={() => setTab("drops")}
          >
            <span className="tab-icon"></span>
            {lang === "zh" ? "热门放弃" : "Hot Drops"}
          </button>
          <button 
            className={`waiver-tab ${tab === "trending" ? "active" : ""}`}
            onClick={() => setTab("trending")}
          >
            <span className="tab-icon"></span>
            {lang === "zh" ? "趋势球员" : "Trending"}
          </button>
        </div>

        {/* Player List */}
        <div className="waiver-list">
          {displayPlayers.map((player, idx) => (
            <div key={player.id} className="waiver-card">
              <div className="waiver-rank">{idx + 1}</div>
              
              <div className="waiver-player">
                <div className="waiver-player-main">
                  <div className="waiver-name">{player.name}</div>
                  <div className="waiver-meta">
                    {player.team} · {player.position}
                    {player.injury && (
                      <span className={`injury-badge ${player.injury.toLowerCase()}`}>
                        {player.injury}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="waiver-rates">
                  <div className="rate add-rate">
                    <span className="rate-label">+</span>
                    <span className="rate-value">{player.addRate.toFixed(1)}%</span>
                  </div>
                  <div className="rate drop-rate">
                    <span className="rate-label">-</span>
                    <span className="rate-value">{player.dropRate.toFixed(1)}%</span>
                  </div>
                  <div className="owned-pct">
                    <span className="rate-label">{lang === "zh" ? "持有率" : "Owned"}</span>
                    <span className="rate-value">{player.ownedPct.toFixed(0)}%</span>
                  </div>
                </div>

                <div className="waiver-recent">
                  <div className="recent-label">{lang === "zh" ? "近3场" : "Last 3"}</div>
                  <div className="recent-games">
                    {player.recentGames.map((game, i) => (
                      <div key={i} className="recent-game">
                        <span>{game.pts}</span>
                        <span>{game.reb}</span>
                        <span>{game.ast}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="waiver-season">
                  <div className="season-stat">
                    <span className="stat-value">{player.ppg}</span>
                    <span className="stat-label">PPG</span>
                  </div>
                  <div className="season-stat">
                    <span className="stat-value">{player.rpg}</span>
                    <span className="stat-label">RPG</span>
                  </div>
                  <div className="season-stat">
                    <span className="stat-value">{player.apg}</span>
                    <span className="stat-label">APG</span>
                  </div>
                </div>

                <button 
                  className={`watchlist-btn ${watchlist.includes(player.id) ? "active" : ""}`}
                  onClick={() => toggleWatchlist(player.id)}
                >
                  {watchlist.includes(player.id) ? "" : ""}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="info-box">
          <h4>{lang === "zh" ? " 小贴士" : " Tips"}</h4>
          <ul>
            <li>{lang === "zh" ? "关注加入率高但持有率低的球员 - 这些可能是被低估的宝藏" : "Watch players with high add rate but low ownership - these might be hidden gems"}</li>
            <li>{lang === "zh" ? "伤病恢复的球员通常会在豁免区出现机会" : "Players returning from injury often present waiver opportunities"}</li>
            <li>{lang === "zh" ? "关注球队交易和首发变动带来的机会" : "Monitor trade deadlines and lineup changes for opportunities"}</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
