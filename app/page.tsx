"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";
import HeroSection from "@/components/HeroSection";
import DraftWinsSection from "@/components/DraftWinsSection";
import BrandCurtain from "@/components/BrandCurtain";
import { HERO_PLAYERS, TEAM_ZH, type HeroPlayer } from "@/lib/heroPlayers";

const NAV_ITEMS = [
  { href: "/", labelZh: "首页", labelEn: "Home" },
  { href: "/discover", labelZh: "发现", labelEn: "Discover" },
  { href: "/contest", labelZh: "每日挑战赛", labelEn: "Daily Contest" },
  { href: "/rankings", labelZh: "球员排名", labelEn: "Rankings" },
  { href: "/league", labelZh: "公开联赛", labelEn: "Leagues" },
  { href: "/compare", labelZh: "球员对比", labelEn: "Compare" },
  { href: "/draft-guide", labelZh: "Fantasy新闻", labelEn: "Fantasy News" },
  { href: "/cheat-sheet", labelZh: "备忘单", labelEn: "Cheat Sheet" },
  { href: "/how-to-play", labelZh: "新手入门", labelEn: "How To Play" },
];

const FEATURES = [
  {
    accentColor: "#dbeafe",
    titleZh: "AI 球员排名",
    titleEn: "AI Rankings",
    descZh: "综合30+数据维度，每日更新，精准量化每个球员的范特西价值。",
    descEn: "30+ data dimensions updated daily to quantify every player's fantasy value.",
    href: "/rankings",
  },
  {
    accentColor: "#fef3c7",
    titleZh: "公开联赛",
    titleEn: "Public Leagues",
    descZh: "加入全国玩家的公开联赛，展示你的选秀实力，赢取排行榜荣耀。",
    descEn: "Join leagues nationwide and prove your draft skills on the leaderboard.",
    href: "/league",
  },
  {
    accentColor: "#e0f2fe",
    titleZh: "每日挑战赛",
    titleEn: "Daily Contest",
    descZh: "基于真实当日赛程的全局公开赛，按分层规则组阵并实时比拼。",
    descEn: "A global same-day public contest built from the real slate with tier-based lineup rules.",
    href: "/contest",
  },
  {
    accentColor: "#dbeafe",
    titleZh: "模拟选秀",
    titleEn: "Mock Draft",
    descZh: "在真实选秀前反复练习，AI对手陪你跑通每一套战略方案。",
    descEn: "Practice with AI opponents before the real draft to test every strategy.",
    href: "/mock-draft",
  },
  {
    accentColor: "#fef9ee",
    titleZh: "球员对比",
    titleEn: "Player Compare",
    descZh: "任意两名球员深度数据对比，帮你在关键轮次做出最优决策。",
    descEn: "Deep data comparison of any two players to make the best pick each round.",
    href: "/compare",
  },
];


const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export default function HomePage() {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<{ name: string; username: string } | null>(() => {
    const u = getSessionUser();
    return u ? { name: u.name, username: u.username } : null;
  });
  const [hovered, setHovered] = useState<number | null>(null);
  const [loginHovered, setLoginHovered] = useState(false);
  const [signupHovered, setSignupHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [heroPlayer, setHeroPlayer] = useState<HeroPlayer | null>(null);

  useEffect(() => {
    // Pick random player with live stats from rankings API
    fetch("/api/nba-stats")
      .then(r => r.json())
      .then(data => {
        const fallback = () => setHeroPlayer(HERO_PLAYERS[Math.floor(Math.random() * HERO_PLAYERS.length)]);
        if (!data.players || data.players.length === 0) { fallback(); return; }
        const norm = (n: string) => n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const liveMap = new Map<string, { team: string; pts: number; reb: number; ast: number }>(
          data.players.map((p: { name: string; team: string; averages: { pts: number; reb: number; ast: number } }) => [
            norm(p.name),
            { team: p.team, pts: p.averages.pts, reb: p.averages.reb, ast: p.averages.ast },
          ])
        );
        const enriched: HeroPlayer[] = HERO_PLAYERS.map(hp => {
          const live = liveMap.get(norm(hp.name));
          if (!live) return hp;
          return {
            ...hp,
            team: live.team,
            teamZh: TEAM_ZH[live.team] ?? hp.teamZh,
            pts: live.pts.toFixed(1),
            reb: live.reb.toFixed(1),
            ast: live.ast.toFixed(1),
          };
        });
        setHeroPlayer(enriched[Math.floor(Math.random() * enriched.length)]);
      })
      .catch(() => setHeroPlayer(HERO_PLAYERS[Math.floor(Math.random() * HERO_PLAYERS.length)]));

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMenuOpen(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("bp_session");
    setUser(null);
    window.location.href = "/";
  };


  return (
    <div style={{ background: "#fff", minHeight: "100vh", fontFamily: FONT, color: "#0f172a" }}>
      <BrandCurtain />

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
        isolation: "isolate",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 10px" : "0 24px",
          height: isMobile ? 60 : 64, display: "flex", alignItems: "center", gap: isMobile ? 8 : 32,
        }}>

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
          </Link>

          {/* Desktop nav */}
          {!isMobile && (
            <nav style={{ display: "flex", gap: 2, flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
              {NAV_ITEMS.map(item => {
                const isActive = item.href === "/";
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      padding: "7px 13px",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? "#0f172a" : "#64748b",
                      background: isActive ? "#f1f5f9" : "transparent",
                      textDecoration: "none",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s",
                    }}
                  >
                    {lang === "zh" ? item.labelZh : item.labelEn}
                  </Link>
                );
              })}
            </nav>
          )}

          {/* Spacer on mobile */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Desktop right actions */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                style={{
                  padding: "7px 14px",
                  border: "1px solid #e2e8f0",
                  borderRadius: 999,
                  background: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#64748b",
                  cursor: "pointer",
                }}
              >
                中 / EN
              </button>
              {!user ? (
                <>
                  <Link
                    href="/auth/login"
                    onMouseEnter={() => setLoginHovered(true)}
                    onMouseLeave={() => setLoginHovered(false)}
                    style={{
                      padding: "8px 18px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#374151",
                      textDecoration: "none",
                      background: loginHovered ? "#f8fafc" : "#fff",
                      transition: "background 0.15s",
                    }}
                  >
                    {t("登录", "Login")}
                  </Link>
                  <Link
                    href="/auth/signup"
                    onMouseEnter={() => setSignupHovered(true)}
                    onMouseLeave={() => setSignupHovered(false)}
                    style={{
                      padding: "8px 20px",
                      background: signupHovered ? "#1e40af" : "#1e3a8a",
                      borderRadius: 8,
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#fff",
                      textDecoration: "none",
                      transition: "background 0.15s",
                    }}
                  >
                    {t("注册", "Sign Up")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/u/${user.username}`} style={{ fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500, padding: "8px 4px" }}>
                    {user.name || user.username}
                  </Link>
                  <button onClick={handleLogout} style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>
                    {t("退出", "Logout")}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              style={{
                width: 44, height: 44,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
              }}
            >
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none", transition: "transform 0.2s ease" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s ease" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none", transition: "transform 0.2s ease" }} />
            </button>
          )}
        </div>


        {/* Mobile drawer */}
        {isMobile && menuOpen && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "#fff", borderBottom: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 99,
            maxHeight: "calc(100vh - 60px)", overflowY: "auto",
          }}>
            {NAV_ITEMS.map(item => {
              const isActive = item.href === "/";
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{
                  display: "block", padding: "14px 20px", fontSize: 15,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#1e3a8a" : "#374151",
                  textDecoration: "none",
                  borderLeft: isActive ? "3px solid #1e3a8a" : "3px solid transparent",
                  background: isActive ? "#f8fafc" : "transparent",
                }}>
                  {lang === "zh" ? item.labelZh : item.labelEn}
                </Link>
              );
            })}
            <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
            <div style={{ padding: "12px 16px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} style={{ padding: "6px 14px", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                中 / EN
              </button>
              {!user ? (
                <>
                  <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ padding: "8px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#374151", textDecoration: "none", background: "#fff" }}>
                    {t("登录", "Login")}
                  </Link>
                  <Link href="/auth/signup" onClick={() => setMenuOpen(false)} style={{ padding: "8px 16px", background: "#1e3a8a", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none" }}>
                    {t("注册", "Sign Up")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/u/${user.username}`} onClick={() => setMenuOpen(false)} style={{ padding: "8px 4px", fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500 }}>
                    {user.name || user.username}
                  </Link>
                  <button onClick={() => { handleLogout(); setMenuOpen(false); }} style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>
                    {t("退出", "Logout")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Section 1: Dark cinematic hero */}
      {heroPlayer && <HeroSection player={heroPlayer} />}

      {/* Section 2: Draft wins — product explainer */}
      {heroPlayer && <DraftWinsSection player={heroPlayer} isMobile={isMobile} />}


      {/* Feature cards */}
      <section style={{ background: "#f8fafc", padding: isMobile ? "36px 12px 44px" : "64px 24px 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
            gap: 20,
          }}>
            {FEATURES.map((f, i) => (
              <Link key={i} href={f.href} style={{ textDecoration: "none" }}>
                <div
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  style={{
                    background: "#fff",
                    borderRadius: 16,
                    padding: "28px 26px 30px",
                    border: `1px solid ${hovered === i ? "#dbeafe" : "#e2e8f0"}`,
                    boxShadow: hovered === i
                      ? "0 8px 32px rgba(30,58,138,0.10)"
                      : "0 2px 8px rgba(0,0,0,0.05)",
                    transition: "all 0.2s ease",
                    transform: hovered === i ? "translateY(-3px)" : "none",
                    cursor: "pointer",
                    minHeight: 200,
                  }}
                >
                  {/* Color block instead of emoji */}
                  <div style={{
                    width: 48, height: 48,
                    background: f.accentColor,
                    borderRadius: 12,
                    marginBottom: 18,
                  }} />

                  <div style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
                    {lang === "zh" ? f.titleZh : f.titleEn}
                  </div>

                  <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.65, margin: 0 }}>
                    {lang === "zh" ? f.descZh : f.descEn}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>


    </div>
  );
}
