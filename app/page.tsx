"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";

export default function HomePage() {
  const { t } = useLang();
  const [authed, setAuthed] = useState(false);
  const [showHero, setShowHero] = useState(true);
  const [topTab, setTopTab] = useState<"insights" | "leagues">("insights");
  const [feedTab, setFeedTab] = useState<"forYou" | "latest">("forYou");

  useEffect(() => {
    const u = getSessionUser();
    if (u) setAuthed(true);
  }, []);

  // 这些是用户创建的内容，保持原语言
  const insights = [
    { id: "why-tatum-1-06", title: "为什么我在 1.06 放弃了 Tatum", leagueName: "LeBron Lab", author: "@shuyang", watching: 238, heat: 238 },
    { id: "auction-scarcity", title: "拍卖联赛：别追稀缺叙事", leagueName: "Auction Chaos", author: "@ivy", watching: 154, heat: 154 },
    { id: "defense-wins", title: "Defense wins: lock stable minutes first", leagueName: "Defense Wins", author: "@coachk", watching: 91, heat: 91 },
    { id: "pace-guards", title: "Mid rounds strategy: stack high-pace guards", leagueName: "Pace Merchants", author: "@jules", watching: 73, heat: 73 },
  ];

  const leagues = [
    { slug: "lebron-lab", name: "LeBron Lab", owner: "@shuyang", watching: 238, phase: "Drafting", teams: 12 },
    { slug: "auction-chaos", name: "Auction Chaos", owner: "@ivy", watching: 154, phase: "Completed", teams: 14 },
    { slug: "defense-wins", name: "Defense Wins", owner: "@coachk", watching: 91, phase: "Pre-draft", teams: 10 },
    { slug: "booth-ballers", name: "Booth 球友会", owner: "@mif", watching: 62, phase: "In-season", teams: 12 },
  ];

  const handleAction = (action: string) => {
    if (!authed && action !== "mock") {
      alert(t("请先登录", "Please login first"));
      return;
    }
    if (action === "create") window.location.href = "/league/new";
    if (action === "join") window.location.href = "/league/join";
    if (action === "mock") window.location.href = "/mock-draft";
  };

  return (
    <div className="app">
      <Header />

      {/* Hero Section */}
      {showHero && (
        <section className="hero">
          <button className="hero-close" onClick={() => setShowHero(false)}>×</button>
          <div className="hero-content">
            <div className="hero-badge">Beta</div>
            <h1 className="hero-title">
              {t("准备好开始你的", "Ready to Start Your")}<br/>
              <span className="gradient-text">{t("Fantasy 篮球之旅？", "Fantasy Basketball Journey?")}</span>
            </h1>
            <p className="hero-sub">{t("最专业的中文 Fantasy 篮球平台", "The #1 Fantasy Basketball Platform")}</p>
            
            <div className="hero-actions">
              <button className="hero-btn primary" onClick={() => handleAction("create")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t("创建联赛", "Create League")}
              </button>
              <button className="hero-btn secondary" onClick={() => handleAction("join")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {t("加入公共联赛", "Join Public League")}
              </button>
              <button className="hero-btn outline" onClick={() => handleAction("mock")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {t("模拟选秀", "Mock Draft")}
              </button>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-ball">
              <svg viewBox="0 0 120 120" fill="none">
                <circle cx="60" cy="60" r="55" stroke="currentColor" strokeWidth="3"/>
                <path d="M60 5 C60 5, 20 40, 60 60 C100 80, 60 115, 60 115" stroke="currentColor" strokeWidth="3" fill="none"/>
                <path d="M5 60 H115" stroke="currentColor" strokeWidth="3"/>
              </svg>
            </div>
          </div>
        </section>
      )}

      {/* Content Tabs - UI 翻译 */}
      <nav className="tabs-bar">
        <div className="tabs-inner">
          <div className="tabs-left">
            <button className={`tab ${topTab === "insights" ? "active" : ""}`} onClick={() => setTopTab("insights")}>{t("洞见", "Insights")}</button>
            <button className={`tab ${topTab === "leagues" ? "active" : ""}`} onClick={() => setTopTab("leagues")}>{t("联盟", "Leagues")}</button>
          </div>
          <div className="tabs-right">
            <button className={`tab-pill ${feedTab === "forYou" ? "active" : ""}`} onClick={() => setFeedTab("forYou")}>{t("推荐", "For You")}</button>
            <button className={`tab-pill ${feedTab === "latest" ? "active" : ""}`} onClick={() => setFeedTab("latest")}>{t("最新", "Latest")}</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          <div className="grid">
            {/* Feed - 内容保持原样 */}
            <section className="feed">
              {topTab === "insights" ? (
                insights.map((item) => (
                  <article key={item.id} className="card">
                    <div className="card-thumb">
                      <span className="card-heat">🔥 {item.heat}</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{item.title}</h3>
                      <div className="card-meta">
                        <span className="meta-tag">{item.leagueName}</span>
                        <span>{item.author}</span>
                      </div>
                      <div className="card-footer">
                        <span className="watching">{item.watching} {t("人在看", "watching")}</span>
                        <Link className="card-link" href={`/insights/${item.id}`}>{t("查看", "View")} →</Link>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                leagues.map((item) => (
                  <article key={item.slug} className="card">
                    <div className="card-thumb league-thumb">
                      <span className="league-teams">{item.teams} {t("队", "teams")}</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{item.name}</h3>
                      <div className="card-meta">
                        <span className="phase-tag">{item.phase}</span>
                        <span>{item.owner}</span>
                      </div>
                      <div className="card-footer">
                        <span className="watching">{item.watching} {t("人在看", "watching")}</span>
                        <Link className="card-link" href={`/league/${item.slug}`}>{t("查看", "View")} →</Link>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>

            {/* Sidebar - UI 翻译 */}
            <aside className="sidebar">
              <div className="widget">
                <h4 className="widget-title">{t("快速开始", "Get Started")}</h4>
                <p className="widget-text">{t("创建或加入一个联赛，开始你的 Fantasy 篮球之旅。", "Create or join a league to start your Fantasy basketball journey.")}</p>
                <div className="widget-actions">
                  <button className="widget-btn primary" onClick={() => handleAction("create")}>{t("创建联赛", "Create League")}</button>
                  <button className="widget-btn" onClick={() => handleAction("join")}>{t("加入公共联赛", "Join Public League")}</button>
                  <button className="widget-btn outline" onClick={() => handleAction("mock")}>{t("模拟选秀", "Mock Draft")}</button>
                </div>
              </div>

              <div className="widget">
                <h4 className="widget-title">{t("本周之星", "Top This Week")}</h4>
                <div className="leaderboard">
                  <div className="leader-item">
                    <span className="leader-rank gold">1</span>
                    <div className="leader-avatar">S</div>
                    <div className="leader-info">
                      <span className="leader-name">@shuyang</span>
                      <span className="leader-stat">2,340 pts</span>
                    </div>
                  </div>
                  <div className="leader-item">
                    <span className="leader-rank silver">2</span>
                    <div className="leader-avatar">I</div>
                    <div className="leader-info">
                      <span className="leader-name">@ivy</span>
                      <span className="leader-stat">2,180 pts</span>
                    </div>
                  </div>
                  <div className="leader-item">
                    <span className="leader-rank bronze">3</span>
                    <div className="leader-avatar">C</div>
                    <div className="leader-info">
                      <span className="leader-name">@coachk</span>
                      <span className="leader-stat">1,950 pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
