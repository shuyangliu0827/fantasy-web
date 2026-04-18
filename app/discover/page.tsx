"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { listInsights, getSessionUser, searchInsights, searchUsers, type Insight, type User } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const NAV_ITEMS = [
  { href: "/", labelZh: "首页", labelEn: "Home" },
  { href: "/discover", labelZh: "发现", labelEn: "Discover" },
  { href: "/league", labelZh: "公开联赛", labelEn: "Leagues" },
  { href: "/contest", labelZh: "每日竞赛", labelEn: "Daily Fantasy" },
];

const ALL_TAGS = ["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"];

export default function DiscoverPage() {
  const { t, lang, setLang } = useLang();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; username: string } | null>(() => {
    const u = getSessionUser();
    return u ? { name: u.name, username: u.username } : null;
  });
  const [loginHovered, setLoginHovered] = useState(false);
  const [signupHovered, setSignupHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" ? window.innerWidth < 480 : false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResultPosts, setSearchResultPosts] = useState<Insight[]>([]);
  const [searchResultUsers, setSearchResultUsers] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSearchActive = searchTerm.trim().length > 0;

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResultPosts([]);
      setSearchResultUsers([]);
      return;
    }
    setSearching(true);
    const [posts, users] = await Promise.all([searchInsights(query.trim()), searchUsers(query.trim())]);
    setSearchResultPosts(posts);
    setSearchResultUsers(users);
    setSearching(false);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => runSearch(value), 300);
  };

  useEffect(() => {
    listInsights().then((data) => {
      setInsights(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsNarrow(window.innerWidth < 480);
      if (!mobile) setMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const filtered = activeTag
    ? insights.filter((p) => p.tags?.includes(activeTag))
    : insights;

  const formatDate = (dateStr: string) => {
    // Supabase returns `timestamp` columns without timezone suffix — treat as UTC
    const normalized = dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff <= 0) return t("刚刚", "just now");
    if (diff === 1) return t("昨天", "Yesterday");
    if (diff < 7) return `${diff}${t("天前", "d ago")}`;
    return date.toLocaleDateString();
  };

  const handleLogout = () => {
    localStorage.removeItem("bp_session");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>

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
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
          </Link>

          {/* Desktop nav */}
          {!isMobile && (
            <nav style={{ display: "flex", gap: 2, flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
              {NAV_ITEMS.map(item => {
                const isActive = item.href === "/discover";
                return (
                  <Link key={item.href} href={item.href} style={{
                    padding: "7px 13px", borderRadius: 8, fontSize: 14,
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? "#0f172a" : "#64748b",
                    background: isActive ? "#f1f5f9" : "transparent",
                    textDecoration: "none", whiteSpace: "nowrap", transition: "all 0.15s",
                  }}>
                    {lang === "zh" ? item.labelZh : item.labelEn}
                  </Link>
                );
              })}
            </nav>
          )}

          {isMobile && <div style={{ flex: 1 }} />}

          {/* Desktop right actions */}
          {!isMobile && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
                style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                中文 / EN
              </button>
              {!user ? (
                <>
                  <Link href="/auth/login" onMouseEnter={() => setLoginHovered(true)} onMouseLeave={() => setLoginHovered(false)}
                    style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#374151", textDecoration: "none", background: loginHovered ? "#f8fafc" : "#fff", transition: "background 0.15s" }}>
                    {t("登录", "Login")}
                  </Link>
                  <Link href="/auth/signup" onMouseEnter={() => setSignupHovered(true)} onMouseLeave={() => setSignupHovered(false)}
                    style={{ padding: "8px 20px", background: signupHovered ? "#1e40af" : "#1e3a8a", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none", transition: "background 0.15s" }}>
                    {t("注册", "Sign Up")}
                  </Link>
                </>
              ) : (
                <>
                  <Link href={`/u/${user.username}`} style={{ fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500, padding: "8px 4px" }}>{user.name || user.username}</Link>
                  <button onClick={handleLogout} style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>
                    {t("退出", "Logout")}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          {isMobile && (
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? "Close menu" : "Open menu"}
              style={{ width: 44, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}>
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none", transition: "transform 0.2s ease" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, opacity: menuOpen ? 0 : 1, transition: "opacity 0.2s ease" }} />
              <span style={{ display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2, transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none", transition: "transform 0.2s ease" }} />
            </button>
          )}
        </div>

        {/* Mobile drawer */}
        {isMobile && menuOpen && (
          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", borderBottom: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", zIndex: 99, maxHeight: "calc(100vh - 60px)", overflowY: "auto" }}>
            {NAV_ITEMS.map(item => {
              const isActive = item.href === "/discover";
              return (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "14px 20px", fontSize: 15, fontWeight: isActive ? 700 : 500, color: isActive ? "#1e3a8a" : "#374151", textDecoration: "none", borderLeft: isActive ? "3px solid #1e3a8a" : "3px solid transparent", background: isActive ? "#f8fafc" : "transparent" }}>
                  {lang === "zh" ? item.labelZh : item.labelEn}
                </Link>
              );
            })}
            <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
            <div style={{ padding: "12px 16px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} style={{ padding: "6px 14px", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
                中文 / EN
              </button>
              {!user ? (
                <>
                  <Link href="/auth/login" onClick={() => setMenuOpen(false)} style={{ padding: "8px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#374151", textDecoration: "none", background: "#fff" }}>{t("登录", "Login")}</Link>
                  <Link href="/auth/signup" onClick={() => setMenuOpen(false)} style={{ padding: "8px 16px", background: "#1e3a8a", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none" }}>{t("注册", "Sign Up")}</Link>
                </>
              ) : (
                <>
                  <Link href={`/u/${user.username}`} onClick={() => setMenuOpen(false)} style={{ padding: "8px 4px", fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500 }}>{user.name || user.username}</Link>
                  <button onClick={() => { handleLogout(); setMenuOpen(false); }} style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>{t("退出", "Logout")}</button>
                </>
              )}
            </div>
          </div>
        )}

      </header>

      {/* Hero bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: isMobile ? "24px 12px 20px" : "40px 24px 32px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "#eff6ff", borderRadius: 999, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                {t("社区精选", "Community")}
              </span>
            </div>
            <h1 style={{ fontSize: isMobile ? 28 : 34, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" }}>
              {t("发现", "Discover")}
            </h1>
            <p style={{ fontSize: isMobile ? 14 : 15, color: "#64748b", margin: "8px 0 0" }}>
              {t("分享你的范特西篮球洞察，帮助所有玩家做出更好的决策", "Share your fantasy basketball insights to help everyone make better decisions")}
            </p>
          </div>

          {user && (
            <Link
              href="/insights/new"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "12px 24px",
                background: "#1e3a8a",
                color: "#fff",
                borderRadius: 10,
                fontSize: 15,
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              + {t("发布笔记", "New Post")}
            </Link>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "14px 12px" : "16px 24px" }}>
          <div style={{ position: "relative", maxWidth: 560 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              width: 18, height: 18, pointerEvents: "none",
            }}>
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchTerm}
              onChange={e => handleSearchChange(e.target.value)}
              placeholder={t("搜索帖子或用户…", "Search posts or users…")}
              style={{
                width: "100%", padding: "11px 14px 11px 42px",
                border: "1.5px solid #e2e8f0", borderRadius: 12,
                fontSize: 15, outline: "none", background: "#f8fafc",
                transition: "border-color 0.15s, background 0.15s",
                boxSizing: "border-box",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "#1e3a8a"; e.currentTarget.style.background = "#fff"; }}
              onBlur={e => { e.currentTarget.style.borderColor = "#e2e8f0"; e.currentTarget.style.background = "#f8fafc"; }}
            />
            {searchTerm && (
              <button
                onClick={() => { setSearchTerm(""); setSearchResultPosts([]); setSearchResultUsers([]); }}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "#e2e8f0", border: "none", borderRadius: "50%",
                  width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 13, color: "#64748b", lineHeight: 1,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tag filter */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "12px" : "12px 24px", display: "flex", gap: 8, overflowX: "auto" }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{
              padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
              border: `1.5px solid ${activeTag === null ? "#1e3a8a" : "#e2e8f0"}`,
              background: activeTag === null ? "#1e3a8a" : "#fff",
              color: activeTag === null ? "#fff" : "#64748b",
              cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
            }}
          >
            {t("全部", "All")}
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: "6px 16px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                border: `1.5px solid ${activeTag === tag ? "#1e3a8a" : "#e2e8f0"}`,
                background: activeTag === tag ? "#1e3a8a" : "#fff",
                color: activeTag === tag ? "#fff" : "#64748b",
                cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "20px 12px 36px" : "32px 24px 64px" }}>
        {isSearchActive ? (
          /* Search results */
          <div>
            {searching ? (
              <div style={{ textAlign: "center", padding: "60px 24px", color: "#64748b", fontSize: 15 }}>
                {t("搜索中…", "Searching…")}
              </div>
            ) : (
              <>
                {/* User results */}
                {searchResultUsers.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>
                      {t("用户", "Users")} <span style={{ fontWeight: 500, color: "#94a3b8", fontSize: 14 }}>({searchResultUsers.length})</span>
                    </h3>
                    <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 4 }}>
                      {searchResultUsers.map(u => (
                        <Link key={u.id} href={`/u/${u.username}`} style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "10px 16px",
                          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
                          textDecoration: "none", minWidth: 180, flexShrink: 0,
                          transition: "border-color 0.15s, box-shadow 0.15s",
                        }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%",
                            background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                            color: "#fff", fontSize: 14, fontWeight: 700,
                            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                          }}>
                            {(u.name || u.username)[0]?.toUpperCase()}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {u.name}
                            </div>
                            <div style={{ fontSize: 12, color: "#94a3b8" }}>@{u.username}</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Post results */}
                {searchResultPosts.length > 0 && (
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>
                      {t("帖子", "Posts")} <span style={{ fontWeight: 500, color: "#94a3b8", fontSize: 14 }}>({searchResultPosts.length})</span>
                    </h3>
                    <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 12 : 20 }}>
                      {searchResultPosts.map(insight => (
                        <InsightCard key={insight.id} insight={insight} formatDate={formatDate} />
                      ))}
                    </div>
                  </div>
                )}

                {searchResultPosts.length === 0 && searchResultUsers.length === 0 && (
                  <div style={{ textAlign: "center", padding: "60px 24px" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 6px" }}>
                      {t("没有找到结果", "No results found")}
                    </h3>
                    <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
                      {t("试试其他关键词", "Try a different keyword")}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        ) : loading ? (
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #e2e8f0" }}>
                <div style={{ aspectRatio: "4/3", background: "#f1f5f9" }} />
                <div style={{ padding: 16 }}>
                  <div style={{ height: 16, background: "#f1f5f9", borderRadius: 4, marginBottom: 10, width: "80%" }} />
                  <div style={{ height: 12, background: "#f1f5f9", borderRadius: 4, width: "50%" }} />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 24px" }}>
            <div style={{ width: 64, height: 64, background: "#f1f5f9", borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 32, height: 4, background: "#cbd5e1", borderRadius: 2 }} />
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              {t("暂无内容", "No posts yet")}
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 24px" }}>
              {user
                ? t("成为第一个分享见解的人！", "Be the first to share an insight!")
                : t("登录后发布你的第一篇笔记", "Login to post your first note")}
            </p>
            {user ? (
              <Link href="/insights/new" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", background: "#1e3a8a", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                + {t("发布笔记", "Write a Post")}
              </Link>
            ) : (
              <Link href="/auth/login" style={{ display: "inline-flex", alignItems: "center", padding: "12px 28px", background: "#1e3a8a", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none" }}>
                {t("去登录", "Login")}
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isNarrow ? "1fr" : isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 12 : 20 }}>
            {filtered.map((insight) => (
              <InsightCard key={insight.id} insight={insight} formatDate={formatDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({ insight, formatDate }: { insight: Insight; formatDate: (d: string) => string }) {
  const [hovered, setHovered] = useState(false);
  const authorName = insight.author?.name || insight.author?.username || "Anonymous";
  const authorAvatar = insight.author?.avatar_url;
  const coverUrl = insight.cover_url || (insight.images?.[0] ?? null);

  return (
    <Link
      href={`/discover/${insight.id}`}
      style={{ textDecoration: "none" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: "#fff",
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${hovered ? "#bfdbfe" : "#e2e8f0"}`,
        boxShadow: hovered ? "0 8px 28px rgba(30,58,138,0.10)" : "0 2px 8px rgba(0,0,0,0.05)",
        transition: "all 0.2s ease",
        transform: hovered ? "translateY(-3px)" : "none",
        cursor: "pointer",
      }}>
        {/* Cover image */}
        <div style={{
          aspectRatio: "4/3",
          background: coverUrl ? "#f1f5f9" : "linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)",
          overflow: "hidden",
          position: "relative",
        }}>
          {coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={coverUrl} alt={insight.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ width: 48, height: 48, background: "#dbeafe", borderRadius: 12 }} />
            </div>
          )}

          {/* Tags overlay */}
          {insight.tags && insight.tags.length > 0 && (
            <div style={{ position: "absolute", bottom: 10, left: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {insight.tags.slice(0, 2).map((tag) => (
                <span key={tag} style={{ padding: "3px 10px", background: "rgba(255,255,255,0.92)", borderRadius: 999, fontSize: 11, fontWeight: 600, color: "#1e3a8a" }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px 16px" }}>
          <h3 style={{
            fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 10px", lineHeight: 1.45,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {insight.title}
          </h3>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {authorAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={authorAvatar} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
              ) : (
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                  color: "#fff", fontSize: 12, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}>
                  {authorName[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{authorName}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(insight.created_at)}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#94a3b8" }}>
              <div style={{ width: 14, height: 14, background: "#fecaca", borderRadius: "50%", flexShrink: 0 }} />
              <span style={{ fontWeight: 600 }}>{insight.heat || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
