"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import { PLAYER_POSITIONS } from "@/lib/player-positions";
import {
  getSessionUser,
  getLeagueBySlug,
  getUndraftedPlayers,
  getTeamRoster,
  fetchTeamRosterFromDB,
  addFreeAgent,
  dropPlayer,
  getCurrentRoster,
  League,
  Player,
  RosterPlayer,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";

export default function FreeAgentsPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<"ppg" | "rpg" | "apg" | "rank">("ppg");
  const [showAddModal, setShowAddModal] = useState<Player | null>(null);
  const [dropPlayerId, setDropPlayerId] = useState<string | null>(null);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData);

    const currentUser = getSessionUser();
    if (currentUser) {
      const { data: teamsData } = await supabase
        .from("fantasy_teams")
        .select("id, name, user_id")
        .eq("league_id", leagueData.id);
      const myT = teamsData?.find((t: { user_id: string }) => t.user_id === currentUser.id);
      if (myT) {
        setMyTeam(myT);
        // Filter to only active (non-released) players so count and drop UI are correct.
        setMyRoster(getCurrentRoster(await fetchTeamRosterFromDB(leagueData.id, myT.id)));
      }
    }

    setFreeAgents(getUndraftedPlayers(leagueData.id));
    setLoading(false);
  }

  function handleAddPlayer(player: Player) {
    if (!myTeam) {
      alert(t("请先加入联赛", "Join the league first"));
      return;
    }
    if (myRoster.length >= 13) {
      // Must drop a player first
      setShowAddModal(player);
      setDropPlayerId(null);
    } else {
      setShowAddModal(player);
      setDropPlayerId(null);
    }
  }

  function confirmAdd() {
    if (!league || !myTeam || !showAddModal) return;
    const needDrop = myRoster.length >= 13;
    if (needDrop && !dropPlayerId) {
      alert(t("阵容已满，请选择要放弃的球员", "Roster is full, select a player to drop"));
      return;
    }
    const result = addFreeAgent(league.id, myTeam.id, showAddModal.id, dropPlayerId || undefined);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    // Refresh data — filter to active players so count and UI stay correct
    setMyRoster(getCurrentRoster(getTeamRoster(league.id, myTeam.id)));
    setFreeAgents(getUndraftedPlayers(league.id));
    setShowAddModal(null);
    setDropPlayerId(null);
  }

  function handleDropPlayer(playerId: string) {
    if (!league || !myTeam) return;
    if (!confirm(t("确定要放弃该球员吗？", "Are you sure you want to drop this player?"))) return;
    const result = dropPlayer(league.id, myTeam.id, playerId);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setMyRoster(getCurrentRoster(getTeamRoster(league.id, myTeam.id)));
    setFreeAgents(getUndraftedPlayers(league.id));
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  const filteredAgents = freeAgents
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter !== "ALL" && !p.position.includes(posFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rank") return a.rank - b.rank;
      return (b[sortBy as keyof typeof b] as number) - (a[sortBy as keyof typeof a] as number);
    });

  if (loading) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="loading-container"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="error-container"><p>{t("联赛不存在", "League not found")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <LightHeader activeHref="/league" />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon"></span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>{t("自由市场", "Free Agents")}</h1>
            <p>{t("签约自由球员或放弃球员", "Add free agents or drop players from your roster")}</p>
          </div>

          {/* My Roster Summary */}
          {myTeam && myRoster.length > 0 && (
            <div className="my-roster-section">
              <div className="section-title">
                {t("我的阵容", "My Roster")} ({myRoster.length}/13)
                <Link href={`/league/${slug}/roster`} className="view-link">{t("查看阵容", "View Roster")}</Link>
              </div>
              <div className="roster-chips">
                {myRoster.map(p => (
                  <div key={p.id} className="roster-chip">
                    <span className="chip-name">{p.name}</span>
                    <span className="chip-pos">{p.position}</span>
                    <button className="chip-drop" onClick={() => handleDropPlayer(p.id)} title={t("放弃", "Drop")}></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="filters">
            <input
              className="search-input"
              type="text"
              placeholder={t("搜索球员...", "Search players...")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-group">
              {["ALL", "PG", "SG", "SF", "PF", "C"].map(pos => (
                <button
                  key={pos}
                  className={`filter-btn ${posFilter === pos ? "active" : ""}`}
                  onClick={() => setPosFilter(pos)}
                >
                  {pos === "ALL" ? t("全部", "All") : pos}
                </button>
              ))}
            </div>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            >
              <option value="ppg">{t("得分", "PPG")}</option>
              <option value="rpg">{t("篮板", "RPG")}</option>
              <option value="apg">{t("助攻", "APG")}</option>
              <option value="rank">{t("排名", "Rank")}</option>
            </select>
          </div>

          {/* Free Agent List */}
          <div className="fa-table">
            <div className="fa-header">
              <div className="col-rank">#</div>
              <div className="col-player">{t("球员", "Player")}</div>
              <div className="col-stat">PPG</div>
              <div className="col-stat">RPG</div>
              <div className="col-stat">APG</div>
              <div className="col-stat">SPG</div>
              <div className="col-stat">BPG</div>
              <div className="col-action"></div>
            </div>
            {filteredAgents.length === 0 && (
              <div className="empty-row">{t("没有符合条件的自由球员", "No free agents match your criteria")}</div>
            )}
            {filteredAgents.slice(0, 50).map((player) => (
              <div key={player.id} className="fa-row">
                <div className="col-rank">{player.rank}</div>
                <div className="col-player">
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">{player.team} · {player.position}{player.injury ? ` · ${player.injury}` : ""}</span>
                  </div>
                </div>
                <div className="col-stat">{player.ppg.toFixed(1)}</div>
                <div className="col-stat">{player.rpg.toFixed(1)}</div>
                <div className="col-stat">{player.apg.toFixed(1)}</div>
                <div className="col-stat">{player.spg.toFixed(1)}</div>
                <div className="col-stat">{player.bpg.toFixed(1)}</div>
                <div className="col-action">
                  {myTeam && (
                    <button className="add-btn" onClick={() => handleAddPlayer(player)}>
                      + {t("签约", "Add")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {filteredAgents.length > 50 && (
            <div className="more-hint">{t(`还有 ${filteredAgents.length - 50} 名球员...`, `${filteredAgents.length - 50} more players...`)}</div>
          )}
        </div>
      </main>

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("签约球员", "Add Player")}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(null)}></button>
            </div>
            <div className="modal-body">
              <div className="add-player-card">
                <div className="add-player-name">{showAddModal.name}</div>
                <div className="add-player-meta">{showAddModal.team} · {showAddModal.position}</div>
                <div className="add-player-stats">
                  <span>{showAddModal.ppg} PPG</span>
                  <span>{showAddModal.rpg} RPG</span>
                  <span>{showAddModal.apg} APG</span>
                </div>
              </div>

              {myRoster.length >= 13 && (
                <div className="drop-section">
                  <p className="drop-label">{t("阵容已满，请选择要放弃的球员：", "Roster is full. Select a player to drop:")}</p>
                  <div className="drop-list">
                    {myRoster.map(p => (
                      <div
                        key={p.id}
                        className={`drop-item ${dropPlayerId === p.id ? "selected" : ""}`}
                        onClick={() => setDropPlayerId(p.id)}
                      >
                        <span className="drop-name">{p.name}</span>
                        <span className="drop-meta">{PLAYER_POSITIONS[p.name] || p.position} · {p.ppg} PPG</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddModal(null)}>{t("取消", "Cancel")}</button>
              <button
                className="btn-confirm"
                onClick={confirmAdd}
                disabled={myRoster.length >= 13 && !dropPlayerId}
              >
                {myRoster.length >= 13
                  ? t("交换球员", "Swap Player")
                  : t("确认签约", "Confirm Add")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: #1e3a8a;
    border-bottom: none;
  }
  .league-header-inner { max-width: 1200px; margin: 0 auto; padding: 16px; }
  .league-title {
    display: flex; align-items: center; gap: 12px;
    color: #fff; text-decoration: none; font-size: 20px; font-weight: 600;
  }
  .league-icon { font-size: 28px; }
.page-content { min-height: calc(100vh - 200px); background: #f9fafb; padding: 24px 16px; }
  .container { max-width: 1200px; margin: 0 auto; }
  .page-header { margin-bottom: 24px; }
  .page-header h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 8px 0; }
  .page-header p { font-size: 14px; color: #6b7280; margin: 0; }

  .my-roster-section {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 20px;
  }
  .section-title {
    font-size: 14px; font-weight: 600; color: #1e3a8a; margin-bottom: 12px;
    display: flex; justify-content: space-between; align-items: center;
  }
  .view-link { font-size: 13px; color: #3b82f6; text-decoration: none; }
  .view-link:hover { text-decoration: underline; }
  .roster-chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .roster-chip {
    display: flex; align-items: center; gap: 6px; padding: 6px 10px;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 12px;
  }
  .chip-name { color: #111827; font-weight: 500; }
  .chip-pos { color: #6b7280; }
  .chip-drop {
    width: 18px; height: 18px; border-radius: 50%; border: none;
    background: rgba(239, 68, 68, 0.2); color: #f87171; font-size: 10px;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .chip-drop:hover { background: rgba(239, 68, 68, 0.4); }

  .filters {
    display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; align-items: center;
  }
  .search-input {
    flex: 1; min-width: 200px; padding: 10px 14px;
    background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
    color: #111827; font-size: 14px; outline: none;
  }
  .search-input:focus { border-color: #1e3a8a; }
  .filter-group { display: flex; gap: 4px; }
  .filter-btn {
    padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 6px; color: #6b7280; font-size: 12px; cursor: pointer;
  }
  .filter-btn.active { background: #eff6ff; border-color: #1e3a8a; color: #1e3a8a; }
  .sort-select {
    padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb;
    border-radius: 6px; color: #111827; font-size: 13px;
  }

  .fa-table { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
  .fa-header {
    display: grid; grid-template-columns: 50px 1fr 55px 55px 55px 55px 55px 80px;
    padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;
  }
  .fa-row {
    display: grid; grid-template-columns: 50px 1fr 55px 55px 55px 55px 55px 80px;
    padding: 12px 16px; border-bottom: 1px solid #f3f4f6; align-items: center;
  }
  .fa-row:last-child { border-bottom: none; }
  .fa-row:hover { background: rgba(245, 158, 11, 0.03); }
  .col-rank { font-size: 13px; color: #6b7280; text-align: center; }
  .col-player { padding: 0 8px; }
  .player-info { display: flex; flex-direction: column; gap: 2px; }
  .player-name { font-size: 14px; font-weight: 500; color: #111827; }
  .player-meta { font-size: 12px; color: #6b7280; }
  .col-stat { font-size: 13px; color: #374151; text-align: center; }
  .col-action { text-align: center; }
  .add-btn {
    padding: 6px 14px; background: #ecfdf5; border: 1px solid #6ee7b7;
    border-radius: 6px; color: #059669; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .add-btn:hover { background: #d1fae5; }
  .empty-row { padding: 40px; text-align: center; color: #6b7280; font-size: 14px; }
  .more-hint { text-align: center; padding: 16px; color: #6b7280; font-size: 13px; }

  .modal-overlay {
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6); display: flex; align-items: center;
    justify-content: center; z-index: 1000; padding: 20px;
  }
  .modal {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
    max-width: 500px; width: 100%; overflow: hidden;
  }
  .modal-header {
    padding: 20px 24px; border-bottom: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
  }
  .modal-header h3 { margin: 0; font-size: 18px; color: #111827; }
  .modal-close {
    width: 32px; height: 32px; border: none; background: #f3f4f6;
    border-radius: 50%; color: #6b7280; font-size: 16px; cursor: pointer;
  }
  .modal-body { padding: 24px; }
  .add-player-card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px;
  }
  .add-player-name { font-size: 18px; font-weight: 600; color: #111827; }
  .add-player-meta { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .add-player-stats { display: flex; gap: 16px; margin-top: 8px; font-size: 13px; color: #1e3a8a; }
  .drop-section { margin-top: 8px; }
  .drop-label { font-size: 14px; color: #dc2626; margin: 0 0 12px 0; }
  .drop-list { max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; }
  .drop-item {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px; background: #fff; border: 1px solid #e5e7eb;
    border-radius: 8px; cursor: pointer;
  }
  .drop-item:hover { border-color: #6b7280; }
  .drop-item.selected { border-color: #ef4444; background: rgba(239, 68, 68, 0.1); }
  .drop-name { font-size: 14px; color: #111827; }
  .drop-meta { font-size: 12px; color: #6b7280; }
  .modal-footer {
    padding: 16px 24px; border-top: 1px solid #e5e7eb;
    display: flex; gap: 12px; justify-content: flex-end;
  }
  .btn-cancel {
    padding: 10px 20px; background: #f3f4f6; border: 1px solid #e5e7eb;
    border-radius: 8px; color: #374151; font-weight: 600; cursor: pointer;
  }
  .btn-confirm {
    padding: 10px 20px; background: #1e3a8a; border: none;
    border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;
  }
  .btn-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

  .loading-container, .error-container {
    min-height: 50vh; display: flex; align-items: center; justify-content: center; color: #6b7280;
  }

  @media (max-width: 768px) {
    .fa-header, .fa-row {
      grid-template-columns: 40px 1fr 45px 45px 45px 45px 45px 65px;
      padding: 10px 8px;
    }
    .filters { flex-direction: column; }
    .search-input { min-width: auto; }
  }
`;
