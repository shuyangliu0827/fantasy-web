"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang"
import { translateTeam } from "@/lib/i18n";
import PlayerAvatar from "@/components/PlayerAvatar";
import { PLAYER_POSITIONS } from "@/lib/player-positions";
import { getCanonicalPlayerPosition, normalizePosition, toCanonicalPlayerKey } from "@/lib/player-metadata";
import {
  getSessionUser,
  getLeagueBySlug,
  fetchUndraftedPlayersFromDB,
  getTeamRoster,
  fetchTeamRosterFromDB,
  addFreeAgent,
  dropPlayer,
  getCurrentRoster,
  getPickupCount,
  syncPickupCountFromDB,
  WEEKLY_PICKUP_LIMIT,
  League,
  Player,
  RosterPlayer,
  supabase,
} from "@/lib/store";

// Live stats from /api/nba-stats — same canonical path as rankings / cheat sheet / trade.
type LiveFAStats = {
  team?: string;
  position?: string;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  rank: number;
  injury?: string;
};

const POSITION_OVERRIDE_BY_KEY = new Map(
  Object.entries(PLAYER_POSITIONS).map(([name, pos]) => [toCanonicalPlayerKey(name), pos])
);

export default function FreeAgentsPage() {
  const { t, lang } = useLang();
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
  const [pickupCount, setPickupCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Live stats keyed by canonical player name — same source as rankings / cheat sheet / trade.
  const [liveStatsMap, setLiveStatsMap] = useState<Map<string, LiveFAStats>>(new Map());

  type FreeAgentDisplayRow = {
    player: Player;
    name: string;
    team: string;
    position: string;
    ppg: number;
    rpg: number;
    apg: number;
    spg: number;
    bpg: number;
    rank: number;
    injury?: string;
  };

  async function fetchLiveStats(): Promise<Map<string, LiveFAStats>> {
    try {
      const res = await fetch("/api/nba-stats", { cache: "no-store" });
      const data = await res.json();
      if (data.status === "success" && data.players) {
        const map = new Map<string, LiveFAStats>();
        for (const p of data.players) {
          map.set(toCanonicalPlayerKey(p.name as string), {
            team: p.team,
            position: p.position,
            ppg: p.averages.pts,
            rpg: p.averages.reb,
            apg: p.averages.ast,
            spg: p.averages.stl,
            bpg: p.averages.blk,
            rank: p.rank,
            injury: p.injury ?? undefined,
          });
        }
        return map;
      }
    } catch {
      // Non-fatal: fall back to showing "—" for stats
    }
    return new Map();
  }

  const loadData = useCallback(async () => {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData);

    const currentUser = getSessionUser();
    setUser(currentUser);
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
        // Sync pickup counts from DB then read local count
        const { data: teamRow } = await supabase
          .from("fantasy_teams")
          .select("pickup_counts")
          .eq("id", myT.id)
          .single();
        if (teamRow?.pickup_counts) {
          syncPickupCountFromDB(myT.id, leagueData.id, teamRow.pickup_counts);
        }
        setPickupCount(getPickupCount(leagueData.id, myT.id));
      }
    }

    // Fetch free-agent pool (ownership from DB) and live stats in parallel.
    // Pool identifies WHO is a free agent; live stats supply current-season display values.
    const [pool, liveMap] = await Promise.all([
      fetchUndraftedPlayersFromDB(leagueData.id),
      fetchLiveStats(),
    ]);
    setFreeAgents(pool);
    setLiveStatsMap(liveMap);
    setLoading(false);
  }, [slug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

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

  async function confirmAdd() {
    if (!league || !myTeam || !showAddModal) return;
    const needDrop = myRoster.length >= 13;
    if (needDrop && !dropPlayerId) {
      alert(t("阵容已满，请选择要放弃的球员", "Roster is full, select a player to drop"));
      return;
    }
    const result = await addFreeAgent(league.id, myTeam.id, showAddModal.id, dropPlayerId || undefined);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    // Refresh data — read from DB so the list is authoritative for all users
    setMyRoster(getCurrentRoster(getTeamRoster(league.id, myTeam.id)));
    setFreeAgents(await fetchUndraftedPlayersFromDB(league.id));
    setPickupCount(getPickupCount(league.id, myTeam.id));
    setShowAddModal(null);
    setDropPlayerId(null);
  }

  async function handleDropPlayer(playerId: string) {
    if (!league || !myTeam) return;
    if (!confirm(t("确定要放弃该球员吗？", "Are you sure you want to drop this player?"))) return;
    const result = await dropPlayer(league.id, myTeam.id, playerId);
    if (!result.ok) {
      alert(result.error);
      return;
    }
    setMyRoster(getCurrentRoster(getTeamRoster(league.id, myTeam.id)));
    setFreeAgents(await fetchUndraftedPlayersFromDB(league.id));
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  // Helper: get live stat value for a player, falling back to static Player field if no live data loaded.
  function buildDisplayRow(player: Player): FreeAgentDisplayRow {
    const canonicalName = toCanonicalPlayerKey(player.name);
    const live = liveStatsMap.get(canonicalName);
    const overridePos = POSITION_OVERRIDE_BY_KEY.get(canonicalName);
    const displayPosition = normalizePosition(overridePos || live?.position || player.position);

    if (live) {
      return {
        player,
        name: player.name,
        team: live.team || player.team,
        position: displayPosition,
        ppg: live.ppg,
        rpg: live.rpg,
        apg: live.apg,
        spg: live.spg,
        bpg: live.bpg,
        rank: live.rank,
        injury: live.injury ?? player.injury,
      };
    }
    return {
      player,
      name: player.name,
      team: player.team,
      position: displayPosition,
      ppg: player.ppg,
      rpg: player.rpg,
      apg: player.apg,
      spg: player.spg,
      bpg: player.bpg,
      rank: player.rank,
      injury: player.injury,
    };
  }

  const displayRows = freeAgents.map(buildDisplayRow);
  const filteredAgents = displayRows
    .filter(row => {
      if (search && !row.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (posFilter !== "ALL" && !row.position.includes(posFilter)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "rank") return a.rank - b.rank;
      return b[sortBy] - a[sortBy];
    });

  const totalPages = Math.ceil(filteredAgents.length / pageSize);
  const paginatedAgents = filteredAgents.slice((page - 1) * pageSize, page * pageSize);

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

          {myTeam && (
            <div className={`pickup-limit-bar ${pickupCount >= WEEKLY_PICKUP_LIMIT ? "limit-reached" : ""}`}>
              <span className="pickup-label">
                {t("本周签约次数", "Weekly pickups")}：
                <strong>{pickupCount}/{WEEKLY_PICKUP_LIMIT}</strong>
              </span>
              {pickupCount >= WEEKLY_PICKUP_LIMIT && (
                <span className="pickup-warning">
                  {t("本周签约次数已达上限，下周一重置", "Weekly limit reached. Resets on Monday.")}
                </span>
              )}
            </div>
          )}

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
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            <div className="filter-group">
              {["ALL", "PG", "SG", "SF", "PF", "C"].map(pos => (
                <button
                  key={pos}
                  className={`filter-btn ${posFilter === pos ? "active" : ""}`}
                  onClick={() => { setPosFilter(pos); setPage(1); }}
                >
                  {pos === "ALL" ? t("全部", "All") : pos}
                </button>
              ))}
            </div>
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value as typeof sortBy); setPage(1); }}
            >
              <option value="ppg">{t("得分", "PPG")}</option>
              <option value="rpg">{t("篮板", "RPG")}</option>
              <option value="apg">{t("助攻", "APG")}</option>
              <option value="rank">{t("排名", "Rank")}</option>
            </select>
          </div>

          {/* Free Agent List */}
          <div className="fa-table">
            <div style={{ fontSize: 11, color: "#9ca3af", padding: "6px 12px 2px", fontStyle: "italic" }}>
              {liveStatsMap.size > 0
                ? t("当前赛季实时数据", "Current-season stats")
                : t("统计数据为赛季参考值", "Stats are season reference values")}
            </div>
            <div className="fa-scroll-wrapper">
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
            {paginatedAgents.map((row) => {
              const player = row.player;
              const fmt = (val: number | undefined) => val != null ? val.toFixed(1) : "—";
              return (
              <div key={player.id} className="fa-row">
                <div className="col-rank">{row.rank}</div>
                <div className="col-player" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <PlayerAvatar name={player.name} size={32} />
                  <div className="player-info">
                    <span className="player-name">{player.name}</span>
                    <span className="player-meta">{translateTeam(row.team, lang)} · {row.position}{row.injury ? ` · ${row.injury}` : ""}</span>
                  </div>
                </div>
                <div className="col-stat">{fmt(row.ppg)}</div>
                <div className="col-stat">{fmt(row.rpg)}</div>
                <div className="col-stat">{fmt(row.apg)}</div>
                <div className="col-stat">{fmt(row.spg)}</div>
                <div className="col-stat">{fmt(row.bpg)}</div>
                <div className="col-action">
                  {myTeam && (
                    pickupCount >= WEEKLY_PICKUP_LIMIT ? (
                      <span className="add-btn-disabled" title={t("本周签约次数已达上限", "Weekly pickup limit reached")}>
                        {t("已达上限", "Limit")}
                      </span>
                    ) : (
                      <button className="add-btn" onClick={() => handleAddPlayer(player)}>
                        + {t("签约", "Add")}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
            })}
            </div>
          </div>
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ← {t("上一页", "Prev")}
              </button>
              {(() => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                const end = Math.min(totalPages, start + 4);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(pageNum => (
                  <button
                    key={pageNum}
                    className={`page-num ${pageNum === page ? "active" : ""}`}
                    onClick={() => setPage(pageNum)}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                {t("下一页", "Next")} →
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const addRow = buildDisplayRow(showAddModal);
              return (
                <>
            <div className="modal-header">
              <h3>{t("签约球员", "Add Player")}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(null)}></button>
            </div>
            <div className="modal-body">
              <div className="add-player-card">
                <div className="add-player-name">{showAddModal.name}</div>
                <div className="add-player-meta">{translateTeam(addRow.team, lang)} · {addRow.position}</div>
                <div className="add-player-stats">
                  {(() => {
                    const ppg = addRow.ppg.toFixed(1);
                    const rpg = addRow.rpg.toFixed(1);
                    const apg = addRow.apg.toFixed(1);
                    return (<><span>{ppg} PPG</span><span>{rpg} RPG</span><span>{apg} APG</span></>);
                  })()}
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
                        <span className="drop-meta">{getCanonicalPlayerPosition(p.name, p.position)} · {p.ppg} PPG</span>
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
                </>
              );
            })()}
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

  .fa-table { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; }
  .fa-scroll-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }
  .fa-scroll-wrapper::-webkit-scrollbar { display: none; }
  .fa-header {
    display: grid; grid-template-columns: 50px 1fr 55px 55px 55px 55px 55px 80px;
    padding: 12px 16px; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase;
    min-width: 560px; white-space: nowrap;
  }
  .fa-row {
    display: grid; grid-template-columns: 50px 1fr 55px 55px 55px 55px 55px 80px;
    padding: 12px 16px; border-bottom: 1px solid #f3f4f6; align-items: center;
    min-width: 560px;
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
  .pickup-limit-bar {
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    padding: 10px 16px; margin-bottom: 16px;
    background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px;
    font-size: 14px; color: #1e3a8a;
  }
  .pickup-limit-bar.limit-reached {
    background: #fef2f2; border-color: #fecaca; color: #991b1b;
  }
  .pickup-label strong { font-weight: 700; }
  .pickup-warning { font-size: 13px; color: #dc2626; }
  .add-btn {
    padding: 6px 14px; background: #ecfdf5; border: 1px solid #6ee7b7;
    border-radius: 6px; color: #059669; font-size: 12px; font-weight: 600; cursor: pointer;
  }
  .add-btn-disabled {
    padding: 6px 14px; background: #f3f4f6; border: 1px solid #d1d5db;
    border-radius: 6px; color: #9ca3af; font-size: 12px; font-weight: 600;
    cursor: not-allowed; display: inline-block;
  }
  .add-btn:hover { background: #d1fae5; }
  .empty-row { padding: 40px; text-align: center; color: #6b7280; font-size: 14px; }
  .more-hint { text-align: center; padding: 16px; color: #6b7280; font-size: 13px; }
  .pagination { display: flex; justify-content: center; align-items: center; gap: 6px; margin-top: 20px; padding-bottom: 20px; }
  .page-btn { padding: 7px 14px; font-size: 13px; background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; color: #374151; }
  .page-btn:disabled { cursor: not-allowed; color: #d1d5db; }
  .page-num { width: 36px; height: 36px; font-size: 13px; border-radius: 8px; cursor: pointer; border: 1px solid #e5e7eb; background: #fff; color: #374151; display: flex; align-items: center; justify-content: center; }
  .page-num.active { background: #1e3a8a; color: #fff; border: none; font-weight: 700; }

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
      padding: 10px 8px;
    }
    .filters { flex-direction: column; align-items: stretch; }
    .search-input { min-width: auto; width: 100%; }
    .filter-group {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .filter-group::-webkit-scrollbar { display: none; }
    .sort-select { width: 100%; }
    .page-content { padding: 16px 8px 48px; }
  }
`;
