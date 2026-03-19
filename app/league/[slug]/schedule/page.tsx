"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  DailyLineupMap,
  League,
  LeagueMember,
  fetchTeamLineupFromDB,
  getLeagueBySlug,
  getLeagueMembers,
  getSessionUser,
  supabase,
} from "@/lib/store";
import { getScheduleEntriesForMember } from "@/lib/fantasy-schedule";
import { buildPlayerStatsResolver, computeLeagueWeeklyResults } from "@/lib/fantasy-results";
import { CANONICAL_TIMEZONE, getCurrentWeek, getOfficialLeagueStartDate, getScoringWeekRange, getWeekStatus } from "@/lib/week-utils";
import type { DateStatsMap } from "@/lib/fantasy-scoring";

const MAX_WEEKS = 20;

type CachedPlayer = { id: number; name: string };

export default function SchedulePage() {
  const { t } = useLang();
  const { slug } = useParams<{ slug: string }>();

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamLineups, setTeamLineups] = useState<Record<string, DailyLineupMap>>({});
  const [playerNamesById, setPlayerNamesById] = useState<Map<string, string>>(new Map());
  const [weekDayStats, setWeekDayStats] = useState<Record<string, DateStatsMap>>({});
  const [loading, setLoading] = useState(true);

  const leagueStart = useMemo(() => getOfficialLeagueStartDate(league?.draft_completed_at ?? null), [league?.draft_completed_at]);
  const currentWeek = useMemo(() => getCurrentWeek(leagueStart), [leagueStart]);

  useEffect(() => {
    const sessionUser = getSessionUser();
    setUser(sessionUser);
    if (sessionUser) setSelectedUserId(sessionUser.id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      const leagueData = await getLeagueBySlug(slug);
      if (!leagueData || cancelled) {
        setLeague(null);
        setLoading(false);
        return;
      }
      setLeague(leagueData);

      const [membersData, teamsResult, playersResult] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase.from("fantasy_teams").select("id, user_id, name").eq("league_id", leagueData.id),
        fetch("/api/nba-stats").then((response) => response.json()).catch(() => ({ status: "error" })),
      ]);
      if (cancelled) return;
      setMembers(membersData);

      if (!selectedUserId && membersData[0]) setSelectedUserId(membersData[0].user_id);

      const lineupsByUserId: Record<string, DailyLineupMap> = {};
      const namesByUserId: Record<string, string> = {};
      for (const team of teamsResult.data || []) {
        lineupsByUserId[team.user_id] = await fetchTeamLineupFromDB(leagueData.id, team.id);
        namesByUserId[team.user_id] = team.name || "";
      }
      if (cancelled) return;
      setTeamLineups(lineupsByUserId);
      setTeamNames(namesByUserId);

      if (playersResult.status === "success" && Array.isArray(playersResult.players)) {
        const map = new Map<string, string>();
        for (const player of playersResult.players as CachedPlayer[]) map.set(String(player.id), player.name);
        setPlayerNamesById(map);
      }

      const completedWeeks = Math.max(0, currentWeek - 1);
      const dates = new Set<string>();
      for (let week = 1; week <= Math.min(MAX_WEEKS, completedWeeks); week += 1) {
        const range = getScoringWeekRange(week, getOfficialLeagueStartDate(leagueData.draft_completed_at));
        for (const dateStr of range?.dateStrings || []) dates.add(dateStr);
      }
      const statsEntries = await Promise.all(
        [...dates].sort().map(async (dateStr) => {
          const response = await fetch(`/api/nba-game-stats?date=${dateStr}`);
          const payload = await response.json();
          return [dateStr, payload.status === "success" ? (payload.stats as DateStatsMap) : {}] as const;
        }),
      );
      if (!cancelled) setWeekDayStats(Object.fromEntries(statsEntries));
      if (!cancelled) setLoading(false);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [slug, currentWeek, selectedUserId]);

  const isOwner = Boolean(user && league && league.commissioner_id === user.id);
  const selectedMember = members.find((member) => member.user_id === selectedUserId) || null;
  const scheduleEntries = useMemo(
    () => (league ? getScheduleEntriesForMember(members, league.id, selectedUserId, leagueStart, MAX_WEEKS) : []),
    [league, members, selectedUserId, leagueStart],
  );

  const results = useMemo(() => {
    if (!league) return [];
    return computeLeagueWeeklyResults({
      members,
      leagueId: league.id,
      leagueStart,
      totalWeeks: Math.min(MAX_WEEKS, Math.max(0, currentWeek - 1)),
      lineupsByUserId: teamLineups,
      resolvePlayerStats: buildPlayerStatsResolver(weekDayStats, playerNamesById),
    });
  }, [league, members, leagueStart, currentWeek, teamLineups, weekDayStats, playerNamesById]);

  const resultsByWeek = new Map(results.map((result) => [result.week, result]));
  const getMemberName = (member: LeagueMember) => member.user?.username || member.user?.name || "Anonymous";

  const getRecordBeforeWeek = (userId: string, week: number) => {
    let wins = 0;
    let losses = 0;
    let ties = 0;
    for (const result of results) {
      if (result.week >= week) continue;
      if (result.homeTeamId === userId) {
        if (result.result === "home_win") wins += 1;
        else if (result.result === "away_win") losses += 1;
        else ties += 1;
      } else if (result.awayTeamId === userId) {
        if (result.result === "away_win") wins += 1;
        else if (result.result === "home_win") losses += 1;
        else ties += 1;
      }
    }
    return `${wins}-${losses}-${ties}`;
  };

  if (loading) {
    return <div className="app"><LightHeader activeHref="/league" /><div className="loading-container"><p>{t("加载中...", "Loading...")}</p></div><style jsx>{styles}</style></div>;
  }

  if (!league) {
    return <div className="app"><LightHeader activeHref="/league" /><div className="loading-container"><p>{t("联赛不存在", "League not found")}</p></div><style jsx>{styles}</style></div>;
  }

  return (
    <div className="app">
      <LightHeader activeHref="/league" />
      <div className="league-bar">
        <div className="container league-bar-inner">
          <Link href={`/league/${slug}`} className="league-link"><span className="league-dot" />{league.name}</Link>
          <span className="timezone-pill">{t("官方时区", "Official timezone")}: {CANONICAL_TIMEZONE}</span>
        </div>
      </div>
      <LeagueNav slug={slug} isOwner={isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container layout-stack">
          <section className="hero-card">
            <div>
              <p className="eyebrow">{t("官方赛程", "Canonical schedule")}</p>
              <h1>{t("统一对阵日程", "Unified matchup schedule")}</h1>
              <p className="subcopy">{t("赛程、记分板、对阵详情与排行榜现在共享同一套周定义与对阵配对。", "Schedule, scoreboard, matchup detail, and standings now share the same week definitions and pairings.")}</p>
            </div>
            <div className="toolbar">
              <label>{t("查看球队", "View team")}</label>
              <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)}>
                {members.map((member) => <option key={member.id} value={member.user_id}>{teamNames[member.user_id] || getMemberName(member)}</option>)}
              </select>
            </div>
          </section>

          <section className="table-card">
            <div className="table-card-header">
              <div>
                <p className="table-eyebrow">{selectedMember ? getMemberName(selectedMember) : t("球队", "Team")}</p>
                <h2>{t("对阵列表", "Matchup list")}</h2>
              </div>
            </div>
            <div className="table-scroll">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>{t("周次", "Week")}</th>
                    <th>{t("日期", "Dates")}</th>
                    <th>{t("对手", "Opponent")}</th>
                    <th>{t("战绩", "Record")}</th>
                    <th>{t("比分", "Score")}</th>
                    <th>{t("状态", "Status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {scheduleEntries.map((entry) => {
                    const result = resultsByWeek.get(entry.week);
                    const weekStatus = getWeekStatus(entry.week, leagueStart);
                    const myScore = result
                      ? (result.homeTeamId === selectedUserId ? result.homeScore : result.awayScore)
                      : null;
                    const oppScore = result
                      ? (result.homeTeamId === selectedUserId ? result.awayScore : result.homeScore)
                      : null;
                    return (
                      <tr key={entry.id}>
                        <td><Link href={`/league/${slug}/matchup/${entry.id}`}>{t(`第 ${entry.week} 周`, `Week ${entry.week}`)}</Link></td>
                        <td>{entry.startDate} → {entry.endDate}</td>
                        <td>{entry.isHome ? "vs" : "@"} {teamNames[entry.opponent.user_id] || getMemberName(entry.opponent)}</td>
                        <td>{getRecordBeforeWeek(selectedUserId, entry.week)}</td>
                        <td>{myScore === null ? "—" : `${myScore.toFixed(1)} - ${oppScore?.toFixed(1)}`}</td>
                        <td><span className={`status-chip ${weekStatus}`}>{weekStatus}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .app { min-height:100vh; background:#f8fafc; }
  .league-bar { background:#fff; border-bottom:1px solid #e5e7eb; }
  .container { max-width:1200px; margin:0 auto; }
  .league-bar-inner { padding:16px; display:flex; justify-content:space-between; align-items:center; gap:16px; }
  .league-link { display:flex; align-items:center; gap:10px; font-weight:700; color:#111827; text-decoration:none; }
  .league-dot { width:10px; height:10px; border-radius:50%; background:#2563eb; }
  .timezone-pill { display:inline-flex; padding:8px 12px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:600; }
  .page-content { padding:24px 16px 48px; }
  .layout-stack { display:grid; gap:20px; }
  .hero-card, .table-card { background:#fff; border:1px solid #e5e7eb; border-radius:16px; box-shadow:0 12px 36px rgba(15,23,42,0.06); }
  .hero-card { padding:24px; display:flex; justify-content:space-between; gap:24px; align-items:end; }
  .eyebrow, .table-eyebrow { margin:0 0 8px; font-size:12px; text-transform:uppercase; color:#2563eb; font-weight:700; letter-spacing:0.08em; }
  h1, h2 { margin:0; color:#0f172a; }
  .subcopy { margin:12px 0 0; color:#64748b; max-width:720px; }
  .toolbar { display:grid; gap:8px; min-width:220px; }
  .toolbar label { font-size:12px; font-weight:700; color:#64748b; text-transform:uppercase; }
  .toolbar select { border:1px solid #cbd5e1; border-radius:12px; padding:10px 12px; background:#fff; }
  .table-card-header { padding:20px 20px 0; }
  .table-scroll { overflow:auto; }
  .schedule-table { width:100%; border-collapse:collapse; }
  .schedule-table th, .schedule-table td { padding:14px 20px; border-bottom:1px solid #e5e7eb; text-align:left; }
  .schedule-table th { font-size:12px; text-transform:uppercase; color:#64748b; background:#f8fafc; }
  .schedule-table tr:last-child td { border-bottom:none; }
  .status-chip { display:inline-flex; padding:6px 10px; border-radius:999px; font-size:12px; font-weight:700; text-transform:capitalize; }
  .status-chip.past { background:#dcfce7; color:#166534; }
  .status-chip.current { background:#dbeafe; color:#1d4ed8; }
  .status-chip.future, .status-chip.pending { background:#f1f5f9; color:#475569; }
  .loading-container { min-height:40vh; display:grid; place-items:center; color:#64748b; }
`;
