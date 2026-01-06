"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getSessionUser, getMyTeams, createMyTeam, getPlayers, addPlayerToTeam, removePlayerFromTeam, getPlayerById, MyTeam, Player } from "@/lib/store";

export default function MyTeamPage() {
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [activeTeam, setActiveTeam] = useState<MyTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (u) {
      const t = getMyTeams();
      setTeams(t);
      if (t.length > 0) { setActiveTeam(t[0]); loadTeamPlayers(t[0]); }
    }
    setAllPlayers(getPlayers());
  }, []);

  const loadTeamPlayers = (team: MyTeam) => {
    const players = team.players.map(id => getPlayerById(id)).filter(Boolean) as Player[];
    setTeamPlayers(players);
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const result = createMyTeam("default", newTeamName);
    if (result.ok) {
      setTeams([...teams, result.team]);
      setActiveTeam(result.team);
      setTeamPlayers([]);
      setNewTeamName("");
      setShowCreateTeam(false);
    }
  };

  const handleAddPlayer = (player: Player) => {
    if (!activeTeam) return;
    addPlayerToTeam(activeTeam.id, player.id);
    const updated = { ...activeTeam, players: [...activeTeam.players, player.id] };
    setActiveTeam(updated);
    setTeamPlayers([...teamPlayers, player]);
    setTeams(teams.map(t => t.id === updated.id ? updated : t));
    setShowAddPlayer(false);
  };

  const handleRemovePlayer = (playerId: string) => {
    if (!activeTeam) return;
    removePlayerFromTeam(activeTeam.id, playerId);
    const updated = { ...activeTeam, players: activeTeam.players.filter(id => id !== playerId) };
    setActiveTeam(updated);
    setTeamPlayers(teamPlayers.filter(p => p.id !== playerId));
    setTeams(teams.map(t => t.id === updated.id ? updated : t));
  };

  const availablePlayers = allPlayers.filter(p => !activeTeam?.players.includes(p.id) && p.name.toLowerCase().includes(playerSearch.toLowerCase()));

  if (!user) {
    return (
      <div className="app">
        <header className="header"><div className="header-inner"><Link href="/" className="logo"><div className="logo-icon"><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/></svg></div><div className="logo-text"><span className="logo-title">蓝本</span></div></Link></div></header>
        <main className="page-content" style={{ textAlign: "center", paddingTop: 100 }}>
          <h1 className="page-title">请先登录</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>登录后可以管理你的 Fantasy 球队</p>
          <Link href="/auth/login" className="btn btn-primary">登录</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon"><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/><path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/><path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/></svg></div>
            <div className="logo-text"><span className="logo-title">蓝本</span><span className="logo-sub">Fantasy 篮球决策平台</span></div>
          </Link>
          <Link href="/" className="btn btn-ghost">← 返回首页</Link>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          <Link href="/" className="nav-link">首页</Link>
          <Link href="/rankings" className="nav-link">球员排名</Link>
          <Link href="/draft-guide" className="nav-link">选秀指南</Link>
          <Link href="/cheat-sheet" className="nav-link">备忘单</Link>
          <Link href="/how-to-play" className="nav-link">新手入门</Link>
          <Link href="/my-team" className="nav-link active">我的球队</Link>
          <Link href="/mock-draft" className="nav-link">模拟选秀</Link>
        </div>
      </nav>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">我的球队 My Team</h1>
          <p className="page-desc">管理你的 Fantasy 篮球阵容，数据自动保存</p>
        </div>

        <div className="team-selector">
          {teams.map(team => (
            <button key={team.id} className={`team-tab ${activeTeam?.id === team.id ? "active" : ""}`} onClick={() => { setActiveTeam(team); loadTeamPlayers(team); }}>{team.name}</button>
          ))}
          <button className="team-tab add" onClick={() => setShowCreateTeam(true)}>+ 新建球队</button>
        </div>

        {showCreateTeam && (
          <div className="modal-overlay" onClick={() => setShowCreateTeam(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>创建新球队</h3>
              <input className="form-input" placeholder="球队名称" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setShowCreateTeam(false)}>取消</button>
                <button className="btn btn-primary" onClick={handleCreateTeam}>创建</button>
              </div>
            </div>
          </div>
        )}

        {activeTeam ? (
          <>
            <div className="team-header-bar">
              <h2>{activeTeam.name}</h2>
              <span>{teamPlayers.length} 名球员</span>
              <button className="btn btn-primary" onClick={() => setShowAddPlayer(true)}>+ 添加球员</button>
            </div>

            {showAddPlayer && (
              <div className="modal-overlay" onClick={() => setShowAddPlayer(false)}>
                <div className="modal-content large" onClick={e => e.stopPropagation()}>
                  <h3>添加球员</h3>
                  <input className="form-input" placeholder="搜索球员..." value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} style={{ marginBottom: 16 }} />
                  <div className="player-list">
                    {availablePlayers.slice(0, 20).map(p => (
                      <div key={p.id} className="player-list-item" onClick={() => handleAddPlayer(p)}>
                        <span className="player-rank">#{p.rank}</span>
                        <span className="player-name">{p.name}</span>
                        <span className="player-info">{p.team} · {p.position}</span>
                        <span className="player-stats">{p.ppg} PPG</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {teamPlayers.length === 0 ? (
              <div className="empty-team">
                <p>球队还没有球员</p>
                <button className="btn btn-primary" onClick={() => setShowAddPlayer(true)}>添加第一个球员</button>
              </div>
            ) : (
              <div className="roster-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>球员</th>
                      <th>位置</th>
                      <th>球队</th>
                      <th>PPG</th>
                      <th>RPG</th>
                      <th>APG</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamPlayers.map(p => (
                      <tr key={p.id}>
                        <td><span className="rank-badge">{p.rank}</span></td>
                        <td className="player-cell"><div className="player-name">{p.name}</div></td>
                        <td>{p.position}</td>
                        <td>{p.team}</td>
                        <td className="stat-highlight">{p.ppg}</td>
                        <td>{p.rpg}</td>
                        <td>{p.apg}</td>
                        <td><button className="btn btn-ghost btn-sm" onClick={() => handleRemovePlayer(p.id)}>移除</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="empty-team">
            <p>你还没有球队，创建一个开始吧！</p>
            <button className="btn btn-primary" onClick={() => setShowCreateTeam(true)}>创建球队</button>
          </div>
        )}
      </main>
    </div>
  );
}
