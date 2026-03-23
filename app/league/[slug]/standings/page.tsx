"use client";

import { useState, useEffect } from "react";
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
import { computeStandingsFromMatchups } from "@/lib/canonical-pipeline";

type FantasyTeamRecord = {
  id: string;
  user_id: string;
  name: string;
  wins: number;
  losses: number;
  ties: number;
  points_for: number;
  points_against: number;
};

type MatchupRow = {
  week: number;
  home_team_id: string;
  away_team_id: string;
  winner_id: string | null;
  home_score: number;
  away_score: number;
};

type StandingRow = {
  rank: number;
  member: LeagueMember;
  teamRecord: FantasyTeamRecord;
  wins: number;
  losses: number;
  ties: number;
  pct: string;
  gb: string;
  pf: string;
  pa: string;
  streak: string;
};

/** Compute current streak from ordered matchup history (most-recent first). */
function computeStreak(teamId: string, matchups: MatchupRow[]): string {
  if (matchups.length === 0) return "-";
  let count = 0;
  let streakType = "";
  for (const m of matchups) {
    const isInvolved = m.home_team_id === teamId || m.away_team_id === teamId;
    if (!isInvolved) continue;
    const result = m.winner_id === null ? "T" : m.winner_id === teamId ? "W" : "L";
    if (streakType === "") {
      streakType = result;
      count = 1;
    } else if (result === streakType) {
      count++;
    } else {
      break;
    }
  }
  return streakType ? `${streakType}${count}` : "-";
}

export default function StandingsPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [teamRecords, setTeamRecords] = useState<FantasyTeamRecord[]>([]);
  const [matchupHistory, setMatchupHistory] = useState<MatchupRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const [membersData, teamsResult, matchupsResult] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase
          .from("fantasy_teams")
          .select("id, user_id, name, wins, losses, ties, points_for, points_against")
          .eq("league_id", leagueData.id),
        supabase
          .from("matchups")
          .select("week, home_team_id, away_team_id, winner_id, home_score, away_score")
          .eq("league_id", leagueData.id)
          .eq("status", "completed")
          .order("week", { ascending: false }),
      ]);
      setMembers(membersData);
      setTeamRecords((teamsResult.data || []) as FantasyTeamRecord[]);
      setMatchupHistory((matchupsResult.data || []) as MatchupRow[]);
    }
    setLoading(false);
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

  // Build standings from canonical matchup data (Rule D)
  const standingsData: StandingRow[] = (() => {
    // Collect all fantasy team IDs
    const teamIdToMember: Record<string, LeagueMember> = {};
    const teamIdToName: Record<string, string> = {};
    const teamIdToUserId: Record<string, string> = {};
    for (const rec of teamRecords) {
      teamIdToMember[rec.id] = members.find(m => m.user_id === rec.user_id)!;
      teamIdToName[rec.id] = rec.name;
      teamIdToUserId[rec.id] = rec.user_id;
    }

    const teamIds = teamRecords.map(r => r.id);

    // Rule D: compute W/L/T/PF/PA from canonical matchup rows, not from fantasy_teams counters
    const computed = computeStandingsFromMatchups(teamIds, matchupHistory);

    const rows: StandingRow[] = teamRecords.map((rec) => {
      const member = members.find(m => m.user_id === rec.user_id);
      if (!member) return null;
      const stats = computed[rec.id] ?? { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
      return {
        rank: 0,
        member,
        teamRecord: rec,
        wins: stats.wins,
        losses: stats.losses,
        ties: stats.ties,
        pct: ".000",
        gb: "-",
        pf: stats.pointsFor.toFixed(1),
        pa: stats.pointsAgainst.toFixed(1),
        streak: "-",
      } as StandingRow;
    }).filter(Boolean) as StandingRow[];

    // Sort: wins DESC, then pointsFor DESC
    rows.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return Number(b.pf) - Number(a.pf);
    });

    // Assign ranks, compute pct/gb/streak
    const leaderWins   = rows[0]?.wins   ?? 0;
    const leaderLosses = rows[0]?.losses ?? 0;

    rows.forEach((row, idx) => {
      row.rank = idx + 1;
      const total  = row.wins + row.losses + row.ties;
      const pctNum = total > 0 ? (row.wins + 0.5 * row.ties) / total : 0;
      row.pct = pctNum.toFixed(3).replace(/^0/, "");
      row.gb  = idx === 0 ? "-" : (() => {
        const gb = ((leaderWins - row.wins) + (row.losses - leaderLosses)) / 2;
        return gb % 1 === 0 ? String(gb) : gb.toFixed(1);
      })();
      if (row.teamRecord.id) {
        row.streak = computeStreak(row.teamRecord.id, matchupHistory);
      }
    });

    return rows;
  })();

  if (loading) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
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
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
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
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>{t("排行榜", "Standings")}</h1>
            <p>{t(`${getCurrentSeasonYear()} 赛季排名`, `${getCurrentSeasonYear()} Season Rankings`)}</p>
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
                {standingsData.map((team) => (
                  <tr key={team.member.id}>
                    <td className="rank-col">
                      <span className={`rank-badge rank-${team.rank}`}>{team.rank}</span>
                    </td>
                    <td className="team-col">
                      <div className="team-info">
                        <span className="team-avatar">{getMemberName(team.member)[0]?.toUpperCase()}</span>
                        <div className="team-details">
                          <span className="team-name">{team.teamRecord.name || getMemberName(team.member) + "'s Team"}</span>
                          <span className="owner-name">{getMemberName(team.member)}</span>
                        </div>
                      </div>
                    </td>
                    <td className="stat">{team.wins}</td>
                    <td className="stat">{team.losses}</td>
                    <td className="stat">{team.ties}</td>
                    <td className="stat">{team.pct}</td>
                    <td className="stat">{team.gb}</td>
                    <td className="stat">{team.pf}</td>
                    <td className="stat">{team.pa}</td>
                    <td className="stat">{team.streak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {members.length === 0 && (
            <div className="empty-state">
              <p>{t("还没有队伍加入联赛", "No teams have joined yet")}</p>
            </div>
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

  .league-icon {
    font-size: 28px;
  }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #f9fafb;
    padding: 24px 16px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 8px 0;
  }

  .page-header p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .standings-table-container {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .standings-table {
    width: 100%;
    border-collapse: collapse;
  }

  .standings-table th {
    padding: 14px 16px;
    text-align: left;
    font-size: 12px;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .standings-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #f3f4f6;
  }

  .standings-table tr:last-child td {
    border-bottom: none;
  }

  .standings-table tr:hover {
    background: #f8fafc;
  }

  .rank-col {
    width: 60px;
  }

  .rank-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 700;
    background: #333;
    color: #111827;
  }

  .rank-badge.rank-1 {
    background: #1e3a8a;
    color: #fff;
  }

  .rank-badge.rank-2 {
    background: linear-gradient(135deg, #94a3b8, #64748b);
    color: #fff;
  }

  .rank-badge.rank-3 {
    background: linear-gradient(135deg, #cd7f32, #a0522d);
    color: #111827;
  }

  .team-col {
    min-width: 250px;
  }

  .team-info {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .team-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #fff;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .team-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .team-name {
    font-size: 14px;
    font-weight: 600;
    color: #111827;
  }

  .owner-name {
    font-size: 12px;
    color: #6b7280;
  }

  .stat {
    font-size: 14px;
    color: #374151;
    text-align: center;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    color: #6b7280;
  }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }

  @media (max-width: 768px) {
    .standings-table-container {
      overflow-x: auto;
    }

    .standings-table {
      min-width: 700px;
    }
  }
`;
