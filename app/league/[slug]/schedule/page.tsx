"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  DailyLineupMap,
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  League,
  LeagueMember,
  supabase,
} from "@/lib/store";
import { generateMatchupsForWeek } from "@/lib/fantasy-matchups";
import {
  CANONICAL_TIMEZONE,
  getOfficialLeagueStartDate,
  getWeekDateStrings,
  getWeekStatus as getCanonicalWeekStatus,
} from "@/lib/week-utils";

// ── Schedule constants ────────────────────────────────────────────────────────
// Season end: NBA Finals Game 7 (approx June 22, 2026) — UTC.
const NBA_FINALS_END_UTC = new Date("2026-06-22T00:00:00.000Z");

/** Format "Mar 16 - 22" or "Mar 30 - Apr 5" from two YYYY-MM-DD strings (UTC). */
function formatScheduleDateRange(startStr: string, endStr: string): string {
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [sy, sm, sd] = startStr.split("-").map(Number);
  const [, em, ed] = endStr.split("-").map(Number);
  const startLabel = `${MONTHS[sm - 1]} ${sd}`;
  if (sm === em) return `${startLabel} - ${ed}`;
  return `${startLabel} - ${MONTHS[em - 1]} ${ed}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────
type MatchupEntry = {
  week: number;
  label: string;
  dateRange: string;
  opponent: LeagueMember;
  isHome: boolean;
  isPlayoff: boolean;
  playoffRound?: number;
};

export default function SchedulePage() {
  const { t } = useLang();
  const { slug } = useParams<{ slug: string }>();

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  // Real completed-matchup scores fetched from DB
  const [completedMatchups, setCompletedMatchups] = useState<Record<string, { home_score: number; away_score: number; winner_id: string | null }>>({});
  const [loading, setLoading] = useState(true);

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
      const [membersData, matchupsResult] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase
          .from("matchups")
          .select("week, home_team_id, away_team_id, home_score, away_score, winner_id")
          .eq("league_id", leagueData.id)
          .eq("status", "completed"),
      ]);
      setMembers(membersData);
      // Build lookup: "{week}-{home_team_id}-{away_team_id}" → scores
      if (matchupsResult.data) {
        const lookup: Record<string, { home_score: number; away_score: number; winner_id: string | null }> = {};
        for (const row of matchupsResult.data) {
          const key = `${row.week}-${row.home_team_id}-${row.away_team_id}`;
          lookup[key] = { home_score: row.home_score, away_score: row.away_score, winner_id: row.winner_id };
        }
        setCompletedMatchups(lookup);
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, [slug]);

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

  // ── Canonical league start and total-weeks computation ───────────────────
  const leagueStart = useMemo(
    () => getOfficialLeagueStartDate(league?.draft_completed_at ?? null),
    [league?.draft_completed_at],
  );

  const totalWeeks = useMemo(() => {
    if (!leagueStart) return 20; // fallback
    const diffMs = NBA_FINALS_END_UTC.getTime() - leagueStart.getTime();
    return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)));
  }, [leagueStart]);

  const n = members.length;
  const playoffRounds = n >= 8 ? 3 : n >= 4 ? 2 : 1;
  const regularSeasonWeeks = Math.max(1, totalWeeks - playoffRounds);

  // ── Generate full round-robin schedule using the SAME canonical function as scoreboard ──
  const fullSchedule = useMemo(() => {
    if (!league || members.length < 2 || !leagueStart) return new Map<string, MatchupEntry[]>();

    const scheduleMap = new Map<string, MatchupEntry[]>();
    for (const m of members) scheduleMap.set(m.user_id, []);

    for (let week = 1; week <= totalWeeks; week++) {
      const dateStrings = getWeekDateStrings(week, leagueStart);
      if (dateStrings.length < 7) break;
      const dateRange = formatScheduleDateRange(dateStrings[0], dateStrings[6]);
      const isPlayoff = week > regularSeasonWeeks;
      const playoffRound = isPlayoff ? week - regularSeasonWeeks : undefined;
      const label = isPlayoff
        ? t(`季后赛第 ${playoffRound} 轮`, `Playoff Round ${playoffRound}`)
        : t(`第 ${week} 周`, `Matchup ${week}`);

      // Use the canonical generateMatchupsForWeek — same function scoreboard uses.
      const weekMatchups = generateMatchupsForWeek(members, league.id, week);
      for (const matchup of weekMatchups) {
        const homeEntry: MatchupEntry = {
          week,
          label,
          dateRange: `(${dateRange})`,
          opponent: matchup.away,
          isHome: true,
          isPlayoff,
          playoffRound,
        };
        const awayEntry: MatchupEntry = {
          week,
          label,
          dateRange: `(${dateRange})`,
          opponent: matchup.home,
          isHome: false,
          isPlayoff,
          playoffRound,
        };
        scheduleMap.get(matchup.home.user_id)?.push(homeEntry);
        scheduleMap.get(matchup.away.user_id)?.push(awayEntry);
      }
    }

    return scheduleMap;
  }, [league, members, leagueStart, totalWeeks, regularSeasonWeeks, t]);

  const selectedMember = members.find((m) => m.user_id === selectedUserId);
  const selectedSchedule = fullSchedule.get(selectedUserId) || [];
  const selectedName = selectedMember ? getMemberName(selectedMember) : "";

  function getEntryStatus(week: number): "pending" | "past" | "current" | "future" {
    return getCanonicalWeekStatus(week, leagueStart);
  }

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
      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">

          {members.length < 2 ? (
              <div className="empty-state">
                <div className="empty-icon">📅</div>
                <h3>{t("还没有赛程", "No schedule yet")}</h3>
                <p>
                  {t(
                    "联赛需要至少2支队伍才能生成赛程",
                    "League needs at least 2 teams to generate schedule"
                  )}
                </p>
              </div>
            ) : (
              <div className="schedule-table-wrapper">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th className="col-matchup"></th>
                      <th className="col-score">{t("比分", "SCORE")}</th>
                      <th className="col-opponent">{t("对手", "OPPONENT")}</th>
                      <th className="col-manager">{t("队伍经理", "TEAM MANAGER(S)")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSchedule.map((entry, idx) => {
                      const status = getEntryStatus(entry.week);
                      const opponentName = getMemberName(entry.opponent);

                      // Look up real scores from DB (populated by scoreboard page when viewed)
                      // The matchup row key uses home_team_id / away_team_id from fantasy_teams.
                      // For schedule display we look up by week and check both team orderings.
                      const realMatchup = Object.entries(completedMatchups).find(
                        ([key]) => key.startsWith(`${entry.week}-`)
                      )?.[1] ?? null;
                      const myScore = realMatchup ? (entry.isHome ? realMatchup.home_score : realMatchup.away_score) : null;
                      const oppScore = realMatchup ? (entry.isHome ? realMatchup.away_score : realMatchup.home_score) : null;
                      const isWin = myScore !== null && oppScore !== null && myScore > oppScore;
                      const isLoss = myScore !== null && oppScore !== null && myScore < oppScore;

                      // Avatar color based on opponent name hash
                      const avatarSeed = opponentName
                        .split("")
                        .reduce((a, c) => a + c.charCodeAt(0), 0);
                      const avatarColors = [
                        "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
                        "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
                      ];
                      const avatarColor = avatarColors[avatarSeed % avatarColors.length];

                      return (
                        <tr
                          key={idx}
                          className={`schedule-row ${entry.isPlayoff ? "playoff-row" : ""}`}
                        >
                          <td className="col-matchup">
                            <div className="matchup-info">
                              <span className="matchup-label">
                                {entry.label}
                              </span>
                              <span className="matchup-dates">{entry.dateRange}</span>
                            </div>
                          </td>
                          <td className="col-score">
                            {status === "past" && realMatchup ? (
                              <div className="score-display">
                                <span
                                  className={`win-loss-badge ${
                                    isWin ? "badge-win" : isLoss ? "badge-loss" : "badge-tie"
                                  }`}
                                >
                                  {isWin ? "W" : isLoss ? "L" : "T"}
                                </span>
                                <Link
                                  href={`/league/${slug}/matchup/${entry.week}-0`}
                                  className="score-link"
                                >
                                  {myScore?.toFixed(1)}-{oppScore?.toFixed(1)}
                                </Link>
                              </div>
                            ) : status === "past" ? (
                              <Link
                                href={`/league/${slug}/matchup/${entry.week}-0`}
                                className="score-link-muted"
                              >
                                {t("查看", "View")}
                              </Link>
                            ) : status === "current" ? (
                              <span className="status-in-progress">
                                {t("进行中", "In Progress")}
                              </span>
                            ) : (
                              <span className="status-scheduled">—</span>
                            )}
                          </td>
                          <td className="col-opponent">
                            <div className="opponent-info">
                              {!entry.isHome && (
                                <span className="away-indicator">@</span>
                              )}
                              <span
                                className="opponent-avatar"
                                style={{ background: avatarColor }}
                              >
                                {opponentName[0]?.toUpperCase()}
                              </span>
                              <Link
                                href={`/league/${slug}/schedule`}
                                className="opponent-name"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setSelectedUserId(entry.opponent.user_id);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                              >
                                {opponentName}
                              </Link>
                              {/* Opponent record shown on standings page */}
                            </div>
                          </td>
                          <td className="col-manager">
                            {opponentName}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
