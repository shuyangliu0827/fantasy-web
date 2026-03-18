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
  fetchTeamRosterFromDB,
  fetchTeamLineupFromDB,
  fetchLineupHistoryFromDB,
  getLineupForWeek,
  supabase,
  League,
  LeagueMember,
  RosterPlayer,
  LineupMap,
} from "@/lib/store";
import {
  getWeekDates,
  getWeekDateStrings,
  formatDateStr,
  getTodayStr,
} from "@/lib/week-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

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

type DayStats = PlayerGameStats;

// ── Helpers ───────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const ZERO_STATS: DayStats = {
  min: 0, fgm: 0, fga: 0, ftm: 0, fta: 0, fg3m: 0,
  reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pts: 0, fpts: 0,
};

const SLOT_ORDER = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3", "BE1", "BE2", "BE3"];
const STARTER_SLOTS = new Set(["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"]);
const BENCH_SLOTS = new Set(["BE1", "BE2", "BE3"]);

function getWeekdayScoringDates(dateStrings: string[]): string[] {
  return dateStrings.filter((dateStr) => {
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    return day >= 1 && day <= 5;
  });
}

function getSlotDisplayLabel(slot: string): string {
  if (slot.startsWith("UTIL")) return "UTIL";
  if (slot.startsWith("BE")) return "Bench";
  return slot;
}

type SlottedRow = { slot: string; player: RosterPlayer };

function buildSlottedRows(roster: RosterPlayer[], lineup: LineupMap): { starters: SlottedRow[]; bench: SlottedRow[] } {
  const playerMap = new Map(roster.map(p => [p.id, p]));
  const starters: SlottedRow[] = [];
  const bench: SlottedRow[] = [];
  const assigned = new Set<string>();

  for (const slot of SLOT_ORDER) {
    const pid = lineup[slot];
    const player = pid ? playerMap.get(pid) : undefined;
    if (player) {
      assigned.add(pid);
      if (BENCH_SLOTS.has(slot)) bench.push({ slot, player });
      else starters.push({ slot, player });
    }
  }
  // Unassigned players go to bench
  for (const p of roster) {
    if (!assigned.has(p.id)) {
      bench.push({ slot: "BE", player: p });
    }
  }
  return { starters, bench };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchupDetailPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;
  const matchupId = params.matchupId as string;

  const parts = matchupId.split("-").map(Number);
  const week = parts[0] || 1;
  const matchupIdx = parts[1] ?? 0;

  const weekDates = getWeekDates(week);
  const dateStrings = getWeekDateStrings(week);
  const scoringDateStrings = getWeekdayScoringDates(dateStrings);
  const todayStr = getTodayStr();

  const [league, setLeague] = useState<League | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [homeTeam, setHomeTeam] = useState<{ member: LeagueMember; fantasy: any } | null>(null);
  const [awayTeam, setAwayTeam] = useState<{ member: LeagueMember; fantasy: any } | null>(null);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [homeLineup, setHomeLineup] = useState<LineupMap>({});
  const [awayLineup, setAwayLineup] = useState<LineupMap>({});
  const [loading, setLoading] = useState(true);

  // Real data state
  const [teamGames, setTeamGames] = useState<TeamGamesMap>({});
  const [playerStatsCache, setPlayerStatsCache] = useState<Map<string, CachedPlayerStats>>(new Map());
  const [weekDayStats, setWeekDayStats] = useState<Record<string, DateStatsMap>>({});
  const [statsLoading, setStatsLoading] = useState(true);

  // View mode: "total" or a date string like "2026-03-09"
  const [viewMode, setViewMode] = useState<string>("total");

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, matchupId]);

  async function loadData() {
    try {
      const leagueData = await getLeagueBySlug(slug);
      if (!leagueData) return;
      setLeague(leagueData);

      const [membersData, { data: teamsData }] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase
          .from("fantasy_teams")
          .select("*")
          .eq("league_id", leagueData.id)
          .order("draft_position", { ascending: true }),
      ]);

      const n = membersData.length;
      if (n >= 2 && n % 2 === 0) {
        const sorted = [...membersData].sort((a, b) => a.user_id.localeCompare(b.user_id));
        const seed = leagueData.id
          .split("")
          .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
        const shuffled = seededShuffle(sorted, seed);
        const fixed = shuffled[0];
        const rotating = shuffled.slice(1);
        const numRounds = n - 1;
        const round = (week - 1) % numRounds;
        const half = (n - 2) / 2;

        const matchups: { home: LeagueMember; away: LeagueMember }[] = [];
        matchups.push({ home: fixed, away: rotating[round] });
        for (let i = 1; i <= half; i++) {
          matchups.push({
            home: rotating[(round + i) % (n - 1)],
            away: rotating[(round + n - 1 - i) % (n - 1)],
          });
        }

        const matchup = matchups[matchupIdx];
        if (matchup) {
          const homeFT = (teamsData || []).find((t: any) => t.user_id === matchup.home.user_id);
          const awayFT = (teamsData || []).find((t: any) => t.user_id === matchup.away.user_id);
          setHomeTeam({ member: matchup.home, fantasy: homeFT });
          setAwayTeam({ member: matchup.away, fantasy: awayFT });

          // Fetch rosters, lineups, and lineup history from DB
          const [hRoster, aRoster, hLineupCurrent, aLineupCurrent, hHistory, aHistory] = await Promise.all([
            homeFT ? fetchTeamRosterFromDB(leagueData.id, homeFT.id).catch(() => getTeamRoster(leagueData.id, homeFT.id)) : Promise.resolve([]),
            awayFT ? fetchTeamRosterFromDB(leagueData.id, awayFT.id).catch(() => getTeamRoster(leagueData.id, awayFT.id)) : Promise.resolve([]),
            homeFT ? fetchTeamLineupFromDB(leagueData.id, homeFT.id).catch(() => ({} as LineupMap)) : Promise.resolve({} as LineupMap),
            awayFT ? fetchTeamLineupFromDB(leagueData.id, awayFT.id).catch(() => ({} as LineupMap)) : Promise.resolve({} as LineupMap),
            homeFT ? fetchLineupHistoryFromDB(leagueData.id, homeFT.id).catch(() => ({})) : Promise.resolve({}),
            awayFT ? fetchLineupHistoryFromDB(leagueData.id, awayFT.id).catch(() => ({})) : Promise.resolve({}),
          ]);
          setHomeRoster(hRoster);
          setAwayRoster(aRoster);
          // Use the per-week snapshot if available, otherwise fall back to current lineup
          setHomeLineup(getLineupForWeek(hHistory, hLineupCurrent, week));
          setAwayLineup(getLineupForWeek(aHistory, aLineupCurrent, week));
        }
      }

      // Fetch real NBA data
      await fetchRealData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchRealData() {
    setStatsLoading(true);
    try {
      // 1. Fetch player stats cache (for name -> BDL ID mapping)
      const statsPromise = fetch("/api/nba-stats").then(r => r.json());

      // 2. Fetch game schedule for the week
      const gamesPromise = fetch(
        `/api/nba-games?start_date=${dateStrings[0]}&end_date=${dateStrings[6]}`
      ).then(r => r.json());

      const [statsRes, gamesRes] = await Promise.all([statsPromise, gamesPromise]);

      // Build player stats cache map
      if (statsRes.status === "success" && statsRes.players) {
        const map = new Map<string, CachedPlayerStats>();
        for (const p of statsRes.players) {
          map.set(String(p.id), p);
        }
        setPlayerStatsCache(map);
      }

      // Set team games
      if (gamesRes.status === "success" && gamesRes.games) {
        setTeamGames(gamesRes.games);
      }

      // 3. Fetch game-day stats for past/today dates in parallel
      const pastOrTodayDates = dateStrings.filter(d => d <= todayStr);
      if (pastOrTodayDates.length > 0) {
        const dayStatsResults = await Promise.all(
          pastOrTodayDates.map(date =>
            fetch(`/api/nba-game-stats?date=${date}`)
              .then(r => r.json())
              .then(data => ({
                date,
                stats: data.status === "success" ? (data.stats as DateStatsMap) : {},
              }))
              .catch(() => ({ date, stats: {} as DateStatsMap }))
          )
        );

        const allDayStats: Record<string, DateStatsMap> = {};
        for (const { date, stats } of dayStatsResults) {
          allDayStats[date] = stats;
        }
        setWeekDayStats(allDayStats);
      }
    } catch (err) {
      console.error("Failed to fetch real data:", err);
    } finally {
      setStatsLoading(false);
    }
  }

  // ── Player stat helpers ──────────────────────────────────────────────────

  function getStatsForPlayer(player: RosterPlayer): CachedPlayerStats | null {
    const byId = playerStatsCache.get(player.id);
    if (byId) return byId;
    for (const s of playerStatsCache.values()) {
      if (s.name === player.name) return s;
    }
    return null;
  }

  function getLiveTeam(player: RosterPlayer): string {
    const stats = getStatsForPlayer(player);
    return stats?.team || player.team;
  }

  function getGameForPlayerOnDate(player: RosterPlayer, dateStr: string): GameInfo | null {
    const team = getLiveTeam(player);
    const teamSchedule = teamGames[team];
    if (!teamSchedule) return null;
    return teamSchedule[dateStr] || null;
  }

  function getPlayerDayStats(player: RosterPlayer, dateStr: string): PlayerGameStats | null {
    // Future date: no stats
    if (dateStr > todayStr) return null;

    const dayMap = weekDayStats[dateStr];
    if (!dayMap) return null;

    // Direct ID lookup
    if (dayMap[player.id]) return dayMap[player.id];

    // BDL ID lookup via name match
    const cached = getStatsForPlayer(player);
    if (cached && dayMap[String(cached.id)]) return dayMap[String(cached.id)];

    return null;
  }

  // Get stats for a player for the current viewMode
  function getPlayerViewStats(player: RosterPlayer): DayStats | null {
    if (viewMode === "total") {
      return calcPlayerWeekTotals(player);
    }
    // Single day view
    const game = getGameForPlayerOnDate(player, viewMode);
    if (!game) return null; // No game scheduled
    if (viewMode > todayStr) return null; // Future game
    const status = game.status.toLowerCase();
    if (status !== "final" && status !== "" && !status.includes("q") && !status.includes("half")) {
      // Game scheduled but not started or final
      if (status === "scheduled" || status.includes("scheduled")) return null;
    }
    return getPlayerDayStats(player, viewMode);
  }

  function calcPlayerWeekTotals(player: RosterPlayer): DayStats | null {
    const totals = { ...ZERO_STATS };
    let gamesPlayed = 0;
    for (const dateStr of scoringDateStrings) {
      const dayStats = getPlayerDayStats(player, dateStr);
      if (dayStats) {
        gamesPlayed++;
        totals.min += dayStats.min;
        totals.fgm += dayStats.fgm;
        totals.fga += dayStats.fga;
        totals.ftm += dayStats.ftm;
        totals.fta += dayStats.fta;
        totals.fg3m += dayStats.fg3m;
        totals.reb += dayStats.reb;
        totals.ast += dayStats.ast;
        totals.stl += dayStats.stl;
        totals.blk += dayStats.blk;
        totals.tov += dayStats.tov;
        totals.pts += dayStats.pts;
        totals.fpts += dayStats.fpts;
      }
    }
    return gamesPlayed > 0 ? totals : null;
  }

  // ── Score helpers ─────────────────────────────────────────────────────────

  const getMemberName = (m: LeagueMember) =>
    m.user?.username || m.user?.name || "Anonymous";

  const calcDailyTeamScore = (roster: RosterPlayer[], lineup: LineupMap, dateStr: string): number => {
    const { starters } = buildSlottedRows(roster, lineup);
    return starters.reduce((sum, row) => {
      const p = row.player;
      const stats = getPlayerDayStats(p, dateStr);
      return sum + (stats?.fpts || 0);
    }, 0);
  };

  const calcWeekTotal = (roster: RosterPlayer[], lineup: LineupMap): number => {
    return scoringDateStrings.reduce((sum, dateStr) => sum + calcDailyTeamScore(roster, lineup, dateStr), 0);
  };

  // ── OPP / STATUS helpers ──────────────────────────────────────────────────

  function getOppLabel(player: RosterPlayer, dateStr: string): string {
    const game = getGameForPlayerOnDate(player, dateStr);
    if (!game) return "--";
    return game.isHome ? game.opponent : `@${game.opponent}`;
  }

  function getGameStatusLabel(player: RosterPlayer, dateStr: string): { text: string; cls: string } {
    const game = getGameForPlayerOnDate(player, dateStr);
    if (!game) return { text: "--", cls: "" };
    if (game.status !== "Final") return { text: "--", cls: "" };
    const teamScore = game.isHome ? game.homeScore : game.visitorScore;
    const oppScore = game.isHome ? game.visitorScore : game.homeScore;
    const won = teamScore > oppScore;
    return {
      text: `${won ? "W" : "L"} ${teamScore}-${oppScore}`,
      cls: won ? "status-win" : "status-loss",
    };
  }

  // ── Box score renderer ────────────────────────────────────────────────────

  const TOTAL_COLS = 17; // SLOT + PLAYER + OPP + STATUS + 12 stats + FPTS

  const renderBoxScore = (roster: RosterPlayer[], teamName: string, lineup: LineupMap) => {
    const { starters, bench } = buildSlottedRows(roster, lineup);
    const D = "---";

    // Compute stats for a row list
    const getRowStats = (rows: SlottedRow[]) =>
      rows.map(r => ({ ...r, stats: getPlayerViewStats(r.player) }));

    const starterRows = getRowStats(starters);
    const benchRows = getRowStats(bench);

    // Starter totals only
    const starterTotals = starterRows.reduce(
      (acc, { stats }) => ({
        min:  acc.min  + (stats?.min  ?? 0),
        fgm:  acc.fgm  + (stats?.fgm  ?? 0),
        fga:  acc.fga  + (stats?.fga  ?? 0),
        ftm:  acc.ftm  + (stats?.ftm  ?? 0),
        fta:  acc.fta  + (stats?.fta  ?? 0),
        fg3m: acc.fg3m + (stats?.fg3m ?? 0),
        reb:  acc.reb  + (stats?.reb  ?? 0),
        ast:  acc.ast  + (stats?.ast  ?? 0),
        stl:  acc.stl  + (stats?.stl  ?? 0),
        blk:  acc.blk  + (stats?.blk  ?? 0),
        tov:  acc.tov  + (stats?.tov  ?? 0),
        pts:  acc.pts  + (stats?.pts  ?? 0),
        fpts: acc.fpts + (stats?.fpts ?? 0),
      }),
      { ...ZERO_STATS }
    );

    // Week date range label for header
    const weekRangeLabel = `${weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${weekDates[6].toLocaleDateString("en-US", { day: "numeric" })}`;

    // Stats header label
    const statsHeaderLabel = viewMode === "total"
      ? t(`第 ${week} 周总计`, `Week ${week} Total`)
      : (() => {
          const d = new Date(viewMode + "T00:00:00");
          return d.toLocaleDateString("en-US", { month: "long", day: "numeric" }) + " " + t("数据", "Stats");
        })();

    const renderPlayerRow = ({ slot, player, stats }: SlottedRow & { stats: DayStats | null }) => {
      const oppText = viewMode !== "total" ? getOppLabel(player, viewMode) : "--";
      const statusInfo = viewMode !== "total" ? getGameStatusLabel(player, viewMode) : { text: "--", cls: "" };

      return (
        <tr key={player.id} className={stats ? "row-played" : "row-no-game"}>
          <td className="col-slot">{getSlotDisplayLabel(slot)}</td>
          <td className="col-player">
            <div className="player-cell">
              <span className="player-name">{player.name}</span>
              <span className="player-team-label">{player.team} {player.position}</span>
            </div>
          </td>
          <td className="col-opp">{oppText}</td>
          <td className={`col-status ${statusInfo.cls}`}>{statusInfo.text}</td>
          <td>{stats ? Math.round(stats.min) : D}</td>
          <td>{stats ? stats.fgm : D}</td>
          <td>{stats ? stats.fga : D}</td>
          <td>{stats ? stats.ftm : D}</td>
          <td>{stats ? stats.fta : D}</td>
          <td>{stats ? stats.fg3m : D}</td>
          <td>{stats ? stats.reb : D}</td>
          <td>{stats ? stats.ast : D}</td>
          <td>{stats ? stats.stl : D}</td>
          <td>{stats ? stats.blk : D}</td>
          <td>{stats ? stats.tov : D}</td>
          <td>{stats ? stats.pts : D}</td>
          <td className="col-fpts">{stats ? Math.round(stats.fpts * 10) / 10 : 0}</td>
        </tr>
      );
    };

    return (
      <div className="box-score-section">
        <div className="box-score-title">
          <div className="bs-avatar">{teamName[0]?.toUpperCase()}</div>
          <h3>{teamName} {t("阵容统计", "Box Score")}</h3>
        </div>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              {/* Group header row */}
              <tr className="group-header-row">
                <th colSpan={2} className="group-header-left">{t("首发", "STARTERS")}</th>
                <th colSpan={2} className="group-header-mid">{t(`第 ${week} 周`, `Week ${week}`)} ({weekRangeLabel})</th>
                <th colSpan={12} className="group-header-stats">{statsHeaderLabel}</th>
                <th className="group-header-total">TOTAL</th>
              </tr>
              {/* Column header row */}
              <tr>
                <th className="col-slot">SLOT</th>
                <th className="col-player">{t("球员 / 队伍 / 位置", "PLAYER, TEAM POS")}</th>
                <th className="col-opp">OPP</th>
                <th className="col-status">STATUS</th>
                <th>MIN</th>
                <th>FGM</th>
                <th>FGA</th>
                <th>FTM</th>
                <th>FTA</th>
                <th>3PM</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TO</th>
                <th>PTS</th>
                <th className="col-fpts">FPTS</th>
              </tr>
            </thead>
            <tbody>
              {starterRows.length === 0 && benchRows.length === 0 ? (
                <tr>
                  <td colSpan={TOTAL_COLS} className="empty-row">
                    {t("还未选秀 — 暂无球员数据", "No players drafted yet")}
                  </td>
                </tr>
              ) : (
                <>
                  {/* Starter rows */}
                  {starterRows.map(r => renderPlayerRow(r))}

                  {/* Totals row (starters only) */}
                  {starterRows.length > 0 && (
                    <tr className="totals-row">
                      <td colSpan={4}><strong>TOTALS</strong></td>
                      <td>{Math.round(starterTotals.min)}</td>
                      <td>{starterTotals.fgm}</td>
                      <td>{starterTotals.fga}</td>
                      <td>{starterTotals.ftm}</td>
                      <td>{starterTotals.fta}</td>
                      <td>{starterTotals.fg3m}</td>
                      <td>{starterTotals.reb}</td>
                      <td>{starterTotals.ast}</td>
                      <td>{starterTotals.stl}</td>
                      <td>{starterTotals.blk}</td>
                      <td>{starterTotals.tov}</td>
                      <td>{starterTotals.pts}</td>
                      <td className="col-fpts"><strong>{Math.round(starterTotals.fpts * 10) / 10}</strong></td>
                    </tr>
                  )}

                  {/* Bench rows */}
                  {benchRows.map(r => renderPlayerRow(r))}
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Early returns ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="center-msg"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league || !homeTeam || !awayTeam) {
    return (
      <div className="app">
        <Header />
        <div className="center-msg"><p>{t("对阵未找到", "Matchup not found")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const homeScore  = calcWeekTotal(homeRoster, homeLineup);
  const awayScore  = calcWeekTotal(awayRoster, awayLineup);
  const homeName   = homeTeam.fantasy?.name || getMemberName(homeTeam.member);
  const awayName   = awayTeam.fantasy?.name || getMemberName(awayTeam.member);
  const homeOwner  = getMemberName(homeTeam.member);
  const awayOwner  = getMemberName(awayTeam.member);
  const homeRecord = `${homeTeam.fantasy?.wins || 0}-${homeTeam.fantasy?.losses || 0}`;
  const awayRecord = `${awayTeam.fantasy?.wins || 0}-${awayTeam.fantasy?.losses || 0}`;
  const isOwner    = user && league.commissioner_id === user.id;

  // Day labels for the daily breakdown table header
  const dayLabels = weekDates
    .filter((d) => d.getDay() >= 1 && d.getDay() <= 5)
    .map((d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));

  return (
    <div className="app">
      <Header />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span></span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">

          <Link href={`/league/${slug}/scoreboard`} className="back-link">
            ← {t("返回记分板", "Back to Scoreboard")}
          </Link>

          {/* ── Matchup banner ── */}
          <div className="banner-card">
            <div className="banner-row">
              {/* Home */}
              <div className="banner-team">
                <div className="banner-avatar">{homeName[0]?.toUpperCase()}</div>
                <div className="banner-text">
                  <div className="banner-team-name">{homeName}</div>
                  <div className="banner-owner">{homeOwner}</div>
                  <div className="banner-record">{homeRecord}</div>
                </div>
              </div>

              {/* Scores */}
              <div className="banner-center">
                <div className="scores-row">
                  <span className={`big-score ${homeScore >= awayScore ? "score-winning" : "score-losing"}`}>
                    {statsLoading ? "..." : Math.round(homeScore * 10) / 10}
                  </span>
                  <span className="score-divider">-</span>
                  <span className={`big-score ${awayScore >= homeScore ? "score-winning" : "score-losing"}`}>
                    {statsLoading ? "..." : Math.round(awayScore * 10) / 10}
                  </span>
                </div>
                <div className="week-label">{t(`第 ${week} 周`, `Week ${week}`)}</div>
              </div>

              {/* Away */}
              <div className="banner-team banner-team-right">
                <div className="banner-text banner-text-right">
                  <div className="banner-team-name">{awayName}</div>
                  <div className="banner-owner">{awayOwner}</div>
                  <div className="banner-record">{awayRecord}</div>
                </div>
                <div className="banner-avatar">{awayName[0]?.toUpperCase()}</div>
              </div>
            </div>

            {/* ── Daily breakdown ── */}
            <div className="daily-section">
              <div className="table-scroll">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th className="col-team-name">TEAM</th>
                      {dayLabels.map((d) => <th key={d}>{d}</th>)}
                      <th className="col-total">SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="col-team-name">{homeName}</td>
                      {scoringDateStrings.map((dateStr, i) => {
                        const v = Math.round(calcDailyTeamScore(homeRoster, homeLineup, dateStr) * 10) / 10;
                        return <td key={i}>{v > 0 ? v : <span className="zero">-</span>}</td>;
                      })}
                      <td className="col-total"><strong>{Math.round(homeScore * 10) / 10}</strong></td>
                    </tr>
                    <tr>
                      <td className="col-team-name">{awayName}</td>
                      {scoringDateStrings.map((dateStr, i) => {
                        const v = Math.round(calcDailyTeamScore(awayRoster, awayLineup, dateStr) * 10) / 10;
                        return <td key={i}>{v > 0 ? v : <span className="zero">-</span>}</td>;
                      })}
                      <td className="col-total"><strong>{Math.round(awayScore * 10) / 10}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── View selector ── */}
          <div className="view-selector">
            <span className="view-label">{t("查看", "View")}</span>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value)}
              className="view-dropdown"
            >
              <option value="total">
                {viewMode === "total" ? " " : ""}{t("总计", "Total")}
              </option>
              {scoringDateStrings.map((ds) => {
                const d = new Date(`${ds}T00:00:00`);
                const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <option key={ds} value={ds}>
                    {viewMode === ds ? " " : ""}{label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* ── Box scores ── */}
          {renderBoxScore(homeRoster, homeName, homeLineup)}
          {renderBoxScore(awayRoster, awayName, awayLineup)}

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
    gap: 10px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #0a0a0a;
    padding: 24px 16px;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .back-link {
    display: inline-block;
    color: #f59e0b;
    text-decoration: none;
    font-size: 14px;
    margin-bottom: 20px;
  }
  .back-link:hover { text-decoration: underline; }

  /* ── Banner ── */
  .banner-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .banner-row {
    display: flex;
    align-items: center;
    padding: 28px 24px;
    gap: 16px;
  }
  .banner-team {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .banner-team-right {
    flex-direction: row-reverse;
  }
  .banner-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    font-size: 22px;
    font-weight: 700;
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .banner-text { display: flex; flex-direction: column; gap: 3px; }
  .banner-text-right { text-align: right; }
  .banner-team-name { font-size: 18px; font-weight: 700; color: #fff; }
  .banner-owner { font-size: 13px; color: #aaa; }
  .banner-record { font-size: 13px; color: #888; }

  .banner-center { text-align: center; flex-shrink: 0; }
  .scores-row {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }
  .big-score {
    font-size: 40px;
    font-weight: 800;
    min-width: 64px;
    text-align: center;
  }
  .score-winning { color: #fff; }
  .score-losing  { color: #555; }
  .score-divider { font-size: 24px; color: #444; }
  .week-label    { font-size: 13px; color: #888; margin-top: 6px; }

  /* ── Daily breakdown ── */
  .daily-section {
    border-top: 1px solid #1e1e1e;
    padding: 0 24px 20px;
  }
  .table-scroll { overflow-x: auto; }
  .daily-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #ccc;
    min-width: 580px;
  }
  .daily-table th {
    padding: 10px 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    border-bottom: 1px solid #1e1e1e;
    white-space: nowrap;
  }
  .daily-table td {
    padding: 10px 8px;
    text-align: center;
    border-bottom: 1px solid #1a1a1a;
  }
  .col-team-name {
    text-align: left !important;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    padding-right: 16px !important;
  }
  .col-total { font-weight: 700; color: #f59e0b !important; }
  .zero { color: #444; }

  /* ── View selector ── */
  .view-selector {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 20px;
  }
  .view-label {
    font-size: 14px;
    font-weight: 600;
    color: #888;
  }
  .view-dropdown {
    padding: 8px 16px;
    background: #111;
    border: 1px solid #333;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    min-width: 140px;
  }
  .view-dropdown:hover {
    border-color: #f59e0b;
  }

  /* ── Box score ── */
  .box-score-section {
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .box-score-title {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #161616;
    border-bottom: 1px solid #222;
  }
  .bs-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .box-score-title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
  }
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #ccc;
    min-width: 960px;
  }
  .stats-table th {
    padding: 10px 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    background: #141414;
    border-bottom: 1px solid #1e1e1e;
    white-space: nowrap;
  }
  .stats-table td {
    padding: 10px 8px;
    text-align: center;
    border-bottom: 1px solid #1a1a1a;
  }
  .stats-table tr:last-child td { border-bottom: none; }
  .stats-table tr:hover td { background: #161616; }

  /* Group header row */
  .group-header-row th {
    padding: 8px;
    font-size: 11px;
    font-weight: 700;
    color: #888;
    text-transform: uppercase;
    background: #161616;
    border-bottom: 1px solid #222;
  }
  .group-header-left { text-align: left !important; }
  .group-header-mid { text-align: center; color: #666 !important; }
  .group-header-stats { text-align: center; }
  .group-header-total { text-align: center; color: #f59e0b !important; }

  /* Slot column */
  .col-slot {
    text-align: left !important;
    min-width: 50px;
    font-weight: 600;
    color: #888 !important;
  }

  .col-player { text-align: left !important; min-width: 180px; }
  .col-fpts   { color: #f59e0b !important; font-weight: 600; }

  /* OPP column */
  .col-opp {
    min-width: 50px;
    font-weight: 600;
    color: #6ea8fe !important;
  }

  /* STATUS column */
  .col-status {
    min-width: 90px;
    white-space: nowrap;
    font-size: 12px;
  }
  .status-win { color: #4ade80 !important; }
  .status-loss { color: #f87171 !important; }

  .player-cell { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
  .player-name { font-size: 14px; font-weight: 600; color: #fff; }
  .player-team-label { font-size: 11px; color: #666; }

  .row-played td { }
  .row-played .col-fpts { color: #f59e0b !important; }
  .row-played .player-name { color: #fff; }
  .row-played .player-team-label { color: #888; }
  .row-no-game td { color: #555; }
  .row-no-game .player-name { color: #888; }

  .totals-row td {
    background: #161616;
    font-weight: 600;
    color: #fff;
    border-top: 1px solid #2a2a2a;
  }
  .empty-row {
    color: #555;
    padding: 32px !important;
    font-size: 14px;
    text-align: center;
  }
  .center-msg {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  @media (max-width: 640px) {
    .banner-row { flex-direction: column; text-align: center; }
    .banner-team { justify-content: center; }
    .banner-team-right { flex-direction: column; }
    .banner-text-right { text-align: center; }
  }
`;
