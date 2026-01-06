"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getPlayers, getSessionUser, addToWatchlist, getWatchlist, removeFromWatchlist, Player } from "@/lib/store";

export default function RankingsPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"rank" | "adp" | "ppg" | "rpg" | "apg">("rank");
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);

  useEffect(() => {
    setPlayers(getPlayers());
    setUser(getSessionUser());
    const wl = getWatchlist();
    setWatchlist(wl.map(w => w.playerId));
  }, []);

  const toggleWatchlist = (playerId: string) => {
    if (!user) {
      alert("Please login first");
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

  const filteredPlayers = players
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter !== "ALL" && !p.position.includes(posFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rank") return a.rank - b.rank;
      if (sortBy === "adp") return a.adp - b.adp;
      if (sortBy === "ppg") return b.ppg - a.ppg;
      if (sortBy === "rpg") return b.rpg - a.rpg;
      if (sortBy === "apg") return b.apg - a.apg;
      return 0;
    });

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
          <Link href="/rankings" className="nav-link active">球员排名</Link>
          <Link href="/draft-guide" className="nav-link">选秀指南</Link>
          <Link href="/cheat-sheet" className="nav-link">备忘单</Link>
          <Link href="/how-to-play" className="nav-link">新手入门</Link>
          <Link href="/my-team" className="nav-link">我的球队</Link>
          <Link href="/mock-draft" className="nav-link">模拟选秀</Link>
        </div>
      </nav>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">球员排名 Rankings</h1>
          <p className="page-desc">2024-25 赛季 Fantasy 篮球球员排名，点击 ⭐ 加入关注列表</p>
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <input
            className="filter-search"
            placeholder="搜索球员..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select className="filter-select" value={posFilter} onChange={(e) => setPosFilter(e.target.value)}>
            <option value="ALL">全部位置</option>
            <option value="PG">PG</option>
            <option value="SG">SG</option>
            <option value="SF">SF</option>
            <option value="PF">PF</option>
            <option value="C">C</option>
          </select>
          <select className="filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
            <option value="rank">按排名</option>
            <option value="adp">按 ADP</option>
            <option value="ppg">按得分</option>
            <option value="rpg">按篮板</option>
            <option value="apg">按助攻</option>
          </select>
        </div>

        {/* Player Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>排名</th>
                <th>球员</th>
                <th>球队</th>
                <th>位置</th>
                <th>ADP</th>
                <th>PPG</th>
                <th>RPG</th>
                <th>APG</th>
                <th>SPG</th>
                <th>BPG</th>
                <th>FG%</th>
                <th>FT%</th>
                <th style={{ width: 60 }}>关注</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map((player) => (
                <tr key={player.id} className={player.injury ? "injured" : ""}>
                  <td className="rank-cell">
                    <span className={`rank-badge ${player.rank <= 10 ? "top10" : player.rank <= 30 ? "top30" : ""}`}>
                      {player.rank}
                    </span>
                    {player.trend === "up" && <span className="trend up">↑</span>}
                    {player.trend === "down" && <span className="trend down">↓</span>}
                  </td>
                  <td className="player-cell">
                    <div className="player-name">{player.name}</div>
                    {player.injury && <span className="injury-tag">{player.injury}</span>}
                  </td>
                  <td>{player.team}</td>
                  <td>{player.position}</td>
                  <td>{player.adp.toFixed(1)}</td>
                  <td className="stat-highlight">{player.ppg.toFixed(1)}</td>
                  <td>{player.rpg.toFixed(1)}</td>
                  <td>{player.apg.toFixed(1)}</td>
                  <td>{player.spg.toFixed(1)}</td>
                  <td>{player.bpg.toFixed(1)}</td>
                  <td>{player.fg.toFixed(1)}%</td>
                  <td>{player.ft.toFixed(1)}%</td>
                  <td>
                    <button 
                      className={`watchlist-btn ${watchlist.includes(player.id) ? "active" : ""}`}
                      onClick={() => toggleWatchlist(player.id)}
                    >
                      {watchlist.includes(player.id) ? "★" : "☆"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
