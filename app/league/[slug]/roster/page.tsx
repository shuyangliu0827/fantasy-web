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
  getTeamRoster,
  getTeamLineup,
  setTeamLineup,
  autoSetLineup,
  isEligibleForSlot,
  League,
  RosterPlayer,
  LineupMap,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";

// ── Types ──

type GameInfo = {
  opponent: string;
  isHome: boolean;
  status: string;
  homeScore: number;
  visitorScore: number;
};

type TeamGamesMap = Record<string, Record<string, GameInfo>>;

type CachedPlayerStats = {
  id: number;
  name: string;
  team: string;
  averages: {
    min: number; fgm: number; fga: number; fg3m: number;
    ftm: number; fta: number; reb: number; ast: number;
    stl: number; blk: number; tov: number; pts: number;
  };
  fptsAvg: number;
};

// ── Constants ──

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

const DAY_NAMES_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_NAMES_ZH = ["日", "一", "二", "三", "四", "五", "六"];

// ── Helpers ──

function formatDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekDates(start: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function getTodayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ── Component ──

export default function RosterPage() {
  const { t, lang } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  // Existing state
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<{ id: string; name: string } | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [lineup, setLineup] = useState<LineupMap>({});
  const [loading, setLoading] = useState(true);
  const [swapSource, setSwapSource] = useState<string | null>(null);
  const [viewTeamId, setViewTeamId] = useState<string | null>(null);
  const [allTeams, setAllTeams] = useState<{ id: string; name: string; user_id: string }[]>([]);

  // New state for schedule & stats
  const [weekStart, setWeekStart] = useState<Date>(getTodayStart());
  const [selectedDate, setSelectedDate] = useState<string>(formatDateStr(new Date()));
  const [teamGames, setTeamGames] = useState<TeamGamesMap>({});
  const [playerStats, setPlayerStats] = useState<Map<string, CachedPlayerStats>>(new Map());
  const [gamesLoading, setGamesLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Data fetching ──

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
    fetchPlayerStats();
  }, [slug]);

  useEffect(() => {
    fetchGames(weekStart);
  }, [weekStart]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData);

    const { data: teamsData } = await supabase
      .from("fantasy_teams")
      .select("id, name, user_id")
      .eq("league_id", leagueData.id);
    setAllTeams(teamsData || []);

    const currentUser = getSessionUser();
    if (currentUser && teamsData) {
      const myT = teamsData.find((t: { user_id: string }) => t.user_id === currentUser.id);
      if (myT) {
        setMyTeam(myT);
        const teamId = myT.id;
        setViewTeamId(teamId);
        const rosterData = getTeamRoster(leagueData.id, teamId);
        setRoster(rosterData);
        let lineupData = getTeamLineup(leagueData.id, teamId);
        if (Object.keys(lineupData).length === 0 && rosterData.length > 0) {
          lineupData = autoSetLineup(leagueData.id, teamId);
        }
        setLineup(lineupData);
      }
    }
    setLoading(false);
  }

  async function fetchPlayerStats() {
    try {
      const res = await fetch("/api/nba-stats");
      const data = await res.json();
      if (data.status === "success" && data.players) {
        const map = new Map<string, CachedPlayerStats>();
        for (const p of data.players) {
          map.set(String(p.id), p);
        }
        setPlayerStats(map);
      }
    } catch (err) {
      console.error("Failed to fetch player stats:", err);
    } finally {
      setStatsLoading(false);
    }
  }

  async function fetchGames(start: Date) {
    setGamesLoading(true);
    const endDate = new Date(start);
    endDate.setDate(start.getDate() + 6);
    try {
      const res = await fetch(
        `/api/nba-games?start_date=${formatDateStr(start)}&end_date=${formatDateStr(endDate)}`
      );
      const data = await res.json();
      if (data.status === "success" && data.games) {
        setTeamGames(data.games);
      }
    } catch (err) {
      console.error("Failed to fetch games:", err);
    } finally {
      setGamesLoading(false);
    }
  }

  // ── Lineup logic (unchanged) ──

  function switchViewTeam(teamId: string) {
    if (!league) return;
    setViewTeamId(teamId);
    const rosterData = getTeamRoster(league.id, teamId);
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
    if (viewTeamId !== myTeam?.id) return;
    if (swapSource === null) {
      setSwapSource(slot);
    } else if (swapSource === slot) {
      setSwapSource(null);
    } else {
      if (!league || !myTeam) return;
      const newLineup = { ...lineup };
      const playerA = newLineup[swapSource];
      const playerB = newLineup[slot];

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

  // ── Schedule & stats helpers ──

  function getGameForPlayer(player: RosterPlayer): GameInfo | null {
    const teamSchedule = teamGames[player.team];
    if (!teamSchedule) return null;
    return teamSchedule[selectedDate] || null;
  }

  function getStatsForPlayer(player: RosterPlayer): CachedPlayerStats | null {
    // Try direct ID match first
    const byId = playerStats.get(player.id);
    if (byId) return byId;
    // Fallback: match by name (in case IDs don't align)
    for (const s of playerStats.values()) {
      if (s.name === player.name) return s;
    }
    return null;
  }

  // ── Date navigation ──

  const weekDates = getWeekDates(weekStart);
  const todayStr = formatDateStr(new Date());

  function shiftWeek(direction: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + direction * 7);
    setWeekStart(next);
    // Select the first day of the new week
    setSelectedDate(formatDateStr(next));
  }

  // ── Computed values ──

  const isOwner = user && league && league.commissioner_id === user.id;
  const isMyTeam = viewTeamId === myTeam?.id;
  const starterSlots = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "starter");
  const benchSlots = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "bench");
  const unassigned = getUnassignedPlayers();

  // Calculate starter totals from live stats
  const starterTotals = starterSlots.reduce(
    (acc, slot) => {
      const player = getPlayerInSlot(slot);
      if (!player) return acc;
      const stats = getStatsForPlayer(player);
      if (!stats) return acc;
      const a = stats.averages;
      return {
        min: acc.min + a.min,
        fgm: acc.fgm + a.fgm,
        fga: acc.fga + a.fga,
        ftm: acc.ftm + a.ftm,
        fta: acc.fta + a.fta,
        fg3m: acc.fg3m + a.fg3m,
        reb: acc.reb + a.reb,
        ast: acc.ast + a.ast,
        stl: acc.stl + a.stl,
        blk: acc.blk + a.blk,
        tov: acc.tov + a.tov,
        pts: acc.pts + a.pts,
        fpts: acc.fpts + stats.fptsAvg,
      };
    },
    { min: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, fg3m: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 0 }
  );

  // ── Render helpers ──

  function renderGameCell(player: RosterPlayer | undefined) {
    if (!player) return <div className="col-schedule dim">--</div>;
    const game = getGameForPlayer(player);
    if (!game) return <div className="col-schedule dim">--</div>;

    const label = game.isHome ? `vs ${game.opponent}` : `@${game.opponent}`;
    const isFinal = game.status === "Final";
    const score = isFinal
      ? `${game.isHome ? game.homeScore : game.visitorScore}-${game.isHome ? game.visitorScore : game.homeScore}`
      : null;

    return (
      <div className="col-schedule">
        <span className="opp-label">{label}</span>
        {score && <span className="game-score">{score}</span>}
      </div>
    );
  }

  function renderStatCells(player: RosterPlayer | undefined) {
    const stats = player ? getStatsForPlayer(player) : null;
    if (!stats) {
      return (
        <>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
          <div className="col-stat detail">-</div>
        </>
      );
    }
    const a = stats.averages;
    return (
      <>
        <div className="col-stat detail">{a.min.toFixed(1)}</div>
        <div className="col-stat detail compound">{a.fgm.toFixed(1)}/{a.fga.toFixed(1)}</div>
        <div className="col-stat detail compound">{a.ftm.toFixed(1)}/{a.fta.toFixed(1)}</div>
        <div className="col-stat detail">{a.fg3m.toFixed(1)}</div>
        <div className="col-stat detail">{a.reb.toFixed(1)}</div>
        <div className="col-stat detail">{a.ast.toFixed(1)}</div>
        <div className="col-stat detail">{a.stl.toFixed(1)}</div>
        <div className="col-stat detail">{a.blk.toFixed(1)}</div>
        <div className="col-stat detail tov">{a.tov.toFixed(1)}</div>
        <div className="col-stat detail pts">{a.pts.toFixed(1)}</div>
      </>
    );
  }

  function renderFptsCell(player: RosterPlayer | undefined) {
    const stats = player ? getStatsForPlayer(player) : null;
    if (!stats) return <div className="col-fpts">-</div>;
    return <div className="col-fpts">{stats.fptsAvg.toFixed(1)}</div>;
  }

  function renderRow(slot: string, badgeType: "starter" | "bench" | "unassigned", player: RosterPlayer | undefined) {
    const slotInfo = SLOT_LABELS[slot];
    const isSwapTarget = swapSource === slot;
    return (
      <div
        key={slot}
        className={`lineup-row ${isSwapTarget ? "swap-active" : ""} ${isMyTeam ? "clickable" : ""}`}
        onClick={() => isMyTeam && handleSlotClick(slot)}
      >
        <div className="col-slot">
          <span className={`slot-badge ${badgeType}`}>{slotInfo?.labelEn || "-"}</span>
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
        {renderGameCell(player)}
        {renderStatCells(player)}
        {renderFptsCell(player)}
      </div>
    );
  }

  // ── Loading / Error states ──

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

  // ── Main render ──

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
                <h1>{t("阵容管理", "My Team")}</h1>
                <p>{t("设置阵容 · 查看赛程和数据", "Set Lineup · Schedule & Stats")}</p>
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

          {/* Date navigation */}
          <div className="date-nav">
            <button className="date-arrow" onClick={() => shiftWeek(-1)}>‹</button>
            <div className="date-tabs">
              {weekDates.map((d) => {
                const ds = formatDateStr(d);
                const isToday = ds === todayStr;
                const isSelected = ds === selectedDate;
                const dayName = lang === "zh" ? DAY_NAMES_ZH[d.getDay()] : DAY_NAMES_EN[d.getDay()];
                return (
                  <button
                    key={ds}
                    className={`date-tab ${isSelected ? "active" : ""} ${isToday ? "today" : ""}`}
                    onClick={() => setSelectedDate(ds)}
                  >
                    <span className="date-day">{dayName}</span>
                    <span className="date-num">{d.getMonth() + 1}/{d.getDate()}</span>
                    {isToday && <span className="today-dot" />}
                  </button>
                );
              })}
            </div>
            <button className="date-arrow" onClick={() => shiftWeek(1)}>›</button>
          </div>

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
              <div className="section-label">{t("首发阵容", "Starting Lineup")} ({starterSlots.length})</div>
              <div className="table-wrapper">
                <div className="lineup-table">
                  <div className="lineup-header">
                    <div className="col-slot">{t("位置", "SLOT")}</div>
                    <div className="col-player">{t("球员", "PLAYER")}</div>
                    <div className="col-schedule">{t("对阵", "OPP")}</div>
                    <div className="col-stat detail">MIN</div>
                    <div className="col-stat detail">FG</div>
                    <div className="col-stat detail">FT</div>
                    <div className="col-stat detail">3PM</div>
                    <div className="col-stat detail">REB</div>
                    <div className="col-stat detail">AST</div>
                    <div className="col-stat detail">STL</div>
                    <div className="col-stat detail">BLK</div>
                    <div className="col-stat detail">TO</div>
                    <div className="col-stat detail">PTS</div>
                    <div className="col-fpts">FPTS</div>
                  </div>
                  {starterSlots.map(slot => {
                    const player = getPlayerInSlot(slot);
                    return renderRow(slot, "starter", player);
                  })}
                  {/* Starters totals row */}
                  <div className="lineup-row totals-row">
                    <div className="col-slot" />
                    <div className="col-player"><span className="totals-label">TOTALS</span></div>
                    <div className="col-schedule" />
                    <div className="col-stat detail">{starterTotals.min.toFixed(1)}</div>
                    <div className="col-stat detail compound">{starterTotals.fgm.toFixed(1)}/{starterTotals.fga.toFixed(1)}</div>
                    <div className="col-stat detail compound">{starterTotals.ftm.toFixed(1)}/{starterTotals.fta.toFixed(1)}</div>
                    <div className="col-stat detail">{starterTotals.fg3m.toFixed(1)}</div>
                    <div className="col-stat detail">{starterTotals.reb.toFixed(1)}</div>
                    <div className="col-stat detail">{starterTotals.ast.toFixed(1)}</div>
                    <div className="col-stat detail">{starterTotals.stl.toFixed(1)}</div>
                    <div className="col-stat detail">{starterTotals.blk.toFixed(1)}</div>
                    <div className="col-stat detail tov">{starterTotals.tov.toFixed(1)}</div>
                    <div className="col-stat detail pts">{starterTotals.pts.toFixed(1)}</div>
                    <div className="col-fpts totals-fpts">{starterTotals.fpts.toFixed(1)}</div>
                  </div>
                </div>
              </div>

              {/* Bench */}
              <div className="section-label">{t("板凳", "Bench")} ({benchSlots.length})</div>
              <div className="table-wrapper">
                <div className="lineup-table">
                  <div className="lineup-header">
                    <div className="col-slot">{t("位置", "SLOT")}</div>
                    <div className="col-player">{t("球员", "PLAYER")}</div>
                    <div className="col-schedule">{t("对阵", "OPP")}</div>
                    <div className="col-stat detail">MIN</div>
                    <div className="col-stat detail">FG</div>
                    <div className="col-stat detail">FT</div>
                    <div className="col-stat detail">3PM</div>
                    <div className="col-stat detail">REB</div>
                    <div className="col-stat detail">AST</div>
                    <div className="col-stat detail">STL</div>
                    <div className="col-stat detail">BLK</div>
                    <div className="col-stat detail">TO</div>
                    <div className="col-stat detail">PTS</div>
                    <div className="col-fpts">FPTS</div>
                  </div>
                  {benchSlots.map(slot => {
                    const player = getPlayerInSlot(slot);
                    return renderRow(slot, "bench", player);
                  })}
                </div>
              </div>

              {/* Unassigned players */}
              {unassigned.length > 0 && isMyTeam && (
                <>
                  <div className="section-label">{t("未分配球员", "Unassigned")} ({unassigned.length})</div>
                  <div className="table-wrapper">
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
                          {renderGameCell(player)}
                          {renderStatCells(player)}
                          {renderFptsCell(player)}
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Loading indicator for stats */}
              {(statsLoading || gamesLoading) && (
                <div className="data-loading">
                  {t("正在加载数据...", "Loading stats & schedule...")}
                </div>
              )}
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
    max-width: 1400px;
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
  .page-content {
    min-height: calc(100vh - 200px);
    background: #0a0a0a;
    padding: 24px 16px;
  }
  .container {
    max-width: 1400px;
    margin: 0 auto;
  }
  .page-header { margin-bottom: 20px; }
  .page-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 6px 0;
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

  /* Team selector */
  .team-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
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

  /* Date navigation */
  .date-nav {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 20px;
    background: #111;
    border: 1px solid #222;
    border-radius: 10px;
    padding: 6px;
  }
  .date-arrow {
    width: 32px;
    height: 40px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 6px;
    color: #888;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .date-arrow:hover { color: #fff; border-color: #555; }
  .date-tabs {
    display: flex;
    gap: 4px;
    flex: 1;
    overflow-x: auto;
  }
  .date-tab {
    flex: 1;
    min-width: 60px;
    padding: 8px 6px;
    background: transparent;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #888;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    position: relative;
  }
  .date-tab:hover { background: rgba(255,255,255,0.05); }
  .date-tab.active {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }
  .date-tab.today .date-day { color: #3b82f6; }
  .today-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #3b82f6;
    position: absolute;
    bottom: 4px;
  }
  .date-day {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .date-num {
    font-size: 13px;
    font-weight: 600;
  }

  /* Swap hint */
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

  /* Section labels */
  .section-label {
    font-size: 14px;
    font-weight: 600;
    color: #f59e0b;
    margin: 24px 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid #222;
  }
  .lineup-table {
    background: #111;
    min-width: 900px;
  }
  .lineup-header {
    display: grid;
    grid-template-columns: 56px 160px 90px 48px 64px 64px 42px 42px 42px 42px 42px 42px 48px 60px;
    padding: 10px 12px;
    background: #1a1a1a;
    border-bottom: 1px solid #222;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .lineup-row {
    display: grid;
    grid-template-columns: 56px 160px 90px 48px 64px 64px 42px 42px 42px 42px 42px 42px 48px 60px;
    padding: 10px 12px;
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

  /* Totals row */
  .totals-row {
    background: #1a1a1a !important;
    border-top: 2px solid #333;
    cursor: default !important;
  }
  .totals-row:hover { background: #1a1a1a !important; }
  .totals-label {
    font-size: 12px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .totals-fpts {
    font-size: 14px !important;
    font-weight: 700 !important;
  }

  /* Columns */
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

  .col-player { padding: 0 8px; min-width: 0; }
  .player-info { display: flex; flex-direction: column; gap: 1px; }
  .player-name {
    font-size: 13px;
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-meta { font-size: 11px; color: #666; }
  .empty-slot { font-size: 13px; color: #444; font-style: italic; }

  /* Schedule column */
  .col-schedule {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-size: 12px;
    color: #ccc;
    text-align: center;
  }
  .col-schedule.dim { color: #444; }
  .opp-label { font-weight: 600; font-size: 12px; }
  .game-score { font-size: 10px; color: #888; }

  /* Stats columns */
  .col-stat {
    font-size: 12px;
    color: #aaa;
    text-align: center;
  }
  .col-stat.compound {
    font-size: 10px;
    letter-spacing: -0.3px;
  }
  .col-stat.tov { color: #ef4444; }
  .col-stat.pts { color: #fff; font-weight: 600; }

  /* FPTS column */
  .col-fpts {
    font-size: 13px;
    font-weight: 700;
    color: #f59e0b;
    text-align: center;
  }

  /* Data loading */
  .data-loading {
    text-align: center;
    padding: 12px;
    color: #666;
    font-size: 13px;
  }

  /* Empty & error states */
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

  /* Mobile responsive */
  @media (max-width: 768px) {
    .container { max-width: 100%; }
    .lineup-header .col-stat.detail,
    .lineup-row .col-stat.detail {
      display: none;
    }
    .lineup-header, .lineup-row {
      grid-template-columns: 48px 1fr 72px 56px;
      padding: 8px;
    }
    .date-tab { min-width: 48px; padding: 6px 4px; }
    .date-day { font-size: 9px; }
    .date-num { font-size: 11px; }
    .player-name { font-size: 12px; }
    .player-meta { font-size: 10px; }
  }
`;
