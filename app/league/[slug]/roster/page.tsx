"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  getTeamRoster,
  getTeamLineup,
  setTeamLineup,
  autoSetLineup,
  isEligibleForSlot,
  syncTradeRosters,
  loadAllRostersFromSupabase,
  League,
  LeagueMember,
  RosterPlayer,
  LineupMap,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";

const SLOT_LABELS: Record<string, { label: string; labelEn: string; type: "starter" | "bench" }> = {
  PG: { label: "控卫", labelEn: "PG", type: "starter" },
  SG: { label: "分卫", labelEn: "SG", type: "starter" },
  SF: { label: "小前", labelEn: "SF", type: "starter" },
  PF: { label: "大前", labelEn: "PF", type: "starter" },
  C: { label: "中锋", labelEn: "C", type: "starter" },
  G: { label: "后卫", labelEn: "G", type: "starter" },
  F: { label: "前锋", labelEn: "F", type: "starter" },
  UTIL1: { label: "机动1", labelEn: "UTIL", type: "starter" },
  UTIL2: { label: "机动2", labelEn: "UTIL", type: "starter" },
  BE1: { label: "板凳1", labelEn: "BE", type: "bench" },
  BE2: { label: "板凳2", labelEn: "BE", type: "bench" },
  BE3: { label: "板凳3", labelEn: "BE", type: "bench" },
  BE4: { label: "板凳4", labelEn: "BE", type: "bench" },
};

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "BE1", "BE2", "BE3", "BE4"];

export default function RosterPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [loading, setLoading] = useState(true);
  const [swapSource, setSwapSource] = useState<string | null>(null); // slot name being swapped
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; user_id: string }[]>([]);
  const [allRosters, setAllRosters] = useState<Record<string, RosterPlayer[]>>({});

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData);

    // Get all teams in this league
    const { data: teamsData } = await supabase
      .from("fantasy_teams")
      .select("id, name, user_id")
      .eq("league_id", leagueData.id);
    setAllTeams(teamsData || []);

    // Load all rosters from Supabase so we can view any team
    const supabaseRosters = await loadAllRostersFromSupabase(leagueData.id);
    setAllRosters(supabaseRosters);

    const currentUser = getSessionUser();
    if (currentUser && teamsData) {
      const myT = teamsData.find((t: { user_id: string }) => t.user_id === currentUser.id);
      if (myT) {
        setMyTeam(myT);
        const teamId = myT.id;
        setViewTeamId(teamId);
        // Sync rosters from accepted trades before loading local roster
        await syncTradeRosters(leagueData.id, teamId);
        const rosterData = getTeamRoster(leagueData.id, teamId);
        setRoster(rosterData);
        let lineupData = getTeamLineup(leagueData.id, teamId);
        if (Object.keys(lineupData).length === 0 && rosterData.length > 0) {
          lineupData = autoSetLineup(leagueData.id, teamId);
        }
        setLineup(lineupData);
      } else {
        // User is not in the league, show first team
        if (teamsData.length > 0) {
          const firstTeam = teamsData[0];
          setViewTeamId(firstTeam.id);
          setRoster(supabaseRosters[firstTeam.id] || []);
        }
      }
    } else if (teamsData && teamsData.length > 0) {
      // Not logged in, show first team
      setViewTeamId(teamsData[0].id);
      setRoster(supabaseRosters[teamsData[0].id] || []);
    }
    setLoading(false);
  }

  function switchViewTeam(teamId: string) {
    if (!league) return;
    setViewTeamId(teamId);
    // For own team, use localStorage; for others, use Supabase data
    const isOwn = teamId === myTeam?.id;
    const rosterData = isOwn ? getTeamRoster(league.id, teamId) : (allRosters[teamId] || []);
    setRoster(rosterData);
    const lineupData = getTeamLineup(league.id, teamId);
    setLineup(lineupData);
    setSwapSource(null);
  }

  function getPlayerInSlot(slot: string): RosterPlayer | undefined {
    const playerId = lineup[slot];
    if (!playerId) return undefined;
    return roster.find(p => p.id === playerId);
  }

  function getUnassignedPlayers(): RosterPlayer[] {
    const assignedIds = new Set(Object.values(lineup));
    return roster.filter(p => !assignedIds.has(p.id));
  }

  function handleSlotClick(slot: string) {
    if (viewTeamId !== myTeam?.id) return; // Can only edit own team
    if (swapSource === null) {
      setSwapSource(slot);
    } else if (swapSource === slot) {
      setSwapSource(null);
    } else {
      // Swap the two slots
      if (!league || !myTeam) return;
      const newLineup = { ...lineup };
      const playerA = newLineup[swapSource];
      const playerB = newLineup[slot];

      // Check eligibility
      const playerAData = roster.find(p => p.id === playerA);
      const playerBData = roster.find(p => p.id === playerB);

      let canSwap = true;
      if (playerA && !isEligibleForSlot(playerAData?.position || "", slot)) canSwap = false;
      if (playerB && !isEligibleForSlot(playerBData?.position || "", swapSource)) canSwap = false;

      if (!canSwap) {
        alert(t("位置不符合要求，无法交换", "Position not eligible for this slot"));
        setSwapSource(null);
        return;
      }

      newLineup[swapSource] = playerB || "";
      newLineup[slot] = playerA || "";

      // Remove empty entries
      for (const k of Object.keys(newLineup)) {
        if (!newLineup[k]) delete newLineup[k];
      }

      setLineup(newLineup);
      setTeamLineup(league.id, myTeam.id, newLineup);
      setSwapSource(null);
    }
  }

  function handleAssignPlayer(playerId: string) {
    if (!league || !myTeam || !swapSource) return;
    const player = roster.find(p => p.id === playerId);
    if (!player) return;
    if (!isEligibleForSlot(player.position, swapSource)) {
      alert(t("位置不符合要求", "Position not eligible"));
      return;
    }
    // Remove from old slot if exists
    const newLineup = { ...lineup };
    for (const [slot, pid] of Object.entries(newLineup)) {
      if (pid === playerId) delete newLineup[slot];
    }
    newLineup[swapSource] = playerId;
    setLineup(newLineup);
    setTeamLineup(league.id, myTeam.id, newLineup);
    setSwapSource(null);
  }

  function handleAutoLineup() {
    if (!league || !myTeam) return;
    const newLineup = autoSetLineup(league.id, myTeam.id);
    setLineup(newLineup);
  }

  const isOwner = user && league && league.commissioner_id === user.id;
  const isMyTeam = viewTeamId === myTeam?.id;

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="loading-container"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app">
        <Header />
        <div className="error-container"><p>{t("联赛不存在", "League not found")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const starters = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "starter");
  const bench = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "bench");
  const unassigned = getUnassignedPlayers();

  return (
    <div className="app">
      <Header />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon">🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <div className="page-header-top">
              <div>
                <h1>📋 {t("阵容管理", "Roster")}</h1>
                <p>{t("管理你的首发和板凳阵容", "Manage your starting lineup and bench")}</p>
              </div>
              {isMyTeam && (
                <button className="auto-btn" onClick={handleAutoLineup}>
                  {t("自动排阵", "Auto Set")}
                </button>
              )}
            </div>
          </div>

          {/* Team selector */}
          {allTeams.length > 1 && (
            <div className="team-selector">
              {allTeams.map((team) => (
                <button
                  key={team.id}
                  className={`team-tab ${viewTeamId === team.id ? "active" : ""}`}
                  onClick={() => switchViewTeam(team.id)}
                >
                  {team.name}
                  {team.id === myTeam?.id && <span className="my-badge">{t("我", "Me")}</span>}
                </button>
              ))}
            </div>
          )}

          {roster.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <p>{t("该队伍还没有球员。请先完成选秀。", "No players on this team yet. Complete the draft first.")}</p>
              <Link href={`/league/${slug}`} className="back-link">
                {t("返回联赛", "Back to League")}
              </Link>
            </div>
          ) : (
            <>
              {swapSource && isMyTeam && (
                <div className="swap-hint">
                  {t("点击另一个位置来交换球员，或点击未分配的球员放入该位置", "Click another slot to swap, or click an unassigned player to place")}
                  <button className="cancel-swap" onClick={() => setSwapSource(null)}>{t("取消", "Cancel")}</button>
                </div>
              )}

              {/* Starters */}
              <div className="section-label">{t("首发阵容", "Starting Lineup")} ({starters.length})</div>
              <div className="lineup-table">
                <div className="lineup-header">
                  <div className="col-slot">{t("位置", "Slot")}</div>
                  <div className="col-player">{t("球员", "Player")}</div>
                  <div className="col-stat">PPG</div>
                  <div className="col-stat">RPG</div>
                  <div className="col-stat">APG</div>
                  <div className="col-stat">SPG</div>
                  <div className="col-stat">BPG</div>
                  <div className="col-stat">FG%</div>
                </div>
                {starters.map(slot => {
                  const player = getPlayerInSlot(slot);
                  const slotInfo = SLOT_LABELS[slot];
                  const isSwapTarget = swapSource === slot;
                  return (
                    <div
                      key={slot}
                      className={`lineup-row ${isSwapTarget ? "swap-active" : ""} ${isMyTeam ? "clickable" : ""}`}
                      onClick={() => isMyTeam && handleSlotClick(slot)}
                    >
                      <div className="col-slot">
                        <span className="slot-badge starter">{slotInfo.labelEn}</span>
                      </div>
                      <div className="col-player">
                        {player ? (
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-meta">{player.team} · {player.position}</span>
                          </div>
                        ) : (
                          <span className="empty-slot">{t("空位", "Empty")}</span>
                        )}
                      </div>
                      <div className="col-stat">{player ? player.ppg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.rpg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.apg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.spg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.bpg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.fg.toFixed(1) : "-"}</div>
                    </div>
                  );
                })}
              </div>

              {/* Bench */}
              <div className="section-label">{t("板凳", "Bench")} ({bench.length})</div>
              <div className="lineup-table">
                <div className="lineup-header">
                  <div className="col-slot">{t("位置", "Slot")}</div>
                  <div className="col-player">{t("球员", "Player")}</div>
                  <div className="col-stat">PPG</div>
                  <div className="col-stat">RPG</div>
                  <div className="col-stat">APG</div>
                  <div className="col-stat">SPG</div>
                  <div className="col-stat">BPG</div>
                  <div className="col-stat">FG%</div>
                </div>
                {bench.map(slot => {
                  const player = getPlayerInSlot(slot);
                  const slotInfo = SLOT_LABELS[slot];
                  const isSwapTarget = swapSource === slot;
                  return (
                    <div
                      key={slot}
                      className={`lineup-row ${isSwapTarget ? "swap-active" : ""} ${isMyTeam ? "clickable" : ""}`}
                      onClick={() => isMyTeam && handleSlotClick(slot)}
                    >
                      <div className="col-slot">
                        <span className="slot-badge bench">{slotInfo.labelEn}</span>
                      </div>
                      <div className="col-player">
                        {player ? (
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-meta">{player.team} · {player.position}</span>
                          </div>
                        ) : (
                          <span className="empty-slot">{t("空位", "Empty")}</span>
                        )}
                      </div>
                      <div className="col-stat">{player ? player.ppg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.rpg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.apg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.spg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.bpg.toFixed(1) : "-"}</div>
                      <div className="col-stat">{player ? player.fg.toFixed(1) : "-"}</div>
                    </div>
                  );
                })}
              </div>

              {/* Unassigned players */}
              {unassigned.length > 0 && isMyTeam && (
                <>
                  <div className="section-label">{t("未分配球员", "Unassigned")} ({unassigned.length})</div>
                  <div className="lineup-table">
                    {unassigned.map(player => (
                      <div
                        key={player.id}
                        className={`lineup-row ${swapSource ? "clickable highlight" : ""}`}
                        onClick={() => swapSource && handleAssignPlayer(player.id)}
                      >
                        <div className="col-slot">
                          <span className="slot-badge unassigned">-</span>
                        </div>
                        <div className="col-player">
                          <div className="player-info">
                            <span className="player-name">{player.name}</span>
                            <span className="player-meta">{player.team} · {player.position}</span>
                          </div>
                        </div>
                        <div className="col-stat">{player.ppg.toFixed(1)}</div>
                        <div className="col-stat">{player.rpg.toFixed(1)}</div>
                        <div className="col-stat">{player.apg.toFixed(1)}</div>
                        <div className="col-stat">{player.spg.toFixed(1)}</div>
                        <div className="col-stat">{player.bpg.toFixed(1)}</div>
                        <div className="col-stat">{player.fg.toFixed(1)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Team totals */}
              <div className="section-label">{t("球队总计", "Team Totals")}</div>
              <div className="totals-card">
                <div className="total-item">
                  <span className="total-value">{roster.reduce((s, p) => s + p.ppg, 0).toFixed(1)}</span>
                  <span className="total-label">PPG</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{roster.reduce((s, p) => s + p.rpg, 0).toFixed(1)}</span>
                  <span className="total-label">RPG</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{roster.reduce((s, p) => s + p.apg, 0).toFixed(1)}</span>
                  <span className="total-label">APG</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{roster.reduce((s, p) => s + p.spg, 0).toFixed(1)}</span>
                  <span className="total-label">SPG</span>
                </div>
                <div className="total-item">
                  <span className="total-value">{roster.reduce((s, p) => s + p.bpg, 0).toFixed(1)}</span>
                  <span className="total-label">BPG</span>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: linear-gradient(135deg, #1a237e 0%, #0d1442 100%);
    border-bottom: 1px solid #283593;
  }
  .league-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
  }
  .league-title {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }
  .league-icon { font-size: 28px; }
  .league-nav {
    background: #111;
    border-bottom: 1px solid #222;
    position: sticky;
    top: 60px;
    z-index: 40;
  }
  .league-nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    padding: 0 16px;
    overflow-x: auto;
  }
  .league-nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 16px;
    color: #888;
    text-decoration: none;
    font-size: 14px;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }
  .league-nav-link:hover { color: #fff; }
  .league-nav-link.active {
    color: #f59e0b;
    border-bottom-color: #f59e0b;
  }
  .page-content {
    min-height: calc(100vh - 200px);
    background: #0a0a0a;
    padding: 24px 16px;
  }
  .container {
    max-width: 1200px;
    margin: 0 auto;
  }
  .page-header { margin-bottom: 24px; }
  .page-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }
  .page-header p {
    font-size: 14px;
    color: #888;
    margin: 0;
  }
  .auto-btn {
    padding: 10px 20px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
    cursor: pointer;
  }
  .auto-btn:hover { opacity: 0.9; }
  .team-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 20px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .team-tab {
    padding: 8px 16px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    color: #888;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .team-tab.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }
  .my-badge {
    background: #f59e0b;
    color: #000;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }
  .swap-hint {
    background: rgba(59, 130, 246, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 12px 16px;
    border-radius: 8px;
    color: #93c5fd;
    font-size: 14px;
    margin-bottom: 16px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cancel-swap {
    padding: 4px 12px;
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px;
    color: #fca5a5;
    cursor: pointer;
    font-size: 13px;
  }
  .section-label {
    font-size: 14px;
    font-weight: 600;
    color: #f59e0b;
    margin: 24px 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .lineup-table {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    overflow: hidden;
  }
  .lineup-header {
    display: grid;
    grid-template-columns: 70px 1fr 60px 60px 60px 60px 60px 60px;
    padding: 12px 16px;
    background: #1a1a1a;
    border-bottom: 1px solid #222;
    font-size: 12px;
    font-weight: 600;
    color: #888;
    text-transform: uppercase;
  }
  .lineup-row {
    display: grid;
    grid-template-columns: 70px 1fr 60px 60px 60px 60px 60px 60px;
    padding: 12px 16px;
    border-bottom: 1px solid #1a1a1a;
    align-items: center;
    transition: background 0.15s;
  }
  .lineup-row:last-child { border-bottom: none; }
  .lineup-row.clickable { cursor: pointer; }
  .lineup-row.clickable:hover { background: rgba(245, 158, 11, 0.05); }
  .lineup-row.swap-active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }
  .lineup-row.highlight { background: rgba(245, 158, 11, 0.05); }
  .col-slot { display: flex; align-items: center; }
  .slot-badge {
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
  }
  .slot-badge.starter { background: rgba(59, 130, 246, 0.2); color: #93c5fd; }
  .slot-badge.bench { background: rgba(100, 116, 139, 0.2); color: #94a3b8; }
  .slot-badge.unassigned { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
  .col-player { padding: 0 8px; }
  .player-info { display: flex; flex-direction: column; gap: 2px; }
  .player-name { font-size: 14px; font-weight: 500; color: #fff; }
  .player-meta { font-size: 12px; color: #888; }
  .col-stat { font-size: 13px; color: #ccc; text-align: center; }
  .empty-slot { font-size: 13px; color: #555; font-style: italic; }
  .totals-card {
    display: flex;
    gap: 24px;
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    padding: 20px;
    margin-top: 8px;
    flex-wrap: wrap;
  }
  .total-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    flex: 1;
    min-width: 60px;
  }
  .total-value { font-size: 20px; font-weight: 700; color: #f59e0b; }
  .total-label { font-size: 12px; color: #888; }
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #888;
  }
  .empty-icon { font-size: 64px; margin-bottom: 16px; }
  .back-link {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 24px;
    background: #f59e0b;
    color: #000;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }
  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }
  @media (max-width: 768px) {
    .lineup-header, .lineup-row {
      grid-template-columns: 50px 1fr 45px 45px 45px 45px 45px 45px;
      padding: 10px 8px;
      font-size: 12px;
    }
    .col-stat { font-size: 11px; }
    .totals-card { gap: 12px; padding: 16px; }
  }
`;
