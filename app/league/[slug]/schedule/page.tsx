"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import { getCurrentSeasonLabel, getCurrentSeasonYear } from "@/lib/season";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  League,
  LeagueMember,
  supabase,
} from "@/lib/store";
import { generateMatchupsForWeek } from "@/lib/fantasy-matchups";
import {
  NBA_FINALS_END_UTC,
  getOfficialLeagueStartDate,
  getWeekDateStrings,
  getWeekStatus as getCanonicalWeekStatus,
} from "@/lib/week-utils";

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
  matchupIndex: number;
  homeUserId: string;
  awayUserId: string;
};

export default function SchedulePage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  // Real completed-matchup scores fetched from DB
  const [completedMatchups, setCompletedMatchups] = useState<Record<string, { home_score: number; away_score: number; winner_id: string | null }>>({});

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (u) setSelectedUserId(u.id);
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const [membersData, matchupsResult, teamsResult] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase
          .from("matchups")
          .select("week, home_team_id, away_team_id, home_score, away_score, winner_id")
          .eq("league_id", leagueData.id)
          .eq("status", "completed"),
        supabase
          .from("fantasy_teams")
          .select("id, user_id")
          .eq("league_id", leagueData.id),
      ]);
      setMembers(membersData);
      // Build teamId → userId map so we can key by user IDs (matching MatchupEntry)
      const userIdByTeamId: Record<string, string> = {};
      for (const t of (teamsResult.data ?? [])) {
        userIdByTeamId[t.id] = t.user_id;
      }
      // Build lookup: "{week}-{homeUserId}-{awayUserId}" → scores
      if (matchupsResult.data) {
        const lookup: Record<string, { home_score: number; away_score: number; winner_id: string | null }> = {};
        for (const row of matchupsResult.data) {
          const homeUserId = userIdByTeamId[row.home_team_id];
          const awayUserId = userIdByTeamId[row.away_team_id];
          if (homeUserId && awayUserId) {
            const key = `${row.week}-${homeUserId}-${awayUserId}`;
            lookup[key] = { home_score: row.home_score, away_score: row.away_score, winner_id: row.winner_id };
          }
        }
        setCompletedMatchups(lookup);
      }
    }
    setLoading(false);
  }

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
      for (let i = 0; i < weekMatchups.length; i++) {
        const matchup = weekMatchups[i];
        const homeEntry: MatchupEntry = {
          week,
          label,
          dateRange: `(${dateRange})`,
          opponent: matchup.away,
          isHome: true,
          isPlayoff,
          playoffRound,
          matchupIndex: i,
          homeUserId: matchup.home.user_id,
          awayUserId: matchup.away.user_id,
        };
        const awayEntry: MatchupEntry = {
          week,
          label,
          dateRange: `(${dateRange})`,
          opponent: matchup.home,
          isHome: false,
          isPlayoff,
          playoffRound,
          matchupIndex: i,
          homeUserId: matchup.home.user_id,
          awayUserId: matchup.away.user_id,
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

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app">
        <LightHeader activeHref="/league" />
        <div className="loading-container">
          <p>{t("加载中...", "Loading...")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app">
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <LightHeader activeHref="/league" />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon">🏀</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          {/* Schedule card matching screenshot design */}
          <div className="schedule-card">
            <div className="schedule-card-top-border" />

            <div className="schedule-card-header">
              <div className="schedule-title-section">
                <h1 className="schedule-title">
                  {selectedName.toUpperCase()} {t("赛程", "Schedule")}
                </h1>
                <span className="schedule-season">
                  {getCurrentSeasonLabel()} Fantasy Hoops
                </span>
              </div>
            </div>

            <div className="schedule-controls">
              <div className="team-selector-section">
                <span className="selector-label">{t("队伍赛程", "Team Schedule")}</span>
                <div className="team-dropdown-wrapper">
                  <select
                    className="team-dropdown"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                  >
                    {members.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {getMemberName(m)}
                      </option>
                    ))}
                  </select>
                  <span className="dropdown-arrow">▾</span>
                </div>
              </div>
            </div>

            <div className="season-subtitle">
              <h2>{t(`${getCurrentSeasonYear()} 赛季赛程`, `${getCurrentSeasonYear()} Season Schedule`)}</h2>
            </div>

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

                      // Direct lookup by week + homeUserId + awayUserId (same orientation as generateMatchupsForWeek).
                      const realMatchup = completedMatchups[`${entry.week}-${entry.homeUserId}-${entry.awayUserId}`] ?? null;
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
                                  href={`/league/${slug}/matchup/${entry.week}-${entry.matchupIndex}`}
                                  className="score-link"
                                >
                                  {myScore?.toFixed(1)}-{oppScore?.toFixed(1)}
                                </Link>
                              </div>
                            ) : status === "past" ? (
                              <Link
                                href={`/league/${slug}/matchup/${entry.week}-${entry.matchupIndex}`}
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
  .page-content {
    min-height: calc(100vh - 200px);
    background: #f3f4f6;
    padding: 24px 16px;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  /* ── Schedule card ──────────────────────────────────────────────── */
  .schedule-card {
    background: #fff;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
    overflow: hidden;
    position: relative;
  }
  .schedule-card-top-border {
    height: 4px;
    background: linear-gradient(90deg, #f59e0b, #f97316);
  }

  .schedule-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 28px 0;
  }
  .schedule-title-section {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
  }
  .schedule-title {
    font-size: 22px;
    font-weight: 800;
    color: #111827;
    margin: 0;
    letter-spacing: 0.3px;
  }
  .schedule-season {
    font-size: 14px;
    color: #6b7280;
    font-weight: 400;
  }

  /* ── Controls ───────────────────────────────────────────────────── */
  .schedule-controls {
    padding: 20px 28px 0;
  }
  .team-selector-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .selector-label {
    font-size: 13px;
    color: #6b7280;
    font-weight: 500;
  }
  .team-dropdown-wrapper {
    position: relative;
    display: inline-block;
  }
  .team-dropdown {
    appearance: none;
    padding: 8px 36px 8px 14px;
    background: #fff;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    color: #111827;
    cursor: pointer;
    min-width: 200px;
  }
  .team-dropdown:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59,130,246,0.15);
  }
  .dropdown-arrow {
    position: absolute;
    right: 12px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 12px;
    color: #6b7280;
    pointer-events: none;
  }

  /* ── Season subtitle ────────────────────────────────────────────── */
  .season-subtitle {
    padding: 24px 28px 0;
  }
  .season-subtitle h2 {
    font-size: 16px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  /* ── Table ──────────────────────────────────────────────────────── */
  .schedule-table-wrapper {
    padding: 16px 0 0;
    overflow-x: auto;
  }
  .schedule-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }
  .schedule-table thead th {
    text-align: left;
    padding: 10px 16px;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 2px solid #e5e7eb;
    background: #fafafa;
  }
  .schedule-table thead th.col-matchup {
    padding-left: 28px;
    width: 30%;
  }
  .schedule-table thead th.col-score {
    width: 20%;
  }
  .schedule-table thead th.col-opponent {
    width: 30%;
  }
  .schedule-table thead th.col-manager {
    width: 20%;
  }
  .schedule-table tbody tr {
    border-bottom: 1px solid #f0f0f0;
    transition: background 0.15s;
  }
  .schedule-table tbody tr:hover {
    background: #fafbfc;
  }
  .schedule-table tbody tr.playoff-row {
    background: #fffbeb;
  }
  .schedule-table tbody tr.playoff-row:hover {
    background: #fef3c7;
  }
  .schedule-table td {
    padding: 14px 16px;
    vertical-align: middle;
    color: #374151;
  }
  .schedule-table td.col-matchup {
    padding-left: 28px;
  }

  /* ── Matchup info ───────────────────────────────────────────────── */
  .matchup-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .matchup-label {
    font-weight: 500;
    color: #374151;
    font-size: 14px;
  }
  .matchup-dates {
    font-size: 12px;
    color: #9ca3af;
  }
  .playoff-row .matchup-label {
    color: #92400e;
    font-weight: 600;
  }

  /* ── Score ───────────────────────────────────────────────────────── */
  .score-display {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .win-loss-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    flex-shrink: 0;
  }
  .badge-win {
    background: #22c55e;
  }
  .badge-loss {
    background: #ef4444;
  }
  .score-link {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
  }
  .score-link:hover {
    text-decoration: underline;
  }
  .status-in-progress {
    color: #f59e0b;
    font-weight: 500;
    font-size: 13px;
  }
  .status-scheduled {
    color: #d1d5db;
    font-size: 16px;
  }

  /* ── Opponent ───────────────────────────────────────────────────── */
  .opponent-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .away-indicator {
    font-size: 13px;
    color: #9ca3af;
    font-weight: 500;
    flex-shrink: 0;
  }
  .opponent-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .opponent-name {
    color: #3b82f6;
    text-decoration: none;
    font-weight: 500;
    font-size: 14px;
  }
  .opponent-name:hover {
    text-decoration: underline;
  }
  .opponent-record {
    color: #9ca3af;
    font-size: 13px;
    flex-shrink: 0;
  }

  /* ── Empty state ────────────────────────────────────────────────── */
  .empty-state {
    text-align: center;
    padding: 60px 20px;
  }
  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-state h3 { font-size: 18px; color: #111827; margin: 0 0 8px 0; }
  .empty-state p { font-size: 14px; color: #6b7280; margin: 0; }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }

  /* ── Responsive ─────────────────────────────────────────────────── */
  @media (max-width: 768px) {
    .schedule-card-header { padding: 16px 16px 0; }
    .schedule-controls { padding: 16px 16px 0; }
    .season-subtitle { padding: 16px 16px 0; }
    .schedule-table thead th.col-matchup,
    .schedule-table td.col-matchup { padding-left: 16px; }
    .schedule-title { font-size: 18px; }
    .col-manager { display: none; }
    .schedule-table thead th.col-manager { display: none; }
  }
`;
