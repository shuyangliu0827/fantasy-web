"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  DailyLineupMap,
  League,
  LeagueMember,
  LineupMap,
  RosterPlayer,
  fetchTeamLineupFromDB,
  fetchTeamRosterFromDB,
  getHistoricalRosterForDate,
  getLeagueBySlug,
  getLeagueMembers,
  getSessionUser,
  supabase,
} from "@/lib/store";
import { getCanonicalMatchupsForWeek } from "@/lib/fantasy-schedule";
import {
  BENCH_SLOTS,
  STARTER_SLOTS,
  buildDailyScoreBreakdownByIds,
  getWeeklyMatchupScoreByIds,
  type DateStatsMap,
  type PlayerGameStats,
} from "@/lib/fantasy-scoring";
import {
  CANONICAL_TIMEZONE,
  getOfficialLeagueStartDate,
  getScoringWeekRange,
  parseDateStr,
} from "@/lib/week-utils";
import { buildWeekRosterStates, fetchRosterHistoryFromDB, mergeRosterStatesByDate } from "@/lib/fantasy-roster-history";

type CachedPlayerStats = {
  id: number;
  name: string;
  team: string;
};

type TeamBundle = {
  member: LeagueMember;
  fantasy: {
    id: string;
    name?: string;
    wins?: number;
    losses?: number;
  } | null;
};

type SlottedPlayerRow = {
  slot: string;
  player: RosterPlayer;
  isStarter: boolean;
};

const SLOT_RENDER_ORDER = [...STARTER_SLOTS, ...BENCH_SLOTS];
const EMPTY_STATS: PlayerGameStats = {
  min: 0,
  fgm: 0,
  fga: 0,
  fg3m: 0,
  ftm: 0,
  fta: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  pts: 0,
  fpts: 0,
};

export default function MatchupDetailPage() {
  const { t, lang } = useLang();
  const { slug, matchupId } = useParams<{ slug: string; matchupId: string }>();
  const [week, matchupIndex] = matchupId.split("-").map((part) => Number(part));

  const [league, setLeague] = useState<League | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [homeTeam, setHomeTeam] = useState<TeamBundle | null>(null);
  const [awayTeam, setAwayTeam] = useState<TeamBundle | null>(null);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [homeRosterByDate, setHomeRosterByDate] = useState<Record<string, RosterPlayer[]>>({});
  const [awayRosterByDate, setAwayRosterByDate] = useState<Record<string, RosterPlayer[]>>({});
  const [homeDailyLineups, setHomeDailyLineups] = useState<DailyLineupMap>({});
  const [awayDailyLineups, setAwayDailyLineups] = useState<DailyLineupMap>({});
  const [weekDayStats, setWeekDayStats] = useState<Record<string, DateStatsMap>>({});
  const [playerStatsCache, setPlayerStatsCache] = useState<Map<string, CachedPlayerStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<string>("total");

  const leagueStart = useMemo(() => getOfficialLeagueStartDate(league?.draft_completed_at ?? null), [league?.draft_completed_at]);
  const weekRange = useMemo(() => getScoringWeekRange(week || 1, leagueStart), [leagueStart, week]);
  const isOwner = Boolean(user && league && league.commissioner_id === user.id);

  useEffect(() => {
    setUser(getSessionUser());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMatchup() {
      setLoading(true);
      const leagueData = await getLeagueBySlug(slug);
      if (!leagueData || cancelled) {
        setLeague(null);
        setLoading(false);
        return;
      }
      setLeague(leagueData);

      const [membersData, teamsDataResult] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase.from("fantasy_teams").select("id, user_id, name, wins, losses").eq("league_id", leagueData.id),
      ]);

      const generatedMatchups = getCanonicalMatchupsForWeek(membersData, leagueData.id, week || 1, getOfficialLeagueStartDate(leagueData.draft_completed_at));
      const selectedMatchup = generatedMatchups[matchupIndex || 0];
      if (!selectedMatchup || cancelled) {
        setLoading(false);
        return;
      }

      const teamsData = teamsDataResult.data || [];
      const homeFantasy = teamsData.find((team) => team.user_id === selectedMatchup.home.user_id) || null;
      const awayFantasy = teamsData.find((team) => team.user_id === selectedMatchup.away.user_id) || null;
      setHomeTeam({ member: selectedMatchup.home, fantasy: homeFantasy });
      setAwayTeam({ member: selectedMatchup.away, fantasy: awayFantasy });

      const [resolvedHomeRoster, resolvedAwayRoster, resolvedHomeLineups, resolvedAwayLineups, homeHistory, awayHistory, statsIndex] = await Promise.all([
        homeFantasy ? fetchTeamRosterFromDB(leagueData.id, homeFantasy.id).catch(() => []) : Promise.resolve([]),
        awayFantasy ? fetchTeamRosterFromDB(leagueData.id, awayFantasy.id).catch(() => []) : Promise.resolve([]),
        homeFantasy ? fetchTeamLineupFromDB(leagueData.id, homeFantasy.id).catch(() => ({} as DailyLineupMap)) : Promise.resolve({} as DailyLineupMap),
        awayFantasy ? fetchTeamLineupFromDB(leagueData.id, awayFantasy.id).catch(() => ({} as DailyLineupMap)) : Promise.resolve({} as DailyLineupMap),
        homeFantasy ? fetchRosterHistoryFromDB(leagueData.id, homeFantasy.id).catch(() => []) : Promise.resolve([]),
        awayFantasy ? fetchRosterHistoryFromDB(leagueData.id, awayFantasy.id).catch(() => []) : Promise.resolve([]),
        fetch("/api/nba-stats").then((response) => response.json()).catch(() => ({ status: "error" })),
      ]);

      if (cancelled) return;
      const homeRostersByDate = weekRange ? buildWeekRosterStates(homeHistory, weekRange.dateStrings) : {};
      const awayRostersByDate = weekRange ? buildWeekRosterStates(awayHistory, weekRange.dateStrings) : {};
      setHomeRosterByDate(homeRostersByDate);
      setAwayRosterByDate(awayRostersByDate);
      setHomeRoster(weekRange ? mergeRosterStatesByDate(homeRostersByDate) : resolvedHomeRoster);
      setAwayRoster(weekRange ? mergeRosterStatesByDate(awayRostersByDate) : resolvedAwayRoster);
      setHomeDailyLineups(resolvedHomeLineups);
      setAwayDailyLineups(resolvedAwayLineups);

      if (statsIndex.status === "success" && Array.isArray(statsIndex.players)) {
        const map = new Map<string, CachedPlayerStats>();
        for (const player of statsIndex.players) {
          map.set(String(player.id), { id: player.id, name: player.name, team: player.team });
        }
        setPlayerStatsCache(map);
      }

      setLoading(false);
    }

    loadMatchup();
    return () => {
      cancelled = true;
    };
  }, [slug, matchupId, week, matchupIndex]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeekStats() {
      if (!weekRange) {
        setWeekDayStats({});
        return;
      }
      setStatsLoading(true);
      try {
        const results = await Promise.all(
          weekRange.dateStrings.map(async (date) => {
            const response = await fetch(`/api/nba-game-stats?date=${date}`);
            const payload = await response.json();
            return [date, payload.status === "success" ? (payload.stats as DateStatsMap) : {}] as const;
          }),
        );
        if (!cancelled) setWeekDayStats(Object.fromEntries(results));
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch matchup week stats", error);
          setWeekDayStats({});
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    loadWeekStats();
    return () => {
      cancelled = true;
    };
  }, [weekRange]);

  function getMemberName(member: LeagueMember) {
    return member.user?.username || member.user?.name || "Anonymous";
  }

  function getPlayerDayStatsById(playerId: string, dateStr: string): PlayerGameStats | null {
    const dayMap = weekDayStats[dateStr];
    if (!dayMap) return null;
    if (dayMap[playerId]) return dayMap[playerId];

    const cached = playerStatsCache.get(playerId);
    if (cached) {
      for (const [candidateId, stats] of Object.entries(dayMap)) {
        const candidate = playerStatsCache.get(candidateId);
        if (candidate?.name === cached.name) return stats;
      }
    }

    return null;
  }

  function getRowsForView(roster: RosterPlayer[], dailyLineups: DailyLineupMap): SlottedPlayerRow[] {
    // Build playerMap from the FULL roster array (includes historical entries with releasedAt).
    // This ensures players who were on the team during this week but have since been released
    // are still resolvable by id (they appear in the lineup snapshots).
    const playerMap = new Map(roster.map((player) => [player.id, player]));
    const assigned = new Set<string>();
    const rows: SlottedPlayerRow[] = [];

    // Determine which date to use for filtering the "unassigned" section.
    // For total view: use the week's start date as the anchor.
    // For per-date view: use that specific date.
    const filterDate = viewMode === "total"
      ? (weekRange?.dateStrings[0] ?? null)
      : viewMode;

    // Historical roster for the current view: only players who were on the team on filterDate.
    // This prevents future pickups from appearing in past matchup views.
    const historicalRoster = filterDate
      ? getHistoricalRosterForDate(roster, filterDate)
      : roster;
    const historicalRosterIds = new Set(historicalRoster.map(p => p.id));

    if (viewMode === "total") {
      const assignmentByPlayer = new Map<string, { slot: string; isStarter: boolean; weight: number }>();

      for (const [index, dateStr] of (weekRange?.dateStrings || []).entries()) {
        const lineup = dailyLineups[dateStr] || {};
        for (const [slot, playerId] of Object.entries(lineup)) {
          if (!playerId) continue;
          const isStarter = STARTER_SLOTS.includes(slot as typeof STARTER_SLOTS[number]);
          const candidateWeight = index * 10 + (isStarter ? 1 : 0);
          const existing = assignmentByPlayer.get(playerId);
          if (!existing || candidateWeight >= existing.weight) {
            assignmentByPlayer.set(playerId, { slot, isStarter, weight: candidateWeight });
          }
        }
      }

      for (const slot of SLOT_RENDER_ORDER) {
        for (const [playerId, assignment] of assignmentByPlayer.entries()) {
          if (assignment.slot !== slot) continue;
          const player = playerMap.get(playerId);
          if (!player || assigned.has(playerId)) continue;
          assigned.add(playerId);
          rows.push({ slot: assignment.slot, player, isStarter: assignment.isStarter });
        }
      }
    } else {
      const lineupForView: LineupMap = dailyLineups[viewMode] || {};
      for (const slot of SLOT_RENDER_ORDER) {
        const playerId = lineupForView[slot];
        const player = playerId ? playerMap.get(playerId) : undefined;
        if (!player) continue;
        assigned.add(player.id);
        rows.push({ slot, player, isStarter: STARTER_SLOTS.includes(slot as typeof STARTER_SLOTS[number]) });
      }
    }

    // Only show unassigned players who were historically on the roster on filterDate.
    // This prevents future pickups from appearing in historical matchup views.
    for (const player of historicalRoster) {
      if (!assigned.has(player.id)) rows.push({ slot: "BE", player, isStarter: false });
    }

    return rows;
  }

  function getPlayerTotalStats(player: RosterPlayer): PlayerGameStats {
    if (!weekRange) return EMPTY_STATS;
    return weekRange.dateStrings.reduce<PlayerGameStats>((totals, dateStr) => {
      const stats = getPlayerDayStatsById(player.id, dateStr);
      if (!stats) return totals;
      return {
        min: totals.min + stats.min,
        fgm: totals.fgm + stats.fgm,
        fga: totals.fga + stats.fga,
        fg3m: totals.fg3m + stats.fg3m,
        ftm: totals.ftm + stats.ftm,
        fta: totals.fta + stats.fta,
        reb: totals.reb + stats.reb,
        ast: totals.ast + stats.ast,
        stl: totals.stl + stats.stl,
        blk: totals.blk + stats.blk,
        tov: totals.tov + stats.tov,
        pts: totals.pts + stats.pts,
        fpts: totals.fpts + stats.fpts,
      };
    }, { ...EMPTY_STATS });
  }

  function getStatsForView(player: RosterPlayer): PlayerGameStats {
    if (viewMode === "total") return getPlayerTotalStats(player);
    return getPlayerDayStatsById(player.id, viewMode) || EMPTY_STATS;
  }

  const homeName = homeTeam?.fantasy?.name || (homeTeam ? getMemberName(homeTeam.member) : "");
  const awayName = awayTeam?.fantasy?.name || (awayTeam ? getMemberName(awayTeam.member) : "");
  const rangeLabel = weekRange ? `${weekRange.startDate} → ${weekRange.endDate}` : t("待官方启用", "Pending official start");
  const homeDailyScores = weekRange ? buildDailyScoreBreakdownByIds(homeDailyLineups, weekRange.dateStrings, getPlayerDayStatsById) : {};
  const awayDailyScores = weekRange ? buildDailyScoreBreakdownByIds(awayDailyLineups, weekRange.dateStrings, getPlayerDayStatsById) : {};
  const homeScore = weekRange ? getWeeklyMatchupScoreByIds(homeDailyLineups, weekRange.dateStrings, getPlayerDayStatsById) : 0;
  const awayScore = weekRange ? getWeeklyMatchupScoreByIds(awayDailyLineups, weekRange.dateStrings, getPlayerDayStatsById) : 0;
  function renderScoreSummary(teamName: string, ownerName: string, record: string, score: number, side: "home" | "away", leading: boolean) {
    return (
      <div className={`summary-team ${leading ? "leading" : ""}`}>
        <div className={`summary-avatar ${side}`}>{teamName[0]?.toUpperCase()}</div>
        <div className="summary-copy">
          <strong>{teamName}</strong>
          <span>{ownerName}</span>
          <small>{record}</small>
        </div>
        <div className="summary-score">{statsLoading ? "..." : score.toFixed(1)}</div>
      </div>
    );
  }

  function renderLineupTable(teamName: string, roster: RosterPlayer[], dailyLineups: DailyLineupMap) {
    const rows = getRowsForView(roster, dailyLineups);
    return (
      <section className="table-card">
        <div className="table-card-header">
          <div>
            <p className="table-eyebrow">{teamName}</p>
            <h3>{t("首发/替补明细", "Starter and bench detail")}</h3>
          </div>
          <span className="table-context">{viewMode === "total" ? t("本周累计", "Weekly total") : viewMode}</span>
        </div>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th>{t("槽位", "Slot")}</th>
                <th>{t("球员", "Player")}</th>
                <th>{t("身份", "Role")}</th>
                <th>MIN</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TO</th>
                <th>PTS</th>
                <th>FPTS</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="empty-row">{t("暂无阵容数据", "No lineup data yet")}</td>
                </tr>
              ) : (
                rows.map((row) => {
                  const stats = getStatsForView(row.player);
                  const countsForScore = viewMode === "total"
                    ? Boolean((weekRange?.dateStrings || []).some((dateStr) => STARTER_SLOTS.some((slot) => dailyLineups[dateStr]?.[slot] === row.player.id)))
                    : STARTER_SLOTS.some((slot) => dailyLineups[viewMode]?.[slot] === row.player.id);
                  return (
                    <tr key={`${row.slot}-${row.player.id}`}>
                      <td>{row.slot === "BE" ? "BE" : row.slot.replace("UTIL", "UTIL ")}</td>
                      <td>
                        <div className="player-cell">
                          <strong>{row.player.name}</strong>
                          <span>{row.player.team} · {row.player.position}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`role-chip ${countsForScore ? "starter" : "bench"}`}>
                          {countsForScore ? t("计分", "Counts") : t("不计分", "No count")}
                        </span>
                      </td>
                      <td>{Math.round(stats.min)}</td>
                      <td>{stats.reb}</td>
                      <td>{stats.ast}</td>
                      <td>{stats.stl}</td>
                      <td>{stats.blk}</td>
                      <td>{stats.tov}</td>
                      <td>{stats.pts}</td>
                      <td className="fpts-cell">{stats.fpts.toFixed(1)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="page-shell">
        <LightHeader activeHref="/league" />
        <div className="state-card">{t("加载中...", "Loading...")}</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league || !homeTeam || !awayTeam) {
    return (
      <div className="page-shell">
        <LightHeader activeHref="/league" />
        <div className="state-card">{t("对阵不存在", "Matchup not found")}</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <LightHeader activeHref="/league" />

      <div className="league-bar">
        <div className="container league-bar-inner">
          <Link href={`/league/${slug}`} className="league-link">
            <span className="league-dot" />
            <span>{league.name}</span>
          </Link>
          <span className="timezone-pill">{t("官方时区", "Official timezone")}: {CANONICAL_TIMEZONE}</span>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container layout-stack">
          <Link href={`/league/${slug}/scoreboard`} className="back-link">← {t("返回记分板", "Back to scoreboard")}</Link>

          <section className="hero-card">
            <div className="hero-copy">
              <p className="eyebrow">{t("对阵详情", "Matchup detail")}</p>
              <h1>{t(`第 ${week} 周`, `Week ${week}`)}</h1>
              <p>
                {t(
                  "比分仅统计该日期已保存首发阵容中的有效首发槽位，板凳和未上场球员不会被追溯计入。",
                  "Scores count only the valid starter slots saved for that date; bench and non-starting players never get retroactively added.",
                )}
              </p>
            </div>
            <div className="hero-meta">
              <div className="meta-line"><span>{t("日期范围", "Date range")}</span><strong>{rangeLabel}</strong></div>
              <div className="meta-line"><span>{t("计分时区", "Scoring timezone")}</span><strong>{CANONICAL_TIMEZONE}</strong></div>
            </div>
          </section>

          <section className="summary-card">
            <div className="summary-grid">
              {renderScoreSummary(homeName, getMemberName(homeTeam.member), `${homeTeam.fantasy?.wins || 0}-${homeTeam.fantasy?.losses || 0}`, homeScore, "home", homeScore >= awayScore)}
              <div className="summary-center">
                <span className="summary-pill">{t("周累计", "Weekly total")}</span>
                <div className="summary-gap">{Math.abs(homeScore - awayScore).toFixed(1)}</div>
                <small>{t("分差", "Margin")}</small>
              </div>
              {renderScoreSummary(awayName, getMemberName(awayTeam.member), `${awayTeam.fantasy?.wins || 0}-${awayTeam.fantasy?.losses || 0}`, awayScore, "away", awayScore >= homeScore)}
            </div>

            <div className="breakdown-card">
              <div className="breakdown-header">
                <div>
                  <p className="table-eyebrow">{t("周度拆分", "Weekly breakdown")}</p>
                  <h2>{t("每日首发得分", "Daily starter score")}</h2>
                </div>
                <div className="view-control">
                  <span>{t("查看", "View")}</span>
                  <select value={viewMode} onChange={(event) => setViewMode(event.target.value)}>
                    <option value="total">{t("总计", "Total")}</option>
                    {weekRange?.dateStrings.map((date) => (
                      <option key={date} value={date}>{date}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="table-scroll">
                <table className="breakdown-table">
                  <thead>
                    <tr>
                      <th>{t("球队", "Team")}</th>
                      {weekRange?.dateStrings.map((date) => {
                        const parsed = parseDateStr(date);
                        const weekday = parsed.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", { weekday: "short", timeZone: CANONICAL_TIMEZONE });
                        return <th key={date}>{date}<small>{weekday}</small></th>;
                      })}
                      <th>{t("总分", "Total")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="row-team">{homeName}</td>
                      {weekRange?.dateStrings.map((date) => <td key={date}>{homeDailyScores[date]?.toFixed(1) || "0.0"}</td>)}
                      <td className="row-total">{homeScore.toFixed(1)}</td>
                    </tr>
                    <tr>
                      <td className="row-team">{awayName}</td>
                      {weekRange?.dateStrings.map((date) => <td key={date}>{awayDailyScores[date]?.toFixed(1) || "0.0"}</td>)}
                      <td className="row-total">{awayScore.toFixed(1)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <div className="tables-grid">
            {renderLineupTable(homeName, homeRoster, homeDailyLineups)}
            {renderLineupTable(awayName, awayRoster, awayDailyLineups)}
          </div>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page-shell {
    min-height: 100vh;
    background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
  }
  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 20px;
  }
  .league-bar {
    background: rgba(255, 255, 255, 0.88);
    border-bottom: 1px solid #e2e8f0;
    backdrop-filter: blur(12px);
  }
  .league-bar-inner {
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .league-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #0f172a;
    text-decoration: none;
    font-size: 18px;
    font-weight: 700;
  }
  .league-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #f59e0b;
    box-shadow: 0 0 0 6px #fff7ed;
  }
  .timezone-pill {
    display: inline-flex;
    align-items: center;
    border: 1px solid #dbeafe;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
  }
  .page-content {
    padding: 28px 0 56px;
  }
  .layout-stack {
    display: grid;
    gap: 20px;
  }
  .hero-card,
  .summary-card,
  .table-card,
  .breakdown-card {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(226, 232, 240, 0.95);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
    border-radius: 24px;
  }
  .back-link {
    color: #1d4ed8;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
  }
  .hero-card {
    padding: 28px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .eyebrow, .table-eyebrow {
    margin: 0 0 8px;
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .hero-copy h1,
  .breakdown-header h2,
  .table-card-header h3 {
    margin: 0;
    color: #0f172a;
  }
  .hero-copy p:last-child {
    margin: 12px 0 0;
    color: #475569;
    line-height: 1.65;
    max-width: 700px;
  }
  .hero-meta {
    min-width: min(100%, 320px);
    display: grid;
    gap: 12px;
  }
  .meta-line {
    padding: 16px 18px;
    border-radius: 18px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  .meta-line span,
  .meta-line strong {
    display: block;
  }
  .meta-line span {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .meta-line strong {
    color: #0f172a;
    font-size: 20px;
  }
  .summary-card {
    padding: 24px;
    display: grid;
    gap: 20px;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 160px minmax(0, 1fr);
    gap: 16px;
    align-items: center;
  }
  .summary-team {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 18px;
    border-radius: 20px;
    background: #f8fafc;
    border: 1px solid transparent;
  }
  .summary-team.leading {
    background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
    border-color: #bfdbfe;
  }
  .summary-avatar {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: #1e3a8a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    font-weight: 800;
    flex-shrink: 0;
  }
  .summary-avatar.away { background: #2563eb; }
  .summary-copy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .summary-copy strong {
    color: #0f172a;
    font-size: 18px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .summary-copy span,
  .summary-copy small {
    color: #64748b;
  }
  .summary-score {
    margin-left: auto;
    color: #0f172a;
    font-size: 40px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  .summary-center {
    text-align: center;
    display: grid;
    gap: 6px;
    justify-items: center;
  }
  .summary-pill {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 6px 12px;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 12px;
    font-weight: 700;
  }
  .summary-gap {
    font-size: 34px;
    font-weight: 800;
    color: #0f172a;
  }
  .summary-center small { color: #64748b; }
  .breakdown-card {
    padding: 20px;
  }
  .breakdown-header,
  .table-card-header,
  .view-control {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .view-control span {
    color: #64748b;
    font-size: 13px;
    font-weight: 600;
  }
  .view-control select {
    min-width: 140px;
    padding: 10px 12px;
    border-radius: 12px;
    border: 1px solid #dbe3ef;
    background: #fff;
    color: #0f172a;
    font-weight: 600;
  }
  .table-scroll { overflow-x: auto; }
  .breakdown-table,
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 720px;
  }
  .breakdown-table th,
  .breakdown-table td,
  .stats-table th,
  .stats-table td {
    padding: 14px 12px;
    border-bottom: 1px solid #e2e8f0;
    text-align: center;
    font-size: 13px;
  }
  .breakdown-table thead th,
  .stats-table thead th {
    background: #f8fafc;
    color: #475569;
    font-weight: 700;
  }
  .breakdown-table th small {
    display: block;
    margin-top: 4px;
    font-size: 11px;
    color: #94a3b8;
  }
  .row-team,
  .player-cell {
    text-align: left;
  }
  .row-team,
  .row-total,
  .fpts-cell {
    font-weight: 700;
    color: #0f172a;
  }
  .tables-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
  }
  .table-card {
    overflow: hidden;
  }
  .table-card-header {
    padding: 20px 20px 0;
  }
  .table-context {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 6px 10px;
    background: #fff7ed;
    color: #c2410c;
    font-size: 12px;
    font-weight: 700;
  }
  .player-cell {
    display: grid;
    gap: 4px;
  }
  .player-cell strong {
    color: #0f172a;
  }
  .player-cell span {
    color: #64748b;
    font-size: 12px;
  }
  .role-chip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 5px 10px;
    font-size: 12px;
    font-weight: 700;
  }
  .role-chip.starter {
    background: #dbeafe;
    color: #1d4ed8;
  }
  .role-chip.bench {
    background: #f1f5f9;
    color: #64748b;
  }
  .empty-row {
    color: #64748b;
  }
  .state-card {
    margin: 48px auto;
    max-width: 420px;
    padding: 24px;
    border-radius: 18px;
    background: #fff;
    color: #475569;
    text-align: center;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  }
  @media (max-width: 960px) {
    .summary-grid,
    .tables-grid {
      grid-template-columns: 1fr;
    }
    .summary-score { font-size: 32px; }
  }
  @media (max-width: 720px) {
    .container { padding: 0 14px; }
    .league-bar-inner { align-items: flex-start; padding-top: 14px; padding-bottom: 14px; flex-direction: column; }
    .hero-card, .summary-card, .breakdown-card { padding: 18px; }
  }
`;
