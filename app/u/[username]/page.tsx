"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { getSessionUser, listLeagues, listInsights, League, Insight } from "@/lib/store";

type DraftHistory = {
  id: string;
  leagueName: string;
  season: string;
  result: string;
  rank: number;
  totalTeams: number;
  date: number;
};

export default function UserProfilePage() {
  const { t } = useLang();
  const params = useParams();
  const username = params.username as string;
  const [currentUser, setCurrentUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "leagues" | "drafts" | "stats">("posts");
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [userInsights, setUserInsights] = useState<Insight[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [draftHistory, setDraftHistory] = useState<DraftHistory[]>([]);
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    leaguesJoined: 0,
    leaguesWon: 0,
    draftsCompleted: 0,
  });

  const loadData = async () => {
    const user = getSessionUser();
    setCurrentUser(user);

    const isOwn = user && user.username.toLowerCase() === username.toLowerCase();
    setIsOwnProfile(!!isOwn);

    const allInsights = await listInsights();
    const filtered = allInsights.filter((i: any) => {
      const authorName = typeof i.author === "object" ? i.author?.username : i.author;
      const authorClean = (authorName || "").replace("@", "").toLowerCase();
      const usernameClean = username.toLowerCase();
      if (authorClean === usernameClean) return true;
      if (isOwn && user && authorClean === user.name.toLowerCase()) return true;
      return false;
    });
    setUserInsights(
      filtered.sort(
        (a: any, b: any) =>
          new Date(b.created_at || b.createdAt).getTime() -
          new Date(a.created_at || a.createdAt).getTime()
      )
    );

    const allLeagues = await listLeagues();
    let userOwnedLeagues: League[] = [];
    if (user && isOwn) {
      userOwnedLeagues = allLeagues.filter((l: any) => l.commissioner_id === user.id);
      setUserLeagues(userOwnedLeagues);
    }

    const totalLikes = filtered.reduce((sum, i) => sum + (i.heat || 0), 0);
    const allComments = JSON.parse(localStorage.getItem("bp_comments") || "[]");
    const userComments = allComments.filter((c: any) => {
      const commentAuthor = c.author?.replace("@", "").toLowerCase();
      return commentAuthor === username.toLowerCase();
    });
    const savedDrafts = JSON.parse(localStorage.getItem(`bp_drafts_${username}`) || "[]");
    setDraftHistory(savedDrafts);
    const championships = JSON.parse(localStorage.getItem(`bp_championships_${username}`) || "[]");

    setStats({
      totalPosts: filtered.length,
      totalLikes,
      totalComments: userComments.length,
      leaguesJoined: userOwnedLeagues.length,
      leaguesWon: championships.length,
      draftsCompleted: savedDrafts.length,
    });

    const followersKey = `bp_followers_${username}`;
    const savedFollowers = JSON.parse(localStorage.getItem(followersKey) || "[]");
    setFollowersCount(savedFollowers.length);

    if (user && isOwn) {
      const followingList = JSON.parse(localStorage.getItem(`bp_following_${user.id}`) || "[]");
      setFollowingCount(followingList.length);
    }

    if (user && !isOwn) {
      const following = JSON.parse(localStorage.getItem(`bp_following_${user.id}`) || "[]");
      setIsFollowing(following.includes(username) || following.includes(`@${username}`));
    }
  };

  useEffect(() => {
    loadData();
  }, [username]);

  const formatDate = (ts: any) => {
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const parseInsight = (insight: Insight) => {
    let coverImage: string | undefined;
    let tags: string[] | undefined;
    try {
      const parsed = JSON.parse(insight.body);
      if (parsed.metadata) {
        coverImage = parsed.metadata.coverImage;
        tags = parsed.metadata.tags;
      }
    } catch {}
    return { ...insight, coverImage, tags };
  };

  const handleFollow = () => {
    if (!currentUser) {
      alert(t("请先登录", "Please login first"));
      return;
    }
    const followingKey = `bp_following_${currentUser.id}`;
    const followersKey = `bp_followers_${username}`;
    const following = JSON.parse(localStorage.getItem(followingKey) || "[]");
    const followers = JSON.parse(localStorage.getItem(followersKey) || "[]");

    if (isFollowing) {
      localStorage.setItem(followingKey, JSON.stringify(following.filter((n: string) => n !== username && n !== `@${username}`)));
      localStorage.setItem(followersKey, JSON.stringify(followers.filter((id: string) => id !== currentUser.id)));
      setIsFollowing(false);
      setFollowersCount(prev => Math.max(0, prev - 1));
    } else {
      following.push(username);
      followers.push(currentUser.id);
      localStorage.setItem(followingKey, JSON.stringify(following));
      localStorage.setItem(followersKey, JSON.stringify(followers));
      setIsFollowing(true);
      setFollowersCount(prev => prev + 1);
    }
  };

  const handleDeleteLeague = (leagueId: string) => {
    const allLeagues = JSON.parse(localStorage.getItem("bp_leagues") || "[]");
    localStorage.setItem("bp_leagues", JSON.stringify(allLeagues.filter((l: League) => l.id !== leagueId)));
    setShowDeleteModal(null);
    loadData();
  };

  // Display name: prefer user.name (the human-readable name from signup), fall back to username
  const displayName = currentUser && isOwnProfile ? (currentUser.name || username) : username;

  return (
    <div style={{ background: "#f9fafb", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <LightHeader activeHref="" />

      <main className="profile-main-wrap">

        {/* ── Profile Card ── */}
        <div className="card profile-card">
          {/* Top row: tag chip + action buttons */}
          <div className="profile-top-row">
            <span className="profile-tag-chip">
              {t("篮球数据玩家 · Blueprint Fantasy 用户", "Basketball Data Player · Blueprint Fantasy User")}
            </span>
            <div className="profile-action-btns">
              {isOwnProfile ? (
                <>
                  <button className="btn-primary-sm">{t("编辑资料", "Edit Profile")}</button>
                  <button className="btn-ghost-sm">{t("分享主页", "Share")}</button>
                </>
              ) : (
                <button
                  className={isFollowing ? "btn-ghost-sm" : "btn-primary-sm"}
                  onClick={handleFollow}
                >
                  {isFollowing ? t("已关注", "Following") : t("关注", "Follow")}
                </button>
              )}
            </div>
          </div>

          {/* Body: avatar + info */}
          <div className="profile-body">
            <div className="avatar-wrap">
              <div className="avatar-sq">{username[0]?.toUpperCase()}</div>
              <span className="online-dot" />
            </div>

            <div className="profile-info">
              <h1 className="display-name">@{displayName}</h1>
              <p className="bio">
                {isOwnProfile
                  ? t("专注于 Fantasy 篮球、数据分析与选秀策略。用更清晰的数据视角，赢下每一场选秀与赛季对局。",
                      "Focused on Fantasy basketball, data analysis and draft strategy.")
                  : t("Fantasy 篮球玩家", "Fantasy Basketball Player")}
              </p>
              <div className="profile-stats-row">
                <span><strong>{stats.totalPosts}</strong> {t("帖子", "Posts")}</span>
                <span><strong>{followersCount}</strong> {t("粉丝", "Followers")}</span>
                <span><strong>{followingCount}</strong> {t("关注", "Following")}</span>
                <span><strong>{stats.leaguesJoined}</strong> {t("联赛", "Leagues")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        <div className="stats-cards-row">
          <div className="card stat-card">
            <div className="stat-card-label">{t("已加入联赛", "Leagues Joined")}</div>
            <div className="stat-card-value">{stats.leaguesJoined}</div>
            <div className="stat-card-sub">{t("公开联赛与好友联赛并行进行", "Public and friend leagues in progress")}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-card-label">{t("发帖数", "Posts")}</div>
            <div className="stat-card-value">{stats.totalPosts}</div>
            <div className="stat-card-sub">{t("持续沉淀选秀与赛季观察", "Continuous draft and season observations")}</div>
          </div>
          <div className="card stat-card">
            <div className="stat-card-label">{t("活跃状态", "Status")}</div>
            <div className="stat-card-value online-value">{t("在线", "Online")}</div>
            <div className="stat-card-sub">{t("最近活跃于球队与社区页面", "Recently active on team and community pages")}</div>
          </div>
        </div>

        {/* ── Two-column: sidebar + content ── */}
        <div className="two-col-wrap">
          {/* Left sidebar */}
          {isOwnProfile && (
            <div className="sidebar">
              <div className="card sidebar-card">
                <div className="sidebar-section-title">{t("快捷操作", "Quick Actions")}</div>
                <Link href="/insights/new" className="sidebar-btn-primary">{t("发布首篇帖子", "Create First Post")}</Link>
                <Link href="/league" className="sidebar-btn-ghost">{t("查看我的联赛", "View My Leagues")}</Link>
              </div>
              <div className="card sidebar-card" style={{ marginTop: 16 }}>
                <div className="sidebar-section-title">{t("个人标签", "Tags")}</div>
                <div className="tags-wrap">
                  <span className="tag tag-blue">Fantasy</span>
                  <span className="tag tag-orange">{t("选秀", "Draft")}</span>
                  <span className="tag tag-gray">{t("数据分析", "Analytics")}</span>
                </div>
              </div>
            </div>
          )}

          {/* Right: tabs + content */}
          <div className="content-col">
            {/* Tab bar */}
            <div className="tab-bar">
              {(["posts", "leagues", "drafts", "stats"] as const).map(tab => {
                const labels: Record<string, [string, string]> = {
                  posts: [t("帖子", "Posts") + ` (${userInsights.length})`, "posts"],
                  leagues: [t("联赛", "Leagues") + ` (${userLeagues.length})`, "leagues"],
                  drafts: [t("选秀历史", "Draft History") + ` (${draftHistory.length})`, "drafts"],
                  stats: [t("战绩统计", "Stats"), "stats"],
                };
                return (
                  <button
                    key={tab}
                    className={`tab-pill ${activeTab === tab ? "active" : ""}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {labels[tab][0]}
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="tab-content-wrap">
              {/* Posts */}
              {activeTab === "posts" && (
                <div>
                  {userInsights.length === 0 ? (
                    <div className="empty-state">
                      <p>{isOwnProfile ? t("你还没有发布任何帖子", "You haven't posted anything yet") : t("该用户还没有发布帖子", "No posts yet")}</p>
                      {isOwnProfile && <Link href="/insights/new" className="btn-primary-sm" style={{ textDecoration: "none", display: "inline-block", marginTop: 12 }}>{t("发布帖子", "Create Post")}</Link>}
                    </div>
                  ) : (
                    <div className="posts-list">
                      {userInsights.map(insight => {
                        const parsed = parseInsight(insight);
                        return (
                          <Link key={insight.id} href={`/insights/${insight.id}`} className="post-list-card">
                            <div className="post-list-body">
                              <div className="post-category-badge">{t("社区帖子", "Community Post")}</div>
                              <h3 className="post-list-title">{insight.title}</h3>
                              <div className="post-list-meta">
                                <span>{formatDate((insight as any).created_at || (insight as any).createdAt)} {t("发布", "published")}</span>
                                {insight.heat > 0 && <span> · {insight.heat} {t("赞", "likes")}</span>}
                              </div>
                            </div>
                            {parsed.coverImage && (
                              <div className="post-list-thumb" style={{ backgroundImage: `url(${parsed.coverImage})` }} />
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Leagues */}
              {activeTab === "leagues" && (
                <div>
                  {userLeagues.length === 0 ? (
                    <div className="empty-state">
                      <p>{isOwnProfile ? t("你还没有创建任何联赛", "No leagues created yet") : t("该用户还没有联赛", "No leagues")}</p>
                      {isOwnProfile && <Link href="/league/new" className="btn-primary-sm" style={{ textDecoration: "none", display: "inline-block", marginTop: 12 }}>{t("创建联赛", "Create League")}</Link>}
                    </div>
                  ) : (
                    <div className="leagues-list">
                      {userLeagues.map(league => (
                        <div key={league.id} className="league-list-card">
                          <Link href={`/league/${league.slug}`} className="league-list-info">
                            <div className="league-list-icon"></div>
                            <div>
                              <div className="league-list-name">{league.name}</div>
                              <div className="league-list-meta">
                                <span>{league.visibility === "public" ? t("公开联赛", "Public") : t("私人联赛", "Private")}</span>
                                <span> · </span>
                                <span>{formatDate((league as any).created_at || (league as any).createdAt)}</span>
                              </div>
                            </div>
                          </Link>
                          {isOwnProfile && (
                            <button className="delete-btn" onClick={() => setShowDeleteModal(league.id)}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Drafts */}
              {activeTab === "drafts" && (
                <div>
                  {draftHistory.length === 0 ? (
                    <div className="empty-state">
                      <p>{t("还没有选秀记录", "No draft history yet")}</p>
                      <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{t("完成联赛选秀后，记录会显示在这里", "Complete a league draft to see your history")}</p>
                      <Link href="/mock-draft" className="btn-primary-sm" style={{ textDecoration: "none", display: "inline-block", marginTop: 12 }}>{t("开始模拟选秀", "Start Mock Draft")}</Link>
                    </div>
                  ) : (
                    <div className="leagues-list">
                      {draftHistory.map(draft => (
                        <div key={draft.id} className="league-list-card">
                          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
                            <div style={{ width: 44, height: 44, borderRadius: 10, background: draft.rank === 1 ? "#eab308" : draft.rank === 2 ? "#94a3b8" : draft.rank === 3 ? "#cd7f32" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 16, color: draft.rank <= 3 ? "#000" : "#6b7280", flexShrink: 0 }}>#{draft.rank}</div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{draft.leagueName}</div>
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{draft.season} · {draft.totalTeams} {t("队伍", "teams")}</div>
                            </div>
                          </div>
                          <div style={{ fontWeight: 600, color: draft.rank === 1 ? "#eab308" : "#374151" }}>{draft.result}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              {activeTab === "stats" && (
                <div className="stats-grid-tab">
                  {[
                    { value: stats.totalPosts, label: t("发布帖子", "Posts Published") },
                    { value: stats.totalLikes, label: t("获得点赞", "Likes Received") },
                    { value: stats.totalComments, label: t("发表评论", "Comments Made") },
                    { value: stats.leaguesJoined, label: t("参与联赛", "Leagues Joined") },
                    { value: stats.leaguesWon, label: t("联赛冠军", "Championships") },
                    { value: stats.draftsCompleted, label: t("完成选秀", "Drafts Completed") },
                  ].map((s, i) => (
                    <div key={i} className="stats-tab-card">
                      <div className="stats-tab-value">{s.value}</div>
                      <div className="stats-tab-label">{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Bottom: Leagues + Season Stats ── */}
        {isOwnProfile && userLeagues.length > 0 && (
          <div className="bottom-two-col">
            {/* Recent leagues */}
            <div className="card bottom-card">
              <div className="bottom-card-header">
                <div>
                  <div className="bottom-card-sup">{t("我的联赛", "My Leagues")}</div>
                  <div className="bottom-card-title">{t("近期活跃联赛", "Recent Active Leagues")}</div>
                </div>
                <Link href="/league" className="bottom-see-all">{t("查看全部", "View All")}</Link>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {userLeagues.slice(0, 2).map(league => (
                  <Link key={league.id} href={`/league/${league.slug}`} className="bottom-league-row">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{league.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        {league.visibility === "public" ? t("公开联赛", "Public") : t("私人联赛", "Private")}
                      </div>
                    </div>
                    <span className="status-badge-active">{t("进行中", "Active")}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Season overview (placeholder until match data is tracked) */}
            <div className="card bottom-card">
              <div className="bottom-card-header">
                <div>
                  <div className="bottom-card-sup">{t("战绩统计", "Season Stats")}</div>
                  <div className="bottom-card-title">{t("赛季概览", "Season Overview")}</div>
                </div>
              </div>
              <div className="season-stats-grid">
                <div className="season-stat-cell">
                  <div className="season-stat-cap">{t("胜场", "Wins")}</div>
                  <div className="season-stat-val" style={{ color: "#1e3a8a" }}>--</div>
                </div>
                <div className="season-stat-cell">
                  <div className="season-stat-cap">{t("负场", "Losses")}</div>
                  <div className="season-stat-val" style={{ color: "#1e3a8a" }}>--</div>
                </div>
                <div className="season-stat-cell">
                  <div className="season-stat-cap">{t("场均得分", "Avg Pts")}</div>
                  <div className="season-stat-val" style={{ color: "#16a34a" }}>--</div>
                </div>
                <div className="season-stat-cell">
                  <div className="season-stat-cap">{t("排名", "Rank")}</div>
                  <div className="season-stat-val" style={{ color: "#f59e0b" }}>--</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Delete modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 700, color: "#111827" }}>{t("确认删除", "Confirm Delete")}</h3>
            <p style={{ color: "#6b7280", margin: "0 0 20px 0", fontSize: 14 }}>{t("确定要删除这个联赛吗？", "Delete this league?")}</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn-ghost-sm" onClick={() => setShowDeleteModal(null)}>{t("取消", "Cancel")}</button>
              <button className="btn-danger-sm" onClick={() => handleDeleteLeague(showDeleteModal)}>{t("删除", "Delete")}</button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Layout ── */
        .profile-main-wrap {
          max-width: 900px;
          margin: 0 auto;
          padding: 28px 16px 48px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          box-shadow: 0 1px 4px rgba(0,0,0,0.05);
        }

        /* ── Profile Card ── */
        .profile-card { padding: 24px; }
        .profile-top-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 20px;
          flex-wrap: wrap;
          gap: 10px;
        }
        .profile-tag-chip {
          background: #eff6ff;
          color: #1e40af;
          border: 1px solid #bfdbfe;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 500;
          padding: 4px 12px;
        }
        .profile-action-btns { display: flex; gap: 8px; }
        .btn-primary-sm {
          padding: 8px 18px;
          background: #1e3a8a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-ghost-sm {
          padding: 8px 16px;
          background: #f3f4f6;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
        }
        .btn-danger-sm {
          padding: 8px 16px;
          background: #dc2626;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
        }
        .profile-body { display: flex; gap: 20px; align-items: flex-start; }
        .avatar-wrap { position: relative; flex-shrink: 0; }
        .avatar-sq {
          width: 110px;
          height: 110px;
          border-radius: 20px;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 44px;
          font-weight: 800;
          color: #000;
        }
        .online-dot {
          position: absolute;
          bottom: 6px;
          right: 6px;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #22c55e;
          border: 2px solid #fff;
        }
        .profile-info { flex: 1; min-width: 0; }
        .display-name { font-size: 26px; font-weight: 800; color: #111827; margin: 0 0 8px 0; }
        .bio { font-size: 14px; color: #6b7280; margin: 0 0 14px 0; line-height: 1.6; }
        .profile-stats-row { display: flex; gap: 16px; font-size: 14px; color: #374151; flex-wrap: wrap; }
        .profile-stats-row strong { color: #111827; }

        /* ── Stats Cards ── */
        .stats-cards-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .stat-card { padding: 20px; }
        .stat-card-label { font-size: 12px; color: #6b7280; font-weight: 500; margin-bottom: 6px; }
        .stat-card-value { font-size: 36px; font-weight: 800; color: #111827; line-height: 1; margin-bottom: 6px; }
        .stat-card-sub { font-size: 12px; color: #9ca3af; }
        .online-value { color: #16a34a !important; }

        /* ── Two-column ── */
        .two-col-wrap { display: flex; gap: 16px; align-items: flex-start; }
        .sidebar { flex: 0 0 220px; display: flex; flex-direction: column; }
        .sidebar-card { padding: 18px; }
        .sidebar-section-title { font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
        .sidebar-btn-primary {
          display: block;
          width: 100%;
          padding: 10px;
          background: #1e3a8a;
          color: #fff;
          border: none;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          margin-bottom: 8px;
          box-sizing: border-box;
        }
        .sidebar-btn-ghost {
          display: block;
          width: 100%;
          padding: 10px;
          background: transparent;
          color: #374151;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 500;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
          box-sizing: border-box;
        }
        .tags-wrap { display: flex; flex-wrap: wrap; gap: 8px; }
        .tag { padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 500; }
        .tag-blue { background: #eff6ff; color: #1e40af; }
        .tag-orange { background: #fff7ed; color: #c2410c; }
        .tag-gray { background: #f3f4f6; color: #374151; }

        /* ── Content col ── */
        .content-col { flex: 1; min-width: 0; }
        .tab-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .tab-pill {
          padding: 8px 16px;
          border-radius: 999px;
          background: transparent;
          border: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .tab-pill:hover { border-color: #d1d5db; color: #374151; }
        .tab-pill.active { background: #1e3a8a; border-color: #1e3a8a; color: #fff; font-weight: 600; }
        .tab-content-wrap { background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; padding: 20px; }

        /* ── Posts list ── */
        .posts-list { display: flex; flex-direction: column; gap: 0; }
        .post-list-card {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          padding: 20px 0;
          border-bottom: 1px solid #f3f4f6;
          text-decoration: none;
          color: inherit;
          transition: background 0.15s;
        }
        .post-list-card:last-child { border-bottom: none; }
        .post-list-card:hover .post-list-title { color: #1e3a8a; }
        .post-list-body { flex: 1; min-width: 0; }
        .post-category-badge {
          display: inline-block;
          background: #fef3c7;
          color: #92400e;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          margin-bottom: 8px;
        }
        .post-list-title { font-size: 17px; font-weight: 700; color: #111827; margin: 0 0 8px 0; line-height: 1.4; transition: color 0.15s; }
        .post-list-meta { font-size: 12px; color: #9ca3af; }
        .post-list-thumb { width: 120px; height: 80px; border-radius: 10px; background-size: cover; background-position: center; flex-shrink: 0; }

        /* ── Leagues list ── */
        .leagues-list { display: flex; flex-direction: column; gap: 10px; }
        .league-list-card { display: flex; align-items: center; justify-content: space-between; padding: 14px 0; border-bottom: 1px solid #f3f4f6; }
        .league-list-card:last-child { border-bottom: none; }
        .league-list-info { display: flex; align-items: center; gap: 12px; text-decoration: none; color: inherit; flex: 1; }
        .league-list-icon { width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
        .league-list-name { font-weight: 600; font-size: 14px; color: #111827; }
        .league-list-meta { font-size: 12px; color: #6b7280; margin-top: 2px; }
        .delete-btn { background: none; border: none; font-size: 14px; cursor: pointer; color: #9ca3af; padding: 6px; transition: color 0.15s; }
        .delete-btn:hover { color: #dc2626; }

        /* ── Stats tab ── */
        .stats-grid-tab { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .stats-tab-card { background: #f9fafb; border-radius: 10px; padding: 16px; text-align: center; }
        .stats-tab-value { font-size: 28px; font-weight: 800; color: #111827; }
        .stats-tab-label { font-size: 12px; color: #6b7280; margin-top: 4px; }

        /* ── Empty state ── */
        .empty-state { text-align: center; padding: 40px 20px; color: #6b7280; font-size: 14px; }

        /* ── Bottom two-col ── */
        .bottom-two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .bottom-card { padding: 20px; }
        .bottom-card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .bottom-card-sup { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .bottom-card-title { font-size: 15px; font-weight: 700; color: #111827; }
        .bottom-see-all { font-size: 12px; color: #1e3a8a; text-decoration: none; font-weight: 500; }
        .bottom-league-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid #f3f4f6;
          text-decoration: none;
          color: inherit;
        }
        .bottom-league-row:last-child { border-bottom: none; }
        .status-badge-active {
          background: #dcfce7;
          color: #16a34a;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          padding: 3px 10px;
          flex-shrink: 0;
        }
        .season-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .season-stat-cell { }
        .season-stat-cap { font-size: 12px; color: #6b7280; margin-bottom: 4px; }
        .season-stat-val { font-size: 28px; font-weight: 800; }

        /* ── Modal ── */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .modal-box { background: #fff; border-radius: 16px; padding: 24px; max-width: 400px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }

        /* ── Mobile ── */
        @media (max-width: 768px) {
          .profile-main-wrap { padding: 16px 12px 32px; }
          .profile-body { flex-direction: column; align-items: center; text-align: center; }
          .avatar-sq { width: 90px; height: 90px; font-size: 36px; border-radius: 16px; }
          .display-name { font-size: 22px; }
          .profile-stats-row { justify-content: center; }
          .stats-cards-row { grid-template-columns: 1fr; }
          .two-col-wrap { flex-direction: column; }
          .sidebar { flex: none; width: 100%; }
          .bottom-two-col { grid-template-columns: 1fr; }
          .stats-grid-tab { grid-template-columns: repeat(2, 1fr); }
          .post-list-thumb { width: 80px; height: 56px; }
          .tab-bar { gap: 4px; }
          .tab-pill { padding: 7px 12px; font-size: 12px; }
        }
      `}</style>
    </div>
  );
}
