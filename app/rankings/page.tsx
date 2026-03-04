"use client";

import { useState, useEffect, useMemo } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

type PlayerStats = {
  id: number;
  name: string;
  team: string;
  position: string;
  gamesPlayed: number;
  totals: {
    min: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    pts: number;
  };
  averages: {
    min: number;
    fgm: number;
    fga: number;
    fg3m: number;
    fg3a: number;
    ftm: number;
    fta: number;
    fg_pct: number;
    fg3_pct: number;
    ft_pct: number;
    reb: number;
    ast: number;
    stl: number;
    blk: number;
    tov: number;
    pts: number;
  };
  fpts: number;
  fptsAvg: number;
  rank: number;
  injury?: string;
};

type SortKey = "rank" | "name" | "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov" | "fptsAvg" | "gamesPlayed";

export default function PlayerRankingsPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [gamesLoaded, setGamesLoaded] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [statView, setStatView] = useState<"averages" | "totals">("averages");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 初始加载
  useEffect(() => {
    loadData();
    // 每 5 分钟检查一次更新
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const response = await fetch("/api/nba-stats");
      const data = await response.json();

      if (data.status === "loading") {
        // 数据正在首次加载，5秒后重试
        setTimeout(loadData, 5000);
        return;
      }

      if (data.players && data.players.length > 0) {
        setPlayers(data.players);
        setGamesLoaded(data.gamesLoaded);
        setLastUpdated(data.lastUpdated);
        setError(null);
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const teams = useMemo(() => {
    const teamSet = new Set(players.map((p) => p.team));
    return Array.from(teamSet).filter((t) => t !== "N/A").sort();
  }, [players]);

  const filteredPlayers = useMemo(() => {
    let result = players;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term)
      );
    }

    if (positionFilter !== "all") {
      result = result.filter((p) => p.position.includes(positionFilter));
    }

    if (teamFilter !== "all") {
      result = result.filter((p) => p.team === teamFilter);
    }

    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;

      if (sortKey === "name") {
        aVal = a.name;
        bVal = b.name;
      } else if (sortKey === "rank" || sortKey === "gamesPlayed" || sortKey === "fptsAvg") {
        aVal = a[sortKey];
        bVal = b[sortKey];
      } else {
        aVal = statView === "averages" ? a.averages[sortKey as keyof typeof a.averages] : a.totals[sortKey as keyof typeof a.totals];
        bVal = statView === "averages" ? b.averages[sortKey as keyof typeof b.averages] : b.totals[sortKey as keyof typeof b.totals];
      }

      if (typeof aVal === "string") {
        return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [players, searchTerm, positionFilter, teamFilter, sortKey, sortOrder, statView]);

  const paginatedPlayers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, page]);

  const totalPages = Math.ceil(filteredPlayers.length / pageSize);
  const injuredCount = players.filter((p) => p.injury).length;

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder(key === "name" ? "asc" : "desc");
    }
  }

  function SortIcon({ column }: { column: SortKey }) {
    if (sortKey !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortOrder === "asc" ? "↑" : "↓"}</span>;
  }

  function InjuryBadge({ status }: { status?: string }) {
    if (!status) return null;
    const colors: Record<string, string> = {
      Out: "#ef4444",
      Doubtful: "#f97316",
      Questionable: "#eab308",
      Probable: "#22c55e",
      "Day-To-Day": "#f97316",
    };
    return (
      <span className="injury-indicator" style={{ backgroundColor: colors[status] || "#888" }} title={status}>
        {status.charAt(0)}
      </span>
    );
  }

  function formatStat(value: number): string {
    return value.toFixed(1);
  }

  function formatTime(isoString: string | null): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading && players.length === 0) {
    return (
      <div className="app">
        <Header />
        <main className="page-content">
          <div className="loading-container">
            <div className="loading-spinner">🏀</div>
            <p>{t("加载中...", "Loading...")}</p>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (error && players.length === 0) {
    return (
      <div className="app">
        <Header />
        <main className="page-content">
          <div className="error-container">
            <h2>❌ {t("加载失败", "Failed to Load")}</h2>
            <p>{error}</p>
            <button onClick={loadData} className="retry-btn">
              {t("重试", "Retry")}
            </button>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="page-content">
        <div className="container">
          {/* 页面头部 */}
          <div className="page-header">
            <div className="header-left">
              <h1>🏀 {t("球员排名", "Player Rankings")}</h1>
              <div className="header-tabs">
                <button className="tab active">Stats</button>
                <button className="tab">Trending</button>
                <button className="tab">Schedule</button>
                <button className="tab">News</button>
              </div>
            </div>
            <div className="header-right">
              <div className="view-toggle">
                <button
                  className={statView === "totals" ? "active" : ""}
                  onClick={() => setStatView("totals")}
                >
                  Totals
                </button>
                <button
                  className={statView === "averages" ? "active" : ""}
                  onClick={() => setStatView("averages")}
                >
                  Averages
                </button>
              </div>
            </div>
          </div>

          {/* 数据状态栏 */}
          <div className="data-source-bar">
            <span className="live-indicator">⚡ {t("实时数据", "LIVE DATA")}</span>
            <span>{t(`${gamesLoaded} 场比赛`, `${gamesLoaded} games`)}</span>
            <span>{t(`${players.length} 名球员`, `${players.length} players`)}</span>
            {lastUpdated && (
              <span className="last-updated">
                {t("更新于", "Updated")} {formatTime(lastUpdated)}
              </span>
            )}
          </div>

          {/* 过滤器 */}
          <div className="filters">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder={t("搜索球员...", "Search players...")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <select
              value={positionFilter}
              onChange={(e) => {
                setPositionFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">{t("全部位置", "All Positions")}</option>
              <option value="G">Guard (G)</option>
              <option value="F">Forward (F)</option>
              <option value="C">Center (C)</option>
            </select>
            <select
              value={teamFilter}
              onChange={(e) => {
                setTeamFilter(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="all">{t("全部球队", "All Teams")}</option>
              {teams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
            <div className="stats-info">
              <span>👥 {filteredPlayers.length}</span>
              <span>🏥 {injuredCount}</span>
            </div>
          </div>

          {/* 球员表格 */}
          <div className="table-container">
            <table className="players-table">
              <thead>
                <tr>
                  <th className="col-player" colSpan={2}>
                    <div className="th-content" onClick={() => handleSort("name")}>
                      PLAYER <SortIcon column="name" />
                    </div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("gamesPlayed")}>
                    <div className="th-content">GP <SortIcon column="gamesPlayed" /></div>
                  </th>
                  <th className="col-stat">MIN</th>
                  <th className="col-stat">FGM</th>
                  <th className="col-stat">FGA</th>
                  <th className="col-stat">FTM</th>
                  <th className="col-stat">FTA</th>
                  <th className="col-stat" onClick={() => handleSort("fg3m")}>
                    <div className="th-content">3PM <SortIcon column="fg3m" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("reb")}>
                    <div className="th-content">REB <SortIcon column="reb" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("ast")}>
                    <div className="th-content">AST <SortIcon column="ast" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("stl")}>
                    <div className="th-content">STL <SortIcon column="stl" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("blk")}>
                    <div className="th-content">BLK <SortIcon column="blk" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("tov")}>
                    <div className="th-content">TO <SortIcon column="tov" /></div>
                  </th>
                  <th className="col-stat" onClick={() => handleSort("pts")}>
                    <div className="th-content">PTS <SortIcon column="pts" /></div>
                  </th>
                  <th className="col-fpts" onClick={() => handleSort("fptsAvg")}>
                    <div className="th-content">FPTS <SortIcon column="fptsAvg" /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedPlayers.map((player) => {
                  const stats = statView === "averages" ? player.averages : player.totals;
                  return (
                    <tr key={player.id} className={player.injury ? "injured" : ""}>
                      <td className="col-rank">
                        <span className={`rank ${player.rank <= 10 ? "top10" : player.rank <= 50 ? "top50" : ""}`}>
                          {player.rank}
                        </span>
                      </td>
                      <td className="col-player-info">
                        <div className="player-avatar">{player.name.charAt(0)}</div>
                        <div className="player-details">
                          <div className="player-name">
                            {player.name}
                            <InjuryBadge status={player.injury} />
                          </div>
                          <div className="player-meta">{player.team} • {player.position}</div>
                        </div>
                      </td>
                      <td className="col-stat">{player.gamesPlayed}</td>
                      <td className="col-stat">{formatStat(stats.min)}</td>
                      <td className="col-stat">{formatStat(stats.fgm)}</td>
                      <td className="col-stat">{formatStat(stats.fga)}</td>
                      <td className="col-stat">{formatStat(stats.ftm)}</td>
                      <td className="col-stat">{formatStat(stats.fta)}</td>
                      <td className="col-stat">{formatStat(stats.fg3m)}</td>
                      <td className="col-stat">{formatStat(stats.reb)}</td>
                      <td className="col-stat">{formatStat(stats.ast)}</td>
                      <td className="col-stat">{formatStat(stats.stl)}</td>
                      <td className="col-stat">{formatStat(stats.blk)}</td>
                      <td className="col-stat negative">{formatStat(stats.tov)}</td>
                      <td className="col-stat highlight">{formatStat(stats.pts)}</td>
                      <td className="col-fpts">
                        <div className="fpts-cell">
                          <span className="fpts-total">{player.fpts}</span>
                          <span className="fpts-avg">{player.fptsAvg}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="pagination">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                ← Prev
              </button>
              <div className="page-numbers">
                {(() => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const end = Math.min(totalPages, start + 4);
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map((pageNum) => (
                    <button
                      key={pageNum}
                      className={pageNum === page ? "active" : ""}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </button>
                  ));
                })()}
              </div>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next →
              </button>
            </div>
          )}

        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page-content {
    min-height: calc(100vh - 60px);
    background: #f5f5f5;
    padding: 20px 16px;
  }

  .container {
    max-width: 1400px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    background: #fff;
    padding: 16px 20px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }

  .header-left h1 {
    font-size: 22px;
    font-weight: 700;
    color: #1a1a1a;
    margin: 0 0 12px 0;
  }

  .header-tabs {
    display: flex;
    gap: 4px;
  }

  .header-tabs .tab {
    padding: 8px 16px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: #666;
    font-size: 14px;
    cursor: pointer;
  }

  .header-tabs .tab.active {
    color: #0066cc;
    border-bottom-color: #0066cc;
    font-weight: 600;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .view-toggle {
    display: flex;
    background: #f0f0f0;
    border-radius: 6px;
    overflow: hidden;
  }

  .view-toggle button {
    padding: 8px 16px;
    border: none;
    background: none;
    font-size: 13px;
    cursor: pointer;
    color: #666;
  }

  .view-toggle button.active {
    background: #0066cc;
    color: white;
  }

  .data-source-bar {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 10px 16px;
    background: linear-gradient(90deg, #065f46 0%, #047857 100%);
    border-radius: 6px;
    margin-bottom: 12px;
    color: white;
    font-size: 13px;
    flex-wrap: wrap;
  }

  .live-indicator {
    font-weight: 600;
    animation: pulse 2s infinite;
  }

  .last-updated {
    margin-left: auto;
    opacity: 0.9;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
  }

  .filters {
    display: flex;
    gap: 12px;
    margin-bottom: 12px;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-box {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    min-width: 200px;
  }

  .search-box input {
    flex: 1;
    border: none;
    outline: none;
    font-size: 14px;
  }

  .filter-select {
    padding: 10px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
  }

  .stats-info {
    display: flex;
    gap: 12px;
    margin-left: auto;
    font-size: 13px;
    color: #666;
  }

  .table-container {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    overflow-x: auto;
  }

  .players-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 1100px;
  }

  .players-table th {
    padding: 12px 6px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    background: #fafafa;
    border-bottom: 1px solid #eee;
    cursor: pointer;
    white-space: nowrap;
  }

  .players-table th:hover {
    background: #f0f0f0;
  }

  .th-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
  }

  .sort-icon {
    font-size: 10px;
    opacity: 0.3;
  }

  .sort-icon.active {
    opacity: 1;
    color: #0066cc;
  }

  .players-table td {
    padding: 8px 6px;
    text-align: center;
    font-size: 13px;
    color: #333;
    border-bottom: 1px solid #f0f0f0;
  }

  .players-table tr:hover {
    background: #f8f9fa;
  }

  .players-table tr.injured {
    background: #fff8f8;
  }

  .col-rank {
    width: 40px;
    padding-left: 8px !important;
  }

  .rank {
    display: inline-block;
    width: 28px;
    height: 28px;
    line-height: 28px;
    text-align: center;
    background: #f0f0f0;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #666;
  }

  .rank.top10 {
    background: #fef3c7;
    color: #92400e;
  }

  .rank.top50 {
    background: #dbeafe;
    color: #1e40af;
  }

  .col-player-info {
    display: flex;
    align-items: center;
    gap: 10px;
    text-align: left !important;
    min-width: 160px;
  }

  .player-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .player-name {
    font-weight: 600;
    color: #1a1a1a;
    font-size: 13px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .player-meta {
    font-size: 11px;
    color: #888;
    margin-top: 1px;
  }

  .injury-indicator {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    font-size: 8px;
    font-weight: 700;
    color: white;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .col-stat {
    min-width: 40px;
    color: #555;
  }

  .col-stat.highlight {
    font-weight: 600;
    color: #1a1a1a;
  }

  .col-stat.negative {
    color: #dc2626;
  }

  .col-fpts {
    min-width: 60px;
    background: #f0fdf4;
  }

  .fpts-cell {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .fpts-total {
    font-size: 10px;
    color: #888;
  }

  .fpts-avg {
    font-weight: 700;
    color: #16a34a;
    font-size: 14px;
  }

  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 8px;
    margin-top: 16px;
  }

  .pagination button {
    padding: 8px 14px;
    background: #fff;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-numbers {
    display: flex;
    gap: 4px;
  }

  .page-numbers button {
    width: 36px;
    padding: 8px;
  }

  .page-numbers button.active {
    background: #0066cc;
    color: white;
    border-color: #0066cc;
  }

  .scoring-note {
    margin-top: 16px;
    padding: 14px 18px;
    background: #fff;
    border-radius: 8px;
    border-left: 4px solid #0066cc;
  }

  .scoring-note h4 {
    font-size: 14px;
    margin: 0 0 6px 0;
  }

  .scoring-note p {
    font-size: 13px;
    color: #666;
    margin: 0;
  }

  .scoring-note .data-info {
    margin-top: 6px;
    font-size: 12px;
    color: #16a34a;
  }

  .loading-container, .error-container {
    text-align: center;
    padding: 80px 20px;
    background: #fff;
    border-radius: 8px;
  }

  .loading-spinner {
    font-size: 48px;
    animation: bounce 1s infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .retry-btn {
    padding: 12px 24px;
    background: #0066cc;
    border: none;
    border-radius: 6px;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 12px;
    }

    .header-right {
      width: 100%;
      justify-content: space-between;
    }

    .data-source-bar {
      flex-direction: column;
      gap: 6px;
      text-align: center;
    }

    .last-updated {
      margin-left: 0;
    }

    .filters {
      flex-direction: column;
    }

    .search-box, .filter-select {
      width: 100%;
    }

    .stats-info {
      margin-left: 0;
      width: 100%;
      justify-content: space-between;
    }
  }
`;