"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  League,
  LeagueMember,
} from "@/lib/store";

function LeagueNav({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const { t } = useLang();
  const mainNav = [
    { href: `/league/${slug}`, label: t("联赛主页", "League Home"), icon: "🏠" },
    { href: `/league/${slug}/roster`, label: t("阵容", "Roster"), icon: "📋" },
    { href: `/league/${slug}/free-agents`, label: t("自由市场", "Free Agents"), icon: "🏪" },
    { href: `/league/${slug}/trade`, label: t("交易", "Trade"), icon: "🔄" },
    { href: `/league/${slug}/standings`, label: t("排行榜", "Standings"), icon: "🏆" },
    { href: `/league/${slug}/scoreboard`, label: t("记分板", "Scoreboard"), icon: "📊" },
    { href: `/league/${slug}/members`, label: t("成员", "Members"), icon: "👥" },
  ];
  if (isOwner) {
    mainNav.push({ href: `/league/${slug}/settings`, label: t("设置", "Settings"), icon: "⚙️" });
  }

  return (
    <nav className="league-nav">
      <div className="league-nav-inner">
        {mainNav.map((item) => (
          <Link key={item.href} href={item.href} className={`league-nav-link ${item.href.includes('/scoreboard') ? 'active' : ''}`}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

export default function ScoreboardPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);

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

  // 生成模拟对阵
  const generateMatchups = () => {
    const matchups = [];
    for (let i = 0; i < members.length; i += 2) {
      if (members[i + 1]) {
        matchups.push({
          id: i,
          home: members[i],
          away: members[i + 1],
          homeScore: 0,
          awayScore: 0,
          status: "scheduled",
        });
      }
    }
    return matchups;
  };

  const matchups = generateMatchups();
  const weeks = Array.from({ length: 20 }, (_, i) => i + 1);

  if (loading) {
    return (
      <div className="app">
        <Header />
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
        <Header />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      
      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon">🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>📊 {t("记分板", "Scoreboard")}</h1>
            <div className="week-selector">
              <button 
                className="week-nav" 
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                disabled={selectedWeek === 1}
              >
                ←
              </button>
              <select 
                value={selectedWeek} 
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="week-dropdown"
              >
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {t(`第 ${week} 周`, `Week ${week}`)}
                  </option>
                ))}
              </select>
              <button 
                className="week-nav" 
                onClick={() => setSelectedWeek(Math.min(20, selectedWeek + 1))}
                disabled={selectedWeek === 20}
              >
                →
              </button>
            </div>
          </div>

          <div className="matchups-grid">
            {matchups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📊</div>
                <h3>{t("还没有对阵", "No matchups yet")}</h3>
                <p>{t("联赛需要至少2支队伍才能生成对阵", "League needs at least 2 teams to generate matchups")}</p>
              </div>
            ) : (
              matchups.map((matchup) => (
                <div key={matchup.id} className="matchup-card">
                  <div className="matchup-header">
                    <span className="matchup-status">{t("已安排", "Scheduled")}</span>
                    <span className="matchup-week">{t(`第 ${selectedWeek} 周`, `Week ${selectedWeek}`)}</span>
                  </div>
                  
                  <div className="matchup-teams">
                    <div className="team home">
                      <div className="team-avatar">{getMemberName(matchup.home)[0]?.toUpperCase()}</div>
                      <div className="team-info">
                        <span className="team-name">{getMemberName(matchup.home)}</span>
                        <span className="team-record">0-0</span>
                      </div>
                      <span className="team-score">{matchup.homeScore}</span>
                    </div>
                    
                    <div className="vs">VS</div>
                    
                    <div className="team away">
                      <span className="team-score">{matchup.awayScore}</span>
                      <div className="team-info">
                        <span className="team-name">{getMemberName(matchup.away)}</span>
                        <span className="team-record">0-0</span>
                      </div>
                      <div className="team-avatar">{getMemberName(matchup.away)[0]?.toUpperCase()}</div>
                    </div>
                  </div>

                  <div className="matchup-footer">
                    <Link href={`/league/${slug}/matchup/${matchup.id}`} className="view-matchup">
                      {t("查看详情", "View Matchup")} →
                    </Link>
                  </div>
                </div>
              ))
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
    gap: 12px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .league-icon {
    font-size: 28px;
  }

  .league-nav {
    background: #111;
    border-bottom: 1px solid #222;
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
    color: #888;
    text-decoration: none;
    font-size: 14px;
    border-bottom: 2px solid transparent;
    white-space: nowrap;
  }

  .league-nav-link:hover { color: #fff; }
  .league-nav-link.active { color: #f59e0b; border-bottom-color: #f59e0b; }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #0a0a0a;
    padding: 24px 16px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

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

  .week-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .week-nav {
    width: 36px;
    height: 36px;
    border: 1px solid #333;
    background: #111;
    color: #fff;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
  }

  .week-nav:hover:not(:disabled) {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .week-nav:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .week-dropdown {
    padding: 8px 16px;
    background: #111;
    border: 1px solid #333;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
  }

  .matchups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 16px;
  }

  .matchup-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
    overflow: hidden;
  }

  .matchup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #1a1a1a;
    border-bottom: 1px solid #222;
  }

  .matchup-status {
    font-size: 12px;
    padding: 4px 10px;
    background: rgba(245, 158, 11, 0.2);
    color: #f59e0b;
    border-radius: 12px;
  }

  .matchup-week {
    font-size: 13px;
    color: #888;
  }

  .matchup-teams {
    padding: 20px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .team {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .team.away {
    flex-direction: row-reverse;
    text-align: right;
  }

  .team-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 18px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .team-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .team-name {
    font-size: 15px;
    font-weight: 600;
    color: #fff;
  }

  .team-record {
    font-size: 12px;
    color: #888;
  }

  .team-score {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    min-width: 40px;
    text-align: center;
  }

  .vs {
    font-size: 14px;
    font-weight: 600;
    color: #666;
    padding: 0 8px;
  }

  .matchup-footer {
    padding: 12px 16px;
    border-top: 1px solid #222;
    text-align: center;
  }

  .view-matchup {
    font-size: 13px;
    color: #f59e0b;
    text-decoration: none;
  }

  .view-matchup:hover {
    text-decoration: underline;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 18px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .empty-state p {
    font-size: 14px;
    color: #888;
    margin: 0;
  }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  @media (max-width: 500px) {
    .matchups-grid {
      grid-template-columns: 1fr;
    }
  }
`;
