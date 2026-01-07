"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getSessionUser, listLeagues, listInsights, League, Insight } from "@/lib/store";

export default function UserProfilePage() {
  const { t } = useLang();
  const params = useParams();
  const username = params.username as string;
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "leagues">("posts");
  const [userLeagues, setUserLeagues] = useState<League[]>([]);
  const [userInsights, setUserInsights] = useState<Insight[]>([]);

  useEffect(() => {
    const currentUser = getSessionUser();
    setUser(currentUser);
    
    if (currentUser && currentUser.username === username) {
      setIsOwnProfile(true);
      // 获取用户的联赛和帖子
      const leagues = listLeagues().filter(l => l.ownerId === currentUser.id);
      setUserLeagues(leagues);
      const insights = listInsights().filter(i => i.author === currentUser.username || i.author === `@${currentUser.username}`);
      setUserInsights(insights);
    }
  }, [username]);

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        {/* Profile Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 32 }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            borderRadius: "50%", 
            background: "linear-gradient(135deg, #f59e0b, #d97706)", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            fontSize: 32,
            fontWeight: 700,
            color: "#000"
          }}>
            {username[0]?.toUpperCase()}
          </div>
          <div>
            <h1 className="page-title" style={{ marginBottom: 4 }}>@{username}</h1>
            <p style={{ color: "var(--text-muted)" }}>
              {isOwnProfile ? t("这是你的个人主页", "This is your profile") : t("用户主页", "User Profile")}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          <button 
            className={`toggle-btn ${activeTab === "posts" ? "active" : ""}`}
            onClick={() => setActiveTab("posts")}
          >
            {t("帖子", "Posts")} ({userInsights.length})
          </button>
          <button 
            className={`toggle-btn ${activeTab === "leagues" ? "active" : ""}`}
            onClick={() => setActiveTab("leagues")}
          >
            {t("联赛", "Leagues")} ({userLeagues.length})
          </button>
        </div>

        {/* Content */}
        {activeTab === "posts" ? (
          <div>
            {userInsights.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                  {isOwnProfile ? t("你还没有发布任何帖子", "You haven't posted anything yet") : t("该用户还没有发布帖子", "This user hasn't posted anything yet")}
                </p>
                {isOwnProfile && (
                  <Link href="/insights/new" className="btn btn-primary">{t("发布第一篇帖子", "Create Your First Post")}</Link>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {userInsights.map(insight => (
                  <Link key={insight.id} href={`/insights/${insight.id}`} style={{ 
                    background: "var(--bg-card)", 
                    border: "1px solid var(--border-color)", 
                    borderRadius: 12, 
                    padding: 20,
                    transition: "border-color 0.2s"
                  }}>
                    <h3 style={{ marginBottom: 8 }}>{insight.title}</h3>
                    <div style={{ display: "flex", gap: 16, color: "var(--text-muted)", fontSize: 14 }}>
                      <span>🔥 {insight.heat}</span>
                      <span>{new Date(insight.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            {userLeagues.length === 0 ? (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 40, textAlign: "center" }}>
                <p style={{ color: "var(--text-muted)", marginBottom: 16 }}>
                  {isOwnProfile ? t("你还没有创建或加入任何联赛", "You haven't created or joined any leagues") : t("该用户还没有联赛", "This user has no leagues")}
                </p>
                {isOwnProfile && (
                  <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
                    <Link href="/league/new" className="btn btn-primary">{t("创建联赛", "Create League")}</Link>
                    <Link href="/league/join" className="btn btn-ghost">{t("加入联赛", "Join League")}</Link>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {userLeagues.map(league => (
                  <Link key={league.id} href={`/league/${league.slug}`} style={{ 
                    background: "var(--bg-card)", 
                    border: "1px solid var(--border-color)", 
                    borderRadius: 12, 
                    padding: 20,
                    transition: "border-color 0.2s"
                  }}>
                    <h3 style={{ marginBottom: 8 }}>{league.name}</h3>
                    <div style={{ display: "flex", gap: 16, color: "var(--text-muted)", fontSize: 14 }}>
                      <span>{league.visibility === "public" ? t("公开", "Public") : t("私人", "Private")}</span>
                      <span>{new Date(league.createdAt).toLocaleDateString()}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
