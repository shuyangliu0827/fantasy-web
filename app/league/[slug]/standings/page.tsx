"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  League,
  LeagueMember,
} from "@/lib/store";

export default function StandingsPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const membersData = await getLeagueMembers(leagueData.id);
      setMembers(membersData);
    }
    setLoading(false);
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

  // 模拟排行榜数据
  const standingsData = members.map((member, index) => ({
    rank: index + 1,
    member,
    teamName: getMemberName(member) + "'s Team",
    wins: 0,
    losses: 0,
    ties: 0,
    pct: ".000",
    gb: "-",
    pf: 0,
    pa: 0,
    streak: "-",
  }));

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
            <p>{t("2025 赛季排名", "2025 Season Rankings")}</p>
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
                          <span className="team-name">{team.teamName}</span>
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
