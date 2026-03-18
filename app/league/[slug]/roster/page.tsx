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
  getTeamLineup,
  setTeamLineup,
  autoSetLineup,
  isEligibleForSlot,
  fetchTeamRosterFromDB,
  fetchTeamLineupFromDB,
  saveLineupForWeek,
  League,
  RosterPlayer,
  LineupMap,
} from "@/lib/store";
import { getCurrentWeek } from "@/lib/week-utils";
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
  injury?: string;
};

type PlayerGameStats = {
  min: number;
  fgm: number;
  fga: number;
  fg3m: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pts: number;
  fpts: number;
};

type DateStatsMap = Record<string, PlayerGameStats>;

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
  UTIL3: { label: "机动3", labelEn: "UTIL", type: "starter" },
  BE1: { label: "板凳1", labelEn: "BE", type: "bench" },
  BE2: { label: "板凳2", labelEn: "BE", type: "bench" },
  BE3: { label: "板凳3", labelEn: "BE", type: "bench" },
};

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3", "BE1", "BE2", "BE3"];

const DAY_NAMES_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const DAY_NAMES_ZH = ["日", "一", "二", "三", "四", "五", "六"];

// ── Helpers ──

function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const [gameDayStats, setGameDayStats] = useState<DateStatsMap>({});
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

  useEffect(() => {
    fetchGameDayStats(selectedDate);
  }, [selectedDate]);

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
        const rosterData = await fetchTeamRosterFromDB(leagueData.id, teamId);
        setRoster(rosterData);
        let lineupData = await fetchTeamLineupFromDB(leagueData.id, teamId);
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

  async function fetchGameDayStats(date: string) {
    try {
      const res = await fetch(`/api/nba-game-stats?date=${date}`);
      const data = await res.json();
      if (data.status === "success" && data.stats) {
        setGameDayStats(data.stats);
      } else {
        setGameDayStats({});
      }
    } catch {
      setGameDayStats({});
    }
  }

  // ── Lineup logic (unchanged) ──

  async function switchViewTeam(teamId: string) {
    if (!league) return;
    setViewTeamId(teamId);
    const rosterData = await fetchTeamRosterFromDB(league.id, teamId);
    setRoster(rosterData);
    const lineupData = await fetchTeamLineupFromDB(league.id, teamId);
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
    if (selectedDate < todayStr) {
      alert(t("历史日期不可调整阵容", "Cannot edit lineup for past dates"));
      return;
    }

    const slotPlayer = getPlayerInSlot(slot);
    if (slotPlayer && isPlayerLockedForLineup(slotPlayer)) {
      alert(t("该球员比赛已开始或已结束，无法调整", "This player is locked and cannot be moved"));
      return;
    }

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

      if ((playerAData && isPlayerLockedForLineup(playerAData)) || (playerBData && isPlayerLockedForLineup(playerBData))) {
        alert(t("已开赛球员不能进行首发/替补交换", "Started-game players cannot be swapped"));
        setSwapSource(null);
        return;
      }

      let canSwap = true;
      if (playerA && !isEligibleForSlot(playerAData ? getPlayerPosition(playerAData) : "", slot)) canSwap = false;
      if (playerB && !isEligibleForSlot(playerBData ? getPlayerPosition(playerBData) : "", swapSource)) canSwap = false;

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
      saveLineupForWeek(league.id, myTeam.id, getCurrentWeek(), newLineup);
      setSwapSource(null);
    }
  }

  function handleAssignPlayer(playerId: string) {
    if (!league || !myTeam || !swapSource) return;
    if (selectedDate < todayStr) {
      alert(t("历史日期不可调整阵容", "Cannot edit lineup for past dates"));
      return;
    }
    const player = roster.find(p => p.id === playerId);
    if (!player) return;
    if (isPlayerLockedForLineup(player)) {
      alert(t("该球员比赛已开始或已结束，无法排阵", "This player is locked and cannot be assigned"));
      return;
    }
    const slotPlayer = getPlayerInSlot(swapSource);
    if (slotPlayer && isPlayerLockedForLineup(slotPlayer)) {
      alert(t("已开赛球员不能被替换", "Started-game players cannot be replaced"));
      return;
    }
    if (!isEligibleForSlot(getPlayerPosition(player), swapSource)) {
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
    saveLineupForWeek(league.id, myTeam.id, getCurrentWeek(), newLineup);
    setSwapSource(null);
  }

  function handleAutoLineup() {
    if (!league || !myTeam) return;
    if (selectedDate <= todayStr) {
      alert(t("当天或历史日期不可一键排阵，请仅调整未开赛球员", "Auto lineup is disabled for today/past dates"));
      return;
    }
    const newLineup = autoSetLineup(league.id, myTeam.id);
    setLineup(newLineup);
    saveLineupForWeek(league.id, myTeam.id, getCurrentWeek(), newLineup);
  }

  // ── Schedule & stats helpers ──

  // Get the live/current team for a player from the stats cache
  function getLiveTeam(player: RosterPlayer): string {
    const stats = getStatsForPlayer(player);
    return stats?.team || player.team;
  }

  // Get accurate multi-position for a player (override map takes priority)
  function getPlayerPosition(player: RosterPlayer): string {
    return PLAYER_POSITIONS[player.name] || player.position;
  }

  function getGameForPlayer(player: RosterPlayer): GameInfo | null {
    const team = getLiveTeam(player);
    const teamSchedule = teamGames[team];
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

  const isPastDate = selectedDate < todayStr;
  const isOwner = user && league && league.commissioner_id === user.id;
  const isMyTeam = viewTeamId === myTeam?.id;
  const starterSlots = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "starter");
  const benchSlots = SLOT_ORDER.filter(s => SLOT_LABELS[s].type === "bench");
  const unassigned = getUnassignedPlayers();

  // Calculate starter totals (past dates: only game-day stats; today/future: game-day or averages)
  const starterTotals = starterSlots.reduce(
    (acc, slot) => {
      const player = getPlayerInSlot(slot);
      if (!player) return acc;
      const dayStats = getGameDayStatsForPlayer(player);
      const played = hasPlayedGame(player);
      if (played && dayStats) {
        return {
          min: acc.min + dayStats.min,
          fgm: acc.fgm + dayStats.fgm,
          fga: acc.fga + dayStats.fga,
          ftm: acc.ftm + dayStats.ftm,
          fta: acc.fta + dayStats.fta,
          fg3m: acc.fg3m + dayStats.fg3m,
          reb: acc.reb + dayStats.reb,
          ast: acc.ast + dayStats.ast,
          stl: acc.stl + dayStats.stl,
          blk: acc.blk + dayStats.blk,
          tov: acc.tov + dayStats.tov,
          pts: acc.pts + dayStats.pts,
          fpts: acc.fpts + dayStats.fpts,
        };
      }
      // Past or today: don't add season averages for players without game-day data
      if (isPastDate || selectedDate === todayStr) return acc;
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

    const cached = getStatsForPlayer(player);
    const game = getGameForPlayer(player);

    // No game today — check for injury note
    if (!game) {
      if (cached?.injury) {
        return (
          <div className="col-schedule">
            <span className="status-badge inj">INJ</span>
            <span className="status-reason">{cached.injury}</span>
          </div>
        );
      }
      return <div className="col-schedule dim">--</div>;
    }

    const label = game.isHome ? `vs ${game.opponent}` : `@${game.opponent}`;
    const isFinal = game.status === "Final";
    const score = isFinal
      ? `${game.isHome ? game.homeScore : game.visitorScore}-${game.isHome ? game.visitorScore : game.homeScore}`
      : null;

    // Game finished but no box score stats → DNP
    const dayStats = getGameDayStatsForPlayer(player);
    const isDnp = isFinal && !dayStats;

    return (
      <div className="col-schedule">
        <span className="opp-label">{label}</span>
        {score && <span className="game-score">{score}</span>}
        {isDnp && <span className="status-badge dnp">DNP</span>}
        {!isFinal && cached?.injury && <span className="status-badge inj">INJ</span>}
      </div>
    );
  }

  // Get game-day box score stats for a player (if they played on the selected date)
  function getGameDayStatsForPlayer(player: RosterPlayer): PlayerGameStats | null {
    // Try direct roster ID match
    const direct = gameDayStats[player.id];
    if (direct) return direct;
    // Use stats cache to find BDL ID (handles "p1" → numeric BDL ID mapping via name match)
    const cached = getStatsForPlayer(player);
    if (cached) {
      const byBdlId = gameDayStats[String(cached.id)];
      if (byBdlId) return byBdlId;
    }
    return null;
  }

  // Check if the selected date has a completed or in-progress game for this player
  function hasPlayedGame(player: RosterPlayer): boolean {
    const game = getGameForPlayer(player);
    if (!game) return false;
    // "Final" = completed, any other non-empty non-"scheduled" status could be in-progress
    const status = game.status.toLowerCase();
    return status === "final" || (status !== "" && status !== "scheduled" && !status.includes("scheduled"));
  }

  function isPlayerLockedForLineup(player: RosterPlayer): boolean {
    if (selectedDate < todayStr) return true;
    if (selectedDate > todayStr) return false;
    return hasPlayedGame(player) || !!getGameDayStatsForPlayer(player);
  }

  function renderStatCells(player: RosterPlayer | undefined) {
    const stats = player ? getStatsForPlayer(player) : null;
    const dayStats = player ? getGameDayStatsForPlayer(player) : null;
    const played = player ? hasPlayedGame(player) : false;
    const game = player ? getGameForPlayer(player) : null;
    const useGameDay = played && dayStats;

    const dashRow = (
      <>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
        <div className="col-stat detail">--</div>
      </>
    );

    // Past date: only show actual game-day stats, never season averages
    if (isPastDate) {
      if (useGameDay) {
        const g = dayStats;
        return (
          <>
            <div className="col-stat detail">{g.min.toFixed(0)}</div>
            <div className="col-stat detail compound">{g.fgm}/{g.fga}</div>
            <div className="col-stat detail compound">{g.ftm}/{g.fta}</div>
            <div className="col-stat detail">{g.fg3m}</div>
            <div className="col-stat detail">{g.reb}</div>
            <div className="col-stat detail">{g.ast}</div>
            <div className="col-stat detail">{g.stl}</div>
            <div className="col-stat detail">{g.blk}</div>
            <div className="col-stat detail tov">{g.tov}</div>
            <div className="col-stat detail pts">{g.pts}</div>
          </>
        );
      }
      // Game existed but no stats (DNP/injured) or no game at all → show "--"
      return dashRow;
    }

    // Today or future: show live game-day stats (green) or fall back to season averages
    if (!stats && !dayStats) return dashRow;

    if (useGameDay) {
      const g = dayStats;
      return (
        <>
          <div className="col-stat detail live">{g.min.toFixed(0)}</div>
          <div className="col-stat detail compound live">{g.fgm}/{g.fga}</div>
          <div className="col-stat detail compound live">{g.ftm}/{g.fta}</div>
          <div className="col-stat detail live">{g.fg3m}</div>
          <div className="col-stat detail live">{g.reb}</div>
          <div className="col-stat detail live">{g.ast}</div>
          <div className="col-stat detail live">{g.stl}</div>
          <div className="col-stat detail live">{g.blk}</div>
          <div className="col-stat detail tov live">{g.tov}</div>
          <div className="col-stat detail pts live">{g.pts}</div>
        </>
      );
    }

    // Today with no game stats → "--"
    if (selectedDate === todayStr) return dashRow;

    const a = stats!.averages;
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
    const dayStats = player ? getGameDayStatsForPlayer(player) : null;
    const played = player ? hasPlayedGame(player) : false;

    if (isPastDate) {
      if (played && dayStats) {
        return <div className="col-fpts">{dayStats.fpts.toFixed(1)}</div>;
      }
      return <div className="col-fpts">--</div>;
    }

    if (played && dayStats) {
      return <div className="col-fpts live">{dayStats.fpts.toFixed(1)}</div>;
    }

    // Today with no game stats → "--"
    if (selectedDate === todayStr) return <div className="col-fpts">--</div>;

    const stats = player ? getStatsForPlayer(player) : null;
    if (!stats) return <div className="col-fpts">--</div>;
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
              <span className="player-meta">{getLiveTeam(player)} · {getPlayerPosition(player)}</span>
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

  // ── Main render ──

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
              <div className="empty-icon"></div>
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
                              <span className="player-meta">{getLiveTeam(player)} · {getPlayerPosition(player)}</span>
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
    background: #1e3a8a;
    border-bottom: none;
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
    background: #f9fafb;
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
    color: #111827;
    margin: 0 0 6px 0;
  }
  .page-header p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }
  .auto-btn {
    padding: 10px 20px;
    background: #1e3a8a;
    color: #fff;
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
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #6b7280;
    font-size: 13px;
    cursor: pointer;
    white-space: nowrap;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .team-tab.active {
    background: #eff6ff;
    border-color: #1e3a8a;
    color: #1e3a8a;
  }
  .my-badge {
    background: #1e3a8a;
    color: #fff;
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
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
    padding: 6px;
  }
  .date-arrow {
    width: 32px;
    height: 40px;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 6px;
    color: #6b7280;
    font-size: 20px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .date-arrow:hover { color: #fff; border-color: #6b7280; }
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
    color: #6b7280;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    position: relative;
  }
  .date-tab:hover { background: rgba(255,255,255,0.05); }
  .date-tab.active {
    background: #eff6ff;
    border-color: #1e3a8a;
    color: #1e3a8a;
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
    background: #fef2f2;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    color: #dc2626;
    cursor: pointer;
    font-size: 13px;
  }

  /* Section labels */
  .section-label {
    font-size: 14px;
    font-weight: 600;
    color: #1e3a8a;
    margin: 24px 0 12px 0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    border-radius: 12px;
    border: 1px solid #e5e7eb;
  }
  .lineup-table {
    background: #fff;
    min-width: 900px;
    width: 100%;
  }
  .lineup-header {
    display: grid;
    grid-template-columns: 56px minmax(140px, 2fr) minmax(80px, 1fr) repeat(10, minmax(40px, 1fr)) minmax(55px, 1fr);
    padding: 10px 12px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
    font-size: 11px;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .lineup-row {
    display: grid;
    grid-template-columns: 56px minmax(140px, 2fr) minmax(80px, 1fr) repeat(10, minmax(40px, 1fr)) minmax(55px, 1fr);
    padding: 10px 12px;
    border-bottom: 1px solid #f3f4f6;
    align-items: center;
    transition: background 0.15s;
  }
  .lineup-row:last-child { border-bottom: none; }
  .lineup-row.clickable { cursor: pointer; }
  .lineup-row.clickable:hover { background: #f8fafc; }
  .lineup-row.swap-active {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.2);
  }
  .lineup-row.highlight { background: #f8fafc; }

  /* Totals row */
  .totals-row {
    background: #f3f4f6 !important;
    border-top: 2px solid #e5e7eb;
    cursor: default !important;
  }
  .totals-row:hover { background: #f3f4f6 !important; }
  .totals-label {
    font-size: 12px;
    font-weight: 700;
    color: #6b7280;
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
  .slot-badge.starter { background: #dbeafe; color: #1d4ed8; }
  .slot-badge.bench { background: #f3f4f6; color: #6b7280; }
  .slot-badge.unassigned { background: #fef2f2; color: #dc2626; }

  .col-player { padding: 0 8px; min-width: 0; }
  .player-info { display: flex; flex-direction: column; gap: 1px; }
  .player-name {
    font-size: 13px;
    font-weight: 500;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .player-meta { font-size: 11px; color: #9ca3af; }
  .empty-slot { font-size: 13px; color: #444; font-style: italic; }

  /* Schedule column */
  .col-schedule {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    font-size: 12px;
    color: #374151;
    text-align: center;
  }
  .col-schedule.dim { color: #444; }
  .opp-label { font-weight: 600; font-size: 12px; }
  .game-score { font-size: 10px; color: #6b7280; }
  .status-badge {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.3px;
  }
  .status-badge.dnp { background: rgba(100,116,139,0.25); color: #94a3b8; }
  .status-badge.inj { background: rgba(239,68,68,0.2); color: #fca5a5; }
  .status-reason { font-size: 10px; color: #ef4444; display: block; }

  /* Stats columns */
  .col-stat {
    font-size: 12px;
    color: #6b7280;
    text-align: center;
  }
  .col-stat.compound {
    font-size: 10px;
    letter-spacing: -0.3px;
  }
  .col-stat.tov { color: #ef4444; }
  .col-stat.pts { color: #111827; font-weight: 600; }
  .col-stat.live { color: #22c55e; }
  .col-stat.live.tov { color: #ef4444; }
  .col-stat.live.pts { color: #22c55e; font-weight: 600; }

  /* FPTS column */
  .col-fpts {
    font-size: 13px;
    font-weight: 700;
    color: #1e3a8a;
    text-align: center;
  }
  .col-fpts.live {
    color: #22c55e;
  }

  /* Data loading */
  .data-loading {
    text-align: center;
    padding: 12px;
    color: #9ca3af;
    font-size: 13px;
  }

  /* Empty & error states */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    color: #6b7280;
  }
  .empty-icon { font-size: 64px; margin-bottom: 16px; }
  .back-link {
    display: inline-block;
    margin-top: 16px;
    padding: 10px 24px;
    background: #1e3a8a;
    color: #fff;
    border-radius: 8px;
    text-decoration: none;
    font-weight: 600;
  }
  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
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
