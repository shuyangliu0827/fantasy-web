"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";
import { getCurrentSeasonLabel } from "@/lib/season";

const NAV_ITEMS = [
  { href: "/", labelZh: "首页", labelEn: "Home" },
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

const STATS = [
  { num: "480+", labelZh: "NBA球员数据库", labelEn: "NBA Players Tracked", color: "#2563eb" },
  { num: "12K", labelZh: "活跃用户", labelEn: "Active Users", color: "#2563eb" },
  { num: "98%", labelZh: "数据准确率", labelEn: "Data Accuracy", color: "#059669" },
];

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export default function HomePage() {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<{ name: string; username: string } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [loginHovered, setLoginHovered] = useState(false);
  const [signupHovered, setSignupHovered] = useState(false);
  const [cta1Hovered, setCta1Hovered] = useState(false);
  const [cta2Hovered, setCta2Hovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser({ name: u.name, username: u.username });

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

        {/* Page tabs: 首页 / 发现 */}
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 12px" : "0 24px",
          display: "flex", gap: 0, overflowX: "auto",
          borderTop: "1px solid #f1f5f9",
        }}>
          {[
            { labelZh: "首页", labelEn: "Home", href: "/", active: true },
            { labelZh: "发现", labelEn: "Discover", href: "/discover", active: false },
          ].map(tab => (
            <Link
              key={tab.href}
              href={tab.href}
              style={{
                padding: "11px 20px",
                fontSize: 14,
                fontWeight: tab.active ? 700 : 500,
                color: tab.active ? "#1e3a8a" : "#64748b",
                textDecoration: "none",
                borderBottom: tab.active ? "2px solid #1e3a8a" : "2px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {lang === "zh" ? tab.labelZh : tab.labelEn}
            </Link>
          ))}
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

      {/* Hero */}
      <section style={{ background: "#fff", padding: isMobile ? "36px 12px 36px" : "88px 24px 72px" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", flexDirection: isMobile ? "column" : "row", alignItems: "center", gap: isMobile ? 24 : 48,
        }}>

          {/* Left: copy */}
          <div style={{ flex: "0 0 52%", minWidth: 0 }}>

            {/* Badge */}
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 14px",
              background: "#eff6ff",
              borderRadius: 999,
              marginBottom: 28,
            }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
                {t(`${getCurrentSeasonLabel()} NBA赛季 · 数据实时更新`, `${getCurrentSeasonLabel()} NBA Season · Live Data`)}
              </span>
            </div>

            {/* Heading */}
            <h1 style={{ margin: 0, lineHeight: 1.12 }}>
              <div style={{ fontSize: isMobile ? 36 : 58, fontWeight: 800, color: "#0f172a", letterSpacing: isMobile ? "-1px" : "-2px" }}>
                {t("用数据赢得", "Win Your Draft")}
              </div>
              <div style={{ fontSize: isMobile ? 36 : 58, fontWeight: 800, color: "#2563eb", letterSpacing: isMobile ? "-1px" : "-2px", fontStyle: "italic" }}>
                {t("每一场选秀", "With Data")}
              </div>
            </h1>

            {/* Description */}
            <p style={{ margin: "22px 0 36px", fontSize: 16, lineHeight: 1.75, color: "#64748b", maxWidth: 430 }}>
              {t(
                "中国首个专业范特西篮球决策平台。AI排名、实时数据、深度分析，让你每一轮都不踩雷。",
                "China's first professional fantasy basketball platform. AI rankings, live data, deep analysis — so you nail every pick."
              )}
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link
                href="/auth/signup"
                onMouseEnter={() => setCta1Hovered(true)}
                onMouseLeave={() => setCta1Hovered(false)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "14px 30px",
                  background: cta1Hovered ? "#1e40af" : "#1e3a8a",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 700,
                  textDecoration: "none",
                  transition: "background 0.15s",
                  boxShadow: "0 4px 16px rgba(30,58,138,0.25)",
                }}
              >
                {t("免费开始", "Get Started")} →
              </Link>
              <Link
                href="/draft-guide"
                onMouseEnter={() => setCta2Hovered(true)}
                onMouseLeave={() => setCta2Hovered(false)}
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "14px 30px",
                  border: `2px solid ${cta2Hovered ? "#cbd5e1" : "#e2e8f0"}`,
                  color: "#374151",
                  borderRadius: 10,
                  fontSize: 16,
                  fontWeight: 600,
                  textDecoration: "none",
                  background: cta2Hovered ? "#f8fafc" : "#fff",
                  transition: "all 0.15s",
                }}
              >
                {t("查看Fantasy新闻", "Fantasy News")}
              </Link>
            </div>
          </div>

          {/* Right: floating player cards */}
          {!isMobile && (
            <div style={{ flex: 1, position: "relative", height: 400, minWidth: 0, width: "100%", overflow: "hidden" }}>

            {/* Giannis card — dark navy */}
            <div style={{
              position: "absolute",
              top: isMobile ? 18 : 10, right: isMobile ? 4 : 30,
              width: isMobile ? 130 : 190, height: isMobile ? 176 : 255,
              background: "linear-gradient(145deg, #1e3a8a 0%, #1e40af 100%)",
              borderRadius: 20,
              transform: "rotate(7deg)",
              boxShadow: "0 24px 60px rgba(30,58,138,0.28)",
              padding: isMobile ? "12px 12px 14px" : "20px 20px 24px",
              color: "#fff",
              zIndex: 1,
              overflow: "hidden",
            }}>
              <div style={{ fontSize: isMobile ? 46 : 72, fontWeight: 900, color: "rgba(255,255,255,0.12)", position: "absolute", top: -8, right: 8, lineHeight: 1, userSelect: "none" }}>34</div>
              <div style={{ position: "absolute", bottom: isMobile ? 12 : 24, left: isMobile ? 12 : 20 }}>
                <div style={{ fontSize: isMobile ? 10 : 13, fontWeight: 700, marginBottom: 2 }}>G. Antetokounmpo</div>
                <div style={{ fontSize: isMobile ? 9 : 11, color: "rgba(255,255,255,0.55)" }}>MIL · 雄鹿</div>
              </div>
            </div>

            {/* Curry card — amber */}
            <div style={{
              position: "absolute",
              bottom: isMobile ? 16 : 20, left: isMobile ? 2 : 10,
              width: isMobile ? 126 : 185, height: isMobile ? 164 : 240,
              background: "linear-gradient(145deg, #d97706 0%, #f59e0b 100%)",
              borderRadius: 20,
              transform: "rotate(-7deg)",
              boxShadow: "0 20px 56px rgba(245,158,11,0.32)",
              padding: isMobile ? "10px 10px 12px" : "18px 18px 22px",
              zIndex: 1,
              overflow: "hidden",
            }}>
              <div style={{
                display: "inline-block", padding: "3px 9px",
                background: "rgba(255,255,255,0.28)",
                borderRadius: 6, fontSize: isMobile ? 9 : 11, fontWeight: 700, color: "#fff", marginBottom: isMobile ? 6 : 10,
              }}>PG</div>
              <div style={{ fontSize: isMobile ? 12 : 16, fontWeight: 700, color: "#fff", marginBottom: 2 }}>S. Curry</div>
              <div style={{ fontSize: isMobile ? 9 : 12, color: "rgba(255,255,255,0.65)", marginBottom: isMobile ? 10 : 22 }}>GSW · 勇士</div>
              <div style={{ display: "flex", gap: isMobile ? 8 : 16 }}>
                {[["26.4", "分"], ["4.5", "篮"], ["6.1", "助"]].map(([val, label]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: isMobile ? 12 : 17, fontWeight: 800, color: "#fff" }}>{val}</div>
                    <div style={{ fontSize: isMobile ? 8 : 10, color: "rgba(255,255,255,0.65)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* LeBron card — white, front */}
            <div style={{
              position: "absolute",
              top: isMobile ? 24 : 50, left: isMobile ? 60 : 100,
              width: isMobile ? 168 : 235, height: isMobile ? 220 : 305,
              background: "#fff",
              borderRadius: 22,
              boxShadow: "0 28px 80px rgba(0,0,0,0.14), 0 4px 16px rgba(0,0,0,0.06)",
              padding: isMobile ? "14px 14px" : "22px 24px",
              zIndex: 3,
              overflow: "hidden",
            }}>
              <div style={{
                display: "inline-block", padding: "4px 10px",
                background: "#eff6ff",
                borderRadius: 6, fontSize: isMobile ? 9 : 11, fontWeight: 700, color: "#2563eb", marginBottom: isMobile ? 8 : 14,
              }}>SF</div>
              <div style={{ fontSize: isMobile ? 54 : 80, fontWeight: 900, color: "#f1f5f9", position: "absolute", top: -4, right: 10, lineHeight: 1, userSelect: "none" }}>23</div>
              <div style={{ fontSize: isMobile ? 14 : 19, fontWeight: 700, color: "#0f172a", marginBottom: 3 }}>LeBron James</div>
              <div style={{ fontSize: isMobile ? 10 : 13, color: "#94a3b8", marginBottom: isMobile ? 10 : 22 }}>LAL · 湖人</div>
              <div style={{ height: 1, background: "#f1f5f9", marginBottom: isMobile ? 10 : 18 }} />
              <div style={{ display: "flex", gap: 0 }}>
                {[["25.2", "分"], ["7.3", "篮"], ["8.1", "助"]].map(([val, label], i) => (
                  <div key={label} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #f1f5f9" : "none", paddingBottom: 4 }}>
                    <div style={{ fontSize: isMobile ? 15 : 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>{val}</div>
                    <div style={{ fontSize: isMobile ? 9 : 11, color: "#94a3b8", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Amber dot accent */}
            <div style={{
              position: "absolute",
              bottom: isMobile ? 24 : 45, right: isMobile ? 4 : 18,
              width: isMobile ? 32 : 48, height: isMobile ? 32 : 48,
              background: "#f59e0b",
              borderRadius: "50%",
              boxShadow: "0 4px 20px rgba(245,158,11,0.35)",
              zIndex: 4,
            }} />
            </div>
          )}
        </div>
      </section>

      {/* Stats bar */}
      <section style={{ borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", background: "#fff" }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          padding: isMobile ? "24px 12px" : "36px 24px",
          display: "flex", flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: 0,
        }}>
          {STATS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div>
                <div style={{ fontSize: isMobile ? 30 : 38, fontWeight: 800, color: s.color, letterSpacing: "-1.5px", lineHeight: 1 }}>{s.num}</div>
                <div style={{ fontSize: 14, color: "#64748b", marginTop: 5, fontWeight: 500 }}>{lang === "zh" ? s.labelZh : s.labelEn}</div>
              </div>
              {i < STATS.length - 1 && (
                <div style={{ width: isMobile ? "100%" : 1, height: isMobile ? 1 : 44, background: "#e2e8f0", margin: isMobile ? "14px 0" : "0 48px", flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      </section>

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

      {/* Hot players section */}
      <section style={{ background: "#fff", padding: "64px 24px 80px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" }}>
              {t("本周热门球员", "Hot Players This Week")}
            </h2>
            <Link href="/rankings" style={{ fontSize: 14, fontWeight: 600, color: "#2563eb", textDecoration: "none" }}>
              {t("查看全部排名", "View All Rankings")} →
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)", gap: 16 }}>
            {[
              { rank: 1, name: "N. Jokić", team: "DEN · C", score: 68.4, color: "#f59e0b" },
              { rank: 2, name: "L. Dončić", team: "DAL · PG", score: 64.2, color: "#64748b" },
              { rank: 3, name: "G. Antetokounmpo", team: "MIL · PF", score: 62.8, color: "#64748b" },
              { rank: 4, name: "S. Curry", team: "GSW · PG", score: 58.7, color: "#64748b" },
            ].map((p) => (
              <Link key={p.rank} href="/rankings" style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#f8fafc",
                  borderRadius: 14,
                  padding: "18px 20px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  border: "1px solid #e2e8f0",
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: p.color, minWidth: 28, textAlign: "center" }}>{p.rank}</div>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{p.team}</div>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{p.score}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
