"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getSessionUser, getMyTeams, createMyTeam, getPlayers, addPlayerToTeam, removePlayerFromTeam, getPlayerById, MyTeam, Player } from "@/lib/store";

export default function MyTeamPage() {
  const { t } = useLang();
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
        <Header />
        <main className="page-content" style={{ textAlign: "center", paddingTop: 100 }}>
          <h1 className="page-title">{t("请先登录", "Please Login")}</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>{t("登录后可以管理你的 Fantasy 球队", "Login to manage your Fantasy teams")}</p>
          <Link href="/auth/login" className="btn btn-primary">{t("登录", "Login")}</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("我的球队", "My Team")}</h1>
          <p className="page-desc">{t("管理你的 Fantasy 篮球阵容，数据自动保存", "Manage your Fantasy basketball roster. Data saves automatically")}</p>
        </div>

        <div className="team-selector">
          {teams.map(team => (
            <button key={team.id} className={`team-tab ${activeTeam?.id === team.id ? "active" : ""}`} onClick={() => { setActiveTeam(team); loadTeamPlayers(team); }}>{team.name}</button>
          ))}
          <button className="team-tab add" onClick={() => setShowCreateTeam(true)}>+ {t("新建球队", "New Team")}</button>
        </div>

        {showCreateTeam && (
          <div className="modal-overlay" onClick={() => setShowCreateTeam(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <h3>{t("创建新球队", "Create New Team")}</h3>
              <input className="form-input" placeholder={t("球队名称", "Team Name")} value={newTeamName} onChange={e => setNewTeamName(e.target.value)} style={{ marginBottom: 16 }} />
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn btn-ghost" onClick={() => setShowCreateTeam(false)}>{t("取消", "Cancel")}</button>
                <button className="btn btn-primary" onClick={handleCreateTeam}>{t("创建", "Create")}</button>
              </div>
            </div>
          </div>
        )}

        {activeTeam ? (
          <>
            <div className="team-header-bar">
              <h2>{activeTeam.name}</h2>
              <span>{teamPlayers.length} {t("名球员", "players")}</span>
              <button className="btn btn-primary" onClick={() => setShowAddPlayer(true)}>+ {t("添加球员", "Add Player")}</button>
            </div>

            {showAddPlayer && (
              <div className="modal-overlay" onClick={() => setShowAddPlayer(false)}>
                <div className="modal-content large" onClick={e => e.stopPropagation()}>
                  <h3>{t("添加球员", "Add Player")}</h3>
                  <input className="form-input" placeholder={t("搜索球员...", "Search players...")} value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} style={{ marginBottom: 16 }} />
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
                <p>{t("球队还没有球员", "No players on this team yet")}</p>
                <button className="btn btn-primary" onClick={() => setShowAddPlayer(true)}>{t("添加第一个球员", "Add First Player")}</button>
              </div>
            ) : (
              <div className="roster-table">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("排名", "Rank")}</th>
                      <th>{t("球员", "Player")}</th>
                      <th>{t("位置", "Pos")}</th>
                      <th>{t("球队", "Team")}</th>
                      <th>PPG</th>
                      <th>RPG</th>
                      <th>APG</th>
                      <th>{t("操作", "Action")}</th>
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
                        <td><button className="btn btn-ghost btn-sm" onClick={() => handleRemovePlayer(p.id)}>{t("移除", "Remove")}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="empty-team">
            <p>{t("你还没有球队，创建一个开始吧！", "You don't have any teams yet. Create one to get started!")}</p>
            <button className="btn btn-primary" onClick={() => setShowCreateTeam(true)}>{t("创建球队", "Create Team")}</button>
          </div>
        )}
      </main>
    </div>
  );
}
