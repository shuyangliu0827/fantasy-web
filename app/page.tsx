/* app/page.tsx */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Lang = "zh" | "en";

const copy = {
  zh: {
    brand: "蓝本",
    brandSub: "Fantasy 篮球决策平台",
    searchPH: "搜索球员 / 联盟 / 洞见…",
    beta: "Beta",
    login: "登录",
    signup: "注册",
    logout: "退出",
    // Hero
    heroTitle: "准备好开始你的",
    heroTitle2: "Fantasy 篮球之旅？",
    heroSub: "最专业的中文 Fantasy 篮球平台",
    createLeague: "创建联赛",
    joinPublic: "加入公共联赛",
    mockDraft: "模拟选秀",
    // Nav
    nav: {
      home: "首页",
      rankings: "球员排名",
      draftGuide: "选秀指南",
      cheatSheet: "备忘单",
      howToPlay: "新手入门",
      myTeam: "我的球队",
      mockDraft: "模拟选秀",
    },
    // Sidebar
    quickTitle: "快速开始",
    quickText: "创建或加入一个联赛，开始你的 Fantasy 篮球之旅。",
    leaderTitle: "本周之星",
    // Feed
    tabs: { insights: "洞见", leagues: "联盟" },
    feedTabs: { forYou: "推荐", latest: "最新" },
    open: "查看 →",
  },
  en: {
    brand: "Blueprint",
    brandSub: "Fantasy Basketball Platform",
    searchPH: "Search players / leagues / insights…",
    beta: "Beta",
    login: "Login",
    signup: "Sign Up",
    logout: "Logout",
    // Hero
    heroTitle: "Ready to Start Your",
    heroTitle2: "Fantasy Basketball Journey?",
    heroSub: "The #1 Fantasy Basketball Platform",
    createLeague: "Create a League",
    joinPublic: "Join Public League",
    mockDraft: "Mock Draft",
    // Nav
    nav: {
      home: "Home",
      rankings: "Rankings",
      draftGuide: "Draft Guide",
      cheatSheet: "Cheat Sheet",
      howToPlay: "How To Play",
      myTeam: "My Team",
      mockDraft: "Mock Draft",
    },
    // Sidebar
    quickTitle: "Get Started",
    quickText: "Create or join a league to start your Fantasy basketball journey.",
    leaderTitle: "Top Players This Week",
    // Feed
    tabs: { insights: "Insights", leagues: "Leagues" },
    feedTabs: { forYou: "For You", latest: "Latest" },
    open: "View →",
  },
} as const;

type InsightCard = {
  id: string;
  title: string;
  leagueName: string;
  author: string;
  watching: number;
  heat: number;
};

type LeagueCard = {
  slug: string;
  name: string;
  owner: string;
  watching: number;
  phase: string;
  teams: number;
};

export default function HomePage() {
  const [lang, setLang] = useState<Lang>("zh");
  const [authed, setAuthed] = useState(false);
  const [me, setMe] = useState<{ name: string; username: string } | null>(null);
  const [showHero, setShowHero] = useState(true);
  const [topTab, setTopTab] = useState<"insights" | "leagues">("insights");
  const [feedTab, setFeedTab] = useState<"forYou" | "latest">("forYou");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("bp_session");
      if (!raw) return;
      const u = JSON.parse(raw) as { name?: string };
      if (!u?.name) return;
      const username = u.name.toLowerCase().replace(/\s+/g, "");
      setMe({ name: u.name, username });
      setAuthed(true);
    } catch {}
  }, []);

  const t = copy[lang];

  const insights: InsightCard[] = useMemo(
    () => [
      { id: "why-tatum-1-06", title: lang === "zh" ? "为什么我在 1.06 放弃了 Tatum" : "Why I passed on Tatum at 1.06", leagueName: "LeBron Lab", author: "@shuyang", watching: 238, heat: 238 },
      { id: "auction-scarcity", title: lang === "zh" ? "拍卖联赛：别追稀缺叙事" : "Auction: stop chasing scarcity", leagueName: "Auction Chaos", author: "@ivy", watching: 154, heat: 154 },
      { id: "defense-wins", title: lang === "zh" ? "防守赢：先锁稳定上场时间" : "Defense wins: lock stable minutes", leagueName: "Defense Wins", author: "@coachk", watching: 91, heat: 91 },
      { id: "pace-guards", title: lang === "zh" ? "中后轮策略：堆快节奏后卫" : "Mid rounds: stack high-pace guards", leagueName: "Pace Merchants", author: "@jules", watching: 73, heat: 73 },
    ],
    [lang]
  );

  const leagues: LeagueCard[] = useMemo(
    () => [
      { slug: "lebron-lab", name: "LeBron Lab", owner: "@shuyang", watching: 238, phase: lang === "zh" ? "选秀中" : "Drafting", teams: 12 },
      { slug: "auction-chaos", name: "Auction Chaos", owner: "@ivy", watching: 154, phase: lang === "zh" ? "已完成" : "Completed", teams: 14 },
      { slug: "defense-wins", name: "Defense Wins", owner: "@coachk", watching: 91, phase: lang === "zh" ? "赛前" : "Pre-draft", teams: 10 },
      { slug: "booth-ballers", name: lang === "zh" ? "Booth 球友会" : "Booth Ballers", owner: "@mif", watching: 62, phase: lang === "zh" ? "赛季中" : "In-season", teams: 12 },
    ],
    [lang]
  );

  const feedItems = topTab === "insights" ? insights : leagues;

  const handleAction = (action: string) => {
    if (!authed && action !== "mock") {
      alert(lang === "zh" ? "请先登录" : "Please login first");
      return;
    }
    if (action === "create") window.location.href = "/league/new";
    if (action === "join") window.location.href = "/league/join";
    if (action === "mock") window.location.href = "/mock-draft";
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-title">{t.brand}</span>
              <span className="logo-sub">{t.brandSub}</span>
            </div>
          </Link>

          <div className="search-box">
            <svg className="search-icon" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <input placeholder={t.searchPH} />
          </div>

          <div className="header-actions">
            <button className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
              <span className={lang === "zh" ? "active" : ""}>中</span>
              <span className="divider">/</span>
              <span className={lang === "en" ? "active" : ""}>EN</span>
            </button>

            {!authed ? (
              <>
                <Link className="btn btn-ghost" href="/auth/login">{t.login}</Link>
                <Link className="btn btn-primary" href="/auth/signup">{t.signup}</Link>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" href={`/u/${me?.username}`}>
                  <span className="avatar-small">{me?.name?.[0]}</span>
                  @{me?.username}
                </Link>
                <button className="btn btn-ghost" onClick={() => { localStorage.removeItem("bp_session"); setMe(null); setAuthed(false); }}>
                  {t.logout}
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Navigation */}
      <nav className="main-nav">
        <div className="nav-inner">
          <Link href="/" className="nav-link active">{t.nav.home}</Link>
          <Link href="/rankings" className="nav-link">{t.nav.rankings}</Link>
          <Link href="/draft-guide" className="nav-link">{t.nav.draftGuide}</Link>
          <Link href="/cheat-sheet" className="nav-link">{t.nav.cheatSheet}</Link>
          <Link href="/how-to-play" className="nav-link">{t.nav.howToPlay}</Link>
          <Link href="/my-team" className="nav-link">{t.nav.myTeam}</Link>
          <Link href="/mock-draft" className="nav-link">{t.nav.mockDraft}</Link>
        </div>
      </nav>

      {/* Hero Section */}
      {showHero && (
        <section className="hero">
          <button className="hero-close" onClick={() => setShowHero(false)}>×</button>
          <div className="hero-content">
            <div className="hero-badge">{t.beta}</div>
            <h1 className="hero-title">
              {t.heroTitle}<br/>
              <span className="gradient-text">{t.heroTitle2}</span>
            </h1>
            <p className="hero-sub">{t.heroSub}</p>
            
            <div className="hero-actions">
              <button className="hero-btn primary" onClick={() => handleAction("create")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 8v8M8 12h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {t.createLeague}
              </button>
              <button className="hero-btn secondary" onClick={() => handleAction("join")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2"/>
                  <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {t.joinPublic}
              </button>
              <button className="hero-btn outline" onClick={() => handleAction("mock")}>
                <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                {t.mockDraft}
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

      {/* Content Tabs */}
      <nav className="tabs-bar">
        <div className="tabs-inner">
          <div className="tabs-left">
            <button className={`tab ${topTab === "insights" ? "active" : ""}`} onClick={() => setTopTab("insights")}>{t.tabs.insights}</button>
            <button className={`tab ${topTab === "leagues" ? "active" : ""}`} onClick={() => setTopTab("leagues")}>{t.tabs.leagues}</button>
          </div>
          <div className="tabs-right">
            <button className={`tab-pill ${feedTab === "forYou" ? "active" : ""}`} onClick={() => setFeedTab("forYou")}>{t.feedTabs.forYou}</button>
            <button className={`tab-pill ${feedTab === "latest" ? "active" : ""}`} onClick={() => setFeedTab("latest")}>{t.feedTabs.latest}</button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="main">
        <div className="container">
          <div className="grid">
            {/* Feed */}
            <section className="feed">
              {feedItems.map((item) =>
                topTab === "insights" ? (
                  <article key={(item as InsightCard).id} className="card">
                    <div className="card-thumb">
                      <span className="card-heat">🔥 {(item as InsightCard).heat}</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{(item as InsightCard).title}</h3>
                      <div className="card-meta">
                        <span className="meta-tag">{(item as InsightCard).leagueName}</span>
                        <span>{(item as InsightCard).author}</span>
                      </div>
                      <div className="card-footer">
                        <span className="watching">{(item as InsightCard).watching} watching</span>
                        <Link className="card-link" href={`/insights/${(item as InsightCard).id}`}>{t.open}</Link>
                      </div>
                    </div>
                  </article>
                ) : (
                  <article key={(item as LeagueCard).slug} className="card">
                    <div className="card-thumb league-thumb">
                      <span className="league-teams">{(item as LeagueCard).teams} teams</span>
                    </div>
                    <div className="card-body">
                      <h3 className="card-title">{(item as LeagueCard).name}</h3>
                      <div className="card-meta">
                        <span className={`phase-tag ${(item as LeagueCard).phase.toLowerCase().replace(/[^a-z]/g, "")}`}>{(item as LeagueCard).phase}</span>
                        <span>{(item as LeagueCard).owner}</span>
                      </div>
                      <div className="card-footer">
                        <span className="watching">{(item as LeagueCard).watching} watching</span>
                        <Link className="card-link" href={`/league/${(item as LeagueCard).slug}`}>{t.open}</Link>
                      </div>
                    </div>
                  </article>
                )
              )}
            </section>

            {/* Sidebar */}
            <aside className="sidebar">
              <div className="widget">
                <h4 className="widget-title">{t.quickTitle}</h4>
                <p className="widget-text">{t.quickText}</p>
                <div className="widget-actions">
                  <button className="widget-btn primary" onClick={() => handleAction("create")}>{t.createLeague}</button>
                  <button className="widget-btn" onClick={() => handleAction("join")}>{t.joinPublic}</button>
                  <button className="widget-btn outline" onClick={() => handleAction("mock")}>{t.mockDraft}</button>
                </div>
              </div>

              <div className="widget">
                <h4 className="widget-title">{t.leaderTitle}</h4>
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
