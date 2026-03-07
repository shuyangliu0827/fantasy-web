"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { listLeagues, getLeagueMemberCount, getSessionUser, League } from "@/lib/store";

type LeagueWithCount = League & { memberCount: number };

export default function PublicLeaguesPage() {
  const { t } = useLang();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const user = getSessionUser();

  useEffect(() => {
    async function load() {
      const data = await listLeagues();
      // 只显示公开的联赛
      const publicLeagues = data.filter(l => l.visibility === "public");
      
      // 获取每个联赛的成员数量
      const leaguesWithCounts = await Promise.all(
        publicLeagues.map(async (league) => {
          const memberCount = await getLeagueMemberCount(league.id);
          return { ...league, memberCount };
        })
      );
      
      setLeagues(leaguesWithCounts);
      setLoading(false);
    }
    load();
  }, []);

  const filteredLeagues = leagues.filter(league =>
    league.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    
    if (days === 0) return t("今天", "Today");
    if (days === 1) return t("昨天", "Yesterday");
    if (days < 7) return `${days} ${t("天前", "days ago")}`;
    if (days < 30) return `${Math.floor(days / 7)} ${t("周前", "weeks ago")}`;
    return formatDate(dateStr);
  };

  if (loading) {
    return (
      <div className="app">
        <Header />
        <main className="leagues-page">
          <div className="loading">
            <div className="loading-icon">🏆</div>
            <p>{t("加载中...", "Loading...")}</p>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="leagues-page">
        <div className="container">
          {/* 页面头部 */}
          <div className="page-header">
            <div className="header-content">
              <div className="header-icon">🏆</div>
              <div className="header-text">
                <h1>{t("公开联赛", "Public Leagues")}</h1>
                <p>{t("加入一个联赛，和其他玩家一起竞技！", "Join a league and compete with other players!")}</p>
              </div>
            </div>
            <Link href="/league/new" className="create-btn">
              + {t("创建联赛", "Create League")}
            </Link>
          </div>

          {/* 搜索栏 */}
          <div className="search-section">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t("搜索联赛名称...", "Search league name...")}
              />
              {searchTerm && (
                <button className="clear-btn" onClick={() => setSearchTerm("")}>×</button>
              )}
            </div>
            <div className="league-count">
              {t(`共 ${filteredLeagues.length} 个公开联赛`, `${filteredLeagues.length} public leagues`)}
            </div>
          </div>

          {/* 联赛列表 */}
          {filteredLeagues.length === 0 ? (
            <div className="empty-state">
              {searchTerm ? (
                <>
                  <div className="empty-icon">🔍</div>
                  <h3>{t("没有找到匹配的联赛", "No matching leagues found")}</h3>
                  <p>{t("试试其他关键词", "Try different keywords")}</p>
                </>
              ) : (
                <>
                  <div className="empty-icon">🏆</div>
                  <h3>{t("还没有公开联赛", "No public leagues yet")}</h3>
                  <p>{t("成为第一个创建联赛的人！", "Be the first to create a league!")}</p>
                  <Link href="/league/new" className="empty-btn">
                    {t("创建联赛", "Create League")}
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="leagues-grid">
              {filteredLeagues.map(league => (
                <div key={league.id} className="league-card">
                  <div className="league-card-header">
                    <div className="league-icon">🏆</div>
                    <div className="league-info">
                      <h3 className="league-name">{league.name}</h3>
                      <div className="league-meta">
                        <span className="badge">{t("公开", "Public")}</span>
                        <span className="date">{getTimeAgo(league.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="league-stats">
                    <div className="stat">
                      <span className="stat-icon">👥</span>
                      <span className="stat-label">{t("成员", "Members")}</span>
                      <span className="stat-value">{league.memberCount}</span>
                    </div>
                    <div className="stat">
                      <span className="stat-icon">📝</span>
                      <span className="stat-label">{t("帖子", "Posts")}</span>
                      <span className="stat-value">0</span>
                    </div>
                  </div>
                  
                  <div className="league-actions">
                    <Link href={`/league/${league.slug}`} className="action-btn view-btn">
                      {t("查看详情", "View Details")}
                    </Link>
                    <Link href={`/league/${league.slug}`} className="action-btn join-btn">
                      {t("加入联赛", "Join League")}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 底部提示 */}
          <div className="bottom-tip">
            <p>
              {t("想创建自己的联赛？", "Want to create your own league?")} 
              <Link href="/league/new">{t("点击这里创建", "Click here to create")}</Link>
            </p>
          </div>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .leagues-page {
    min-height: 100vh;
    background: #0a0a0a;
    padding: 24px 16px 60px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
  }

  /* 页面头部 */
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
    padding: 24px;
    background: linear-gradient(135deg, #1a237e 0%, #0d1442 100%);
    border: 1px solid #283593;
    border-radius: 16px;
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .header-icon {
    font-size: 48px;
    width: 80px;
    height: 80px;
    background: rgba(255,255,255,0.1);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .header-text h1 {
    font-size: 28px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .header-text p {
    font-size: 14px;
    color: #90caf9;
    margin: 0;
  }

  .create-btn {
    padding: 14px 28px;
    background: #f59e0b;
    color: #000;
    font-weight: 600;
    border-radius: 24px;
    text-decoration: none;
    transition: all 0.2s;
  }

  .create-btn:hover {
    background: #fbbf24;
    transform: scale(1.05);
  }

  /* 搜索栏 */
  .search-section {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    gap: 16px;
  }

  .search-box {
    flex: 1;
    max-width: 400px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: #111;
    border: 1px solid #222;
    border-radius: 12px;
  }

  .search-icon {
    font-size: 16px;
    opacity: 0.5;
  }

  .search-box input {
    flex: 1;
    background: none;
    border: none;
    color: #fff;
    font-size: 15px;
    outline: none;
  }

  .search-box input::placeholder {
    color: #666;
  }

  .clear-btn {
    background: none;
    border: none;
    color: #666;
    font-size: 18px;
    cursor: pointer;
    padding: 0 4px;
  }

  .clear-btn:hover {
    color: #fff;
  }

  .league-count {
    font-size: 14px;
    color: #666;
  }

  /* 联赛网格 */
  .leagues-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .league-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 20px;
    transition: all 0.2s;
  }

  .league-card:hover {
    border-color: #f59e0b;
    transform: translateY(-2px);
  }

  .league-card-header {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
  }

  .league-icon {
    font-size: 32px;
    width: 56px;
    height: 56px;
    background: rgba(245, 158, 11, 0.15);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .league-info {
    flex: 1;
    min-width: 0;
  }

  .league-name {
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .league-meta {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .badge {
    padding: 4px 10px;
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
  }

  .date {
    font-size: 13px;
    color: #666;
  }

  .league-stats {
    display: flex;
    gap: 24px;
    padding: 16px 0;
    border-top: 1px solid #222;
    border-bottom: 1px solid #222;
    margin-bottom: 16px;
  }

  .stat {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .stat-icon {
    font-size: 16px;
  }

  .stat-label {
    font-size: 13px;
    color: #666;
  }

  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .league-actions {
    display: flex;
    gap: 12px;
  }

  .action-btn {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 500;
    text-align: center;
    text-decoration: none;
    transition: all 0.2s;
  }

  .view-btn {
    background: transparent;
    border: 1px solid #333;
    color: #888;
  }

  .view-btn:hover {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .join-btn {
    background: #f59e0b;
    color: #000;
  }

  .join-btn:hover {
    background: #d97706;
  }

  /* 空状态 */
  .empty-state {
    text-align: center;
    padding: 80px 20px;
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
  }

  .empty-icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .empty-state p {
    color: #666;
    margin: 0 0 24px 0;
  }

  .empty-btn {
    display: inline-block;
    padding: 12px 32px;
    background: #f59e0b;
    color: #000;
    font-weight: 600;
    border-radius: 24px;
    text-decoration: none;
  }

  /* 底部提示 */
  .bottom-tip {
    text-align: center;
    margin-top: 32px;
    padding: 20px;
    color: #666;
    font-size: 14px;
  }

  .bottom-tip a {
    color: #f59e0b;
    text-decoration: none;
    margin-left: 4px;
  }

  .bottom-tip a:hover {
    text-decoration: underline;
  }

  /* 加载状态 */
  .loading {
    text-align: center;
    padding: 120px 20px;
  }

  .loading-icon {
    font-size: 48px;
    margin-bottom: 16px;
    animation: bounce 1s infinite;
  }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }

  .loading p {
    color: #666;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .page-header {
      flex-direction: column;
      gap: 20px;
      text-align: center;
    }

    .header-content {
      flex-direction: column;
    }

    .create-btn {
      width: 100%;
    }

    .search-section {
      flex-direction: column;
      align-items: stretch;
    }

    .search-box {
      max-width: none;
    }

    .leagues-grid {
      grid-template-columns: 1fr;
    }
  }
`;