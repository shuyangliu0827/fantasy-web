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
import { buildStandingsTable } from "@/lib/fantasy-standings";
import { buildPlayerStatsResolver, computeLeagueWeeklyResults } from "@/lib/fantasy-results";
import { CANONICAL_TIMEZONE, getCurrentWeek, getOfficialLeagueStartDate, getScoringWeekRange } from "@/lib/week-utils";
import type { DateStatsMap } from "@/lib/fantasy-scoring";

const MAX_WEEKS = 20;

type CachedPlayer = { id: number; name: string };

export default function StandingsPage() {
  const { t } = useLang();
  const { slug } = useParams<{ slug: string }>();

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [teamLineups, setTeamLineups] = useState<Record<string, DailyLineupMap>>({});
  const [playerNamesById, setPlayerNamesById] = useState<Map<string, string>>(new Map());
  const [weekDayStats, setWeekDayStats] = useState<Record<string, DateStatsMap>>({});
  const [loading, setLoading] = useState(true);

  const leagueStart = useMemo(() => getOfficialLeagueStartDate(league?.draft_completed_at ?? null), [league?.draft_completed_at]);
  const currentWeek = useMemo(() => getCurrentWeek(leagueStart), [leagueStart]);

  useEffect(() => {
    setUser(getSessionUser());
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
        for (const player of playersResult.players as CachedPlayer[]) {
          map.set(String(player.id), player.name);
        }
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
  }, [slug, currentWeek]);

  const isOwner = Boolean(user && league && league.commissioner_id === user.id);

  const standings = useMemo(() => {
    if (!league) return [];
    const results = computeLeagueWeeklyResults({
      members,
      leagueId: league.id,
      leagueStart,
      totalWeeks: Math.min(MAX_WEEKS, Math.max(0, currentWeek - 1)),
      lineupsByUserId: teamLineups,
      resolvePlayerStats: buildPlayerStatsResolver(weekDayStats, playerNamesById),
    });
    return buildStandingsTable(members, teamNames, results);
  }, [league, members, teamNames, teamLineups, weekDayStats, playerNamesById, leagueStart, currentWeek]);

  const formatPct = (value: number) => (value === 0 ? ".000" : value.toFixed(3).replace(/^0/, ""));
  const formatGb = (value: number) => (value === 0 ? "-" : Number.isInteger(value) ? `${value}` : value.toFixed(1));

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
          <span className="timezone-pill">{t("官方时区", "Official timezone")}: {CANONICAL_TIMEZONE}</span>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>{t("排行榜", "Standings")}</h1>
            <p>{t("基于已完成官方对阵周的真实战绩、得失分与连胜/负计算。", "Computed from completed official matchup weeks using canonical weekly scores.")}</p>
          </div>

          <div className="standings-table-container">
            <table className="standings-table">
              <thead>
                <tr>
                  <th className="rank-col">{t("排名", "Rank")}</th>
                  <th className="team-col">{t("球队", "Team")}</th>
                  <th>{t("胜", "W")}</th>
                  <th>{t("负", "L")}</th>
                  <th>{t("平", "T")}</th>
                  <th>{t("胜率", "PCT")}</th>
                  <th>{t("胜差", "GB")}</th>
                  <th>{t("得分", "PF")}</th>
                  <th>{t("失分", "PA")}</th>
                  <th>{t("连胜/负", "STRK")}</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((team) => (
                  <tr key={team.member.id}>
                    <td className="rank-col"><span className={`rank-badge rank-${team.rank}`}>{team.rank}</span></td>
                    <td className="team-col">
                      <div className="team-info">
                        <span className="team-avatar">{team.teamName[0]?.toUpperCase()}</span>
                        <div className="team-details">
                          <span className="team-name">{team.teamName}</span>
                          <span className="owner-name">{team.member.user?.username || team.member.user?.name || "Anonymous"}</span>
                        </div>
                      </div>
                    </td>
                    <td className="stat">{team.wins}</td>
                    <td className="stat">{team.losses}</td>
                    <td className="stat">{team.ties}</td>
                    <td className="stat">{formatPct(team.pct)}</td>
                    <td className="stat">{formatGb(team.gb)}</td>
                    <td className="stat">{team.pf.toFixed(1)}</td>
                    <td className="stat">{team.pa.toFixed(1)}</td>
                    <td className="stat">{team.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini { background: #ffffff; border-bottom: 1px solid #e5e7eb; }
  .league-header-inner { max-width: 1200px; margin: 0 auto; padding: 16px; display:flex; align-items:center; justify-content:space-between; gap:16px; }
  .league-title { display:flex; align-items:center; gap:12px; color:#111827; text-decoration:none; font-size:20px; font-weight:600; }
  .timezone-pill { display:inline-flex; padding:8px 12px; border-radius:999px; background:#eff6ff; color:#1d4ed8; font-size:12px; font-weight:600; }
  .page-content { min-height: calc(100vh - 200px); background:#f9fafb; padding:24px 16px; }
  .container { max-width: 1200px; margin:0 auto; }
  .page-header { margin-bottom:24px; }
  .page-header h1 { font-size:24px; font-weight:700; color:#111827; margin:0 0 8px 0; }
  .page-header p { font-size:14px; color:#6b7280; margin:0; }
  .standings-table-container { background:#fff; border:1px solid #e5e7eb; border-radius:16px; overflow:hidden; box-shadow:0 12px 36px rgba(15,23,42,0.06); }
  .standings-table { width:100%; border-collapse:collapse; }
  .standings-table th { padding:14px 16px; text-align:left; font-size:12px; font-weight:600; color:#6b7280; text-transform:uppercase; background:#f9fafb; border-bottom:1px solid #e5e7eb; }
  .standings-table td { padding:14px 16px; border-bottom:1px solid #f3f4f6; }
  .standings-table tr:last-child td { border-bottom:none; }
  .standings-table tr:hover { background:#f8fafc; }
  .rank-col { width:60px; }
  .rank-badge { display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:8px; font-size:13px; font-weight:700; background:#e5e7eb; color:#111827; }
  .rank-badge.rank-1 { background:#1d4ed8; color:#fff; }
  .rank-badge.rank-2 { background:#cbd5e1; color:#0f172a; }
  .rank-badge.rank-3 { background:#fed7aa; color:#9a3412; }
  .team-col { min-width:250px; }
  .team-info { display:flex; align-items:center; gap:12px; }
  .team-avatar { width:40px; height:40px; border-radius:50%; background:#dbeafe; color:#1d4ed8; font-size:16px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  .team-details { display:flex; flex-direction:column; gap:2px; }
  .team-name { font-size:14px; font-weight:600; color:#111827; }
  .owner-name, .stat { font-size:14px; color:#6b7280; }
  .loading-container, .error-container { display:grid; place-items:center; min-height:40vh; color:#6b7280; }
`;
