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

export default function SchedulePage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"full" | "my">("full");

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

  // 生成模拟赛程（20周）
  const generateSchedule = () => {
    const schedule = [];
    for (let week = 1; week <= 20; week++) {
      const weekMatchups = [];
      const shuffled = [...members].sort(() => Math.random() - 0.5);
      for (let i = 0; i < shuffled.length; i += 2) {
        if (shuffled[i + 1]) {
          weekMatchups.push({
            home: shuffled[i],
            away: shuffled[i + 1],
          });
        }
      }
      schedule.push({ week, matchups: weekMatchups });
    }
    return schedule;
  };

  const schedule = generateSchedule();

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
            <span className="league-icon">🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>📅 {t("赛程表", "Schedule")}</h1>
            <div className="view-toggle">
              <button 
                className={`toggle-btn ${viewMode === "full" ? "active" : ""}`}
                onClick={() => setViewMode("full")}
              >
                {t("完整赛程", "Full Schedule")}
              </button>
              <button 
                className={`toggle-btn ${viewMode === "my" ? "active" : ""}`}
                onClick={() => setViewMode("my")}
              >
                {t("我的赛程", "My Schedule")}
              </button>
            </div>
          </div>

          {members.length < 2 ? (
            <div className="empty-state">
              <div className="empty-icon">📅</div>
              <h3>{t("还没有赛程", "No schedule yet")}</h3>
              <p>{t("联赛需要至少2支队伍才能生成赛程", "League needs at least 2 teams to generate schedule")}</p>
            </div>
          ) : (
            <div className="schedule-list">
              {schedule.slice(0, 10).map((weekData) => (
                <div key={weekData.week} className="week-card">
                  <div className="week-header">
                    <h3>{t(`第 ${weekData.week} 周`, `Week ${weekData.week}`)}</h3>
                    <span className="week-status">
                      {weekData.week === 1 ? t("进行中", "In Progress") : t("即将到来", "Upcoming")}
                    </span>
                  </div>
                  <div className="week-matchups">
                    {weekData.matchups.map((matchup, idx) => (
                      <div key={idx} className="schedule-matchup">
                        <div className="matchup-team home">
                          <span className="team-avatar">{getMemberName(matchup.home)[0]?.toUpperCase()}</span>
                          <span className="team-name">{getMemberName(matchup.home)}</span>
                        </div>
                        <span className="vs-badge">VS</span>
                        <div className="matchup-team away">
                          <span className="team-name">{getMemberName(matchup.away)}</span>
                          <span className="team-avatar">{getMemberName(matchup.away)[0]?.toUpperCase()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="schedule-note">
            <p>💡 {t("赛程将在选秀完成后正式生成", "Schedule will be finalized after the draft")}</p>
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

  .league-nav {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky;
    top: 60px;
    z-index: 40;
  }

  .league-nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    gap: 4px;
    padding: 0 16px;
    overflow-x: auto;
  }

  .league-nav-link {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 14px 16px;
    color: #6b7280;
    text-decoration: none;
    font-size: 14px;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }

  .league-nav-link:hover { color: #fff; }
  .league-nav-link.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #f9fafb;
    padding: 24px 16px;
  }

  .container { max-width: 900px; margin: 0 auto; }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }

  .view-toggle {
    display: flex;
    gap: 8px;
  }

  .toggle-btn {
    padding: 8px 16px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #6b7280;
    font-size: 14px;
    cursor: pointer;
  }

  .toggle-btn:hover { border-color: #1e3a8a; color: #fff; }
  .toggle-btn.active { background: #1e3a8a; color: #000; border-color: #1e3a8a; }

  .schedule-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .week-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .week-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .week-header h3 {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0;
  }

  .week-status {
    font-size: 12px;
    padding: 4px 12px;
    background: #dbeafe;
    color: #1e3a8a;
    border-radius: 12px;
  }

  .week-matchups {
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .schedule-matchup {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: #f9fafb;
    border-radius: 8px;
  }

  .matchup-team {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }

  .matchup-team.away {
    flex-direction: row-reverse;
  }

  .team-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #000;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .team-name {
    font-size: 14px;
    font-weight: 500;
    color: #fff;
  }

  .vs-badge {
    font-size: 12px;
    font-weight: 600;
    color: #9ca3af;
    padding: 4px 12px;
    background: #222;
    border-radius: 4px;
  }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-state h3 { font-size: 18px; color: #fff; margin: 0 0 8px 0; }
  .empty-state p { font-size: 14px; color: #6b7280; margin: 0; }

  .schedule-note {
    margin-top: 24px;
    padding: 16px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 8px;
    text-align: center;
  }

  .schedule-note p {
    font-size: 14px;
    color: #1e3a8a;
    margin: 0;
  }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }
`;
