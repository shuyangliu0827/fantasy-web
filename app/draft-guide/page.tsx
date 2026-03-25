"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { listInsights, getSessionUser, type Insight } from "@/lib/store";
import LightHeader from "@/components/LightHeader";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const TAGS = ["球员分析", "交易建议", "选秀策略", "伤病报告", "赛季预测"];

const PAGE_SIZE = 10;

function formatTimeAgo(dateStr: string, lang: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return lang === "zh" ? "刚刚" : "just now";
  if (mins < 60) return `${mins}${lang === "zh" ? "分钟前" : "m"}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${lang === "zh" ? "小时前" : "h"}`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}${lang === "zh" ? "天前" : "d"}`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}${lang === "zh" ? "周前" : "w"}`;
  const months = Math.floor(days / 30);
  return `${months}${lang === "zh" ? "个月前" : "mo"}`;
}

function getExcerpt(body: string, maxLen = 120): string {
  const plain = body.replace(/[#*_~`>\[\]()!]/g, "").replace(/\n+/g, " ").trim();
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen).trimEnd() + "…";
}

export default function FantasyNewsPage() {
  const { t, lang } = useLang();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setUser(getSessionUser());
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    listInsights().then((data) => {
      setInsights(data);
      setLoading(false);
    });
  }, []);

  // Filter by tag
  const filtered = activeTag
    ? insights.filter((ins) => ins.tags?.includes(activeTag))
    : insights;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset page when tag changes
  useEffect(() => { setPage(1); }, [activeTag]);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/draft-guide" />

      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%)",
        padding: isMobile ? "36px 16px" : "48px 32px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ fontSize: isMobile ? 28 : 36, fontWeight: 800, color: "#fff", margin: "0 0 8px 0" }}>
              Fantasy {t("新闻", "News")}
            </h1>
            <p style={{ fontSize: 15, color: "#94a3b8", margin: 0 }}>
              {t("权威专家分析，助你制胜Fantasy联赛", "Expert analysis to help you win your Fantasy league")}
            </p>
          </div>
          {user && (
            <Link href="/discover/new" style={{
              padding: "10px 22px",
              background: "#f59e0b",
              color: "#000",
              fontSize: 14,
              fontWeight: 700,
              borderRadius: 8,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              {t("发布新闻", "Post News")}
            </Link>
          )}
        </div>
      </div>

      {/* Tag filter */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 12px 0" : "20px 32px 0" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{
              padding: "6px 16px",
              borderRadius: 20,
              border: "1px solid",
              borderColor: !activeTag ? "#1e3a8a" : "#d1d5db",
              background: !activeTag ? "#1e3a8a" : "#fff",
              color: !activeTag ? "#fff" : "#374151",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {t("全部", "All")}
          </button>
          {TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                border: "1px solid",
                borderColor: activeTag === tag ? "#1e3a8a" : "#d1d5db",
                background: activeTag === tag ? "#1e3a8a" : "#fff",
                color: activeTag === tag ? "#fff" : "#374151",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Article list */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "16px 12px 40px" : "24px 32px 60px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
            <div style={{
              width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#1e3a8a",
              borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
            }} />
            {t("加载中…", "Loading…")}
            <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          </div>
        ) : paged.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📰</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t("暂无新闻", "No news yet")}</div>
            <div style={{ fontSize: 14, marginTop: 8 }}>
              {t("成为第一个发布新闻的人！", "Be the first to post news!")}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {paged.map((insight) => (
              <ArticleCard key={insight.id} insight={insight} lang={lang} isMobile={isMobile} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 32 }}>
            <button
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db",
                background: "#fff", color: safePage <= 1 ? "#d1d5db" : "#374151",
                fontSize: 14, fontWeight: 600, cursor: safePage <= 1 ? "default" : "pointer",
              }}
            >
              {t("上一页", "Prev")}
            </button>
            <span style={{ fontSize: 14, color: "#6b7280", padding: "0 8px" }}>
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              style={{
                padding: "8px 16px", borderRadius: 8, border: "1px solid #d1d5db",
                background: "#fff", color: safePage >= totalPages ? "#d1d5db" : "#374151",
                fontSize: 14, fontWeight: 600, cursor: safePage >= totalPages ? "default" : "pointer",
              }}
            >
              {t("下一页", "Next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ArticleCard({ insight, lang, isMobile }: { insight: Insight; lang: string; isMobile: boolean }) {
  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const authorName = insight.author?.name || insight.author?.username || t("匿名", "Anonymous");
  const coverUrl = insight.cover_url || (insight.images && insight.images.length > 0 ? insight.images[0] : null);
  const excerpt = getExcerpt(insight.body);
  const timeAgo = formatTimeAgo(insight.created_at, lang);
  const firstTag = insight.tags?.[0];

  return (
    <Link
      href={`/discover/${insight.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        transition: "box-shadow 0.15s",
        cursor: "pointer",
      }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
      >
        {/* Cover image */}
        {coverUrl && (
          <div style={{
            width: isMobile ? "100%" : 220,
            height: isMobile ? 180 : 150,
            flexShrink: 0,
            background: "#f1f5f9",
            overflow: "hidden",
          }}>
            <img
              src={coverUrl}
              alt=""
              loading="lazy"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        )}

        {/* Content */}
        <div style={{
          flex: 1,
          padding: isMobile ? "14px 16px" : "16px 20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          minWidth: 0,
        }}>
          {/* Tag */}
          {firstTag && (
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1e3a8a",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: 6,
            }}>
              {firstTag}
            </div>
          )}

          {/* Title */}
          <div style={{
            fontSize: isMobile ? 16 : 18,
            fontWeight: 700,
            color: "#111827",
            lineHeight: 1.3,
            marginBottom: 6,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {insight.title}
          </div>

          {/* Excerpt */}
          <div style={{
            fontSize: 14,
            color: "#6b7280",
            lineHeight: 1.5,
            marginBottom: 10,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {excerpt}
          </div>

          {/* Meta row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#9ca3af" }}>
            {/* Author avatar */}
            {insight.author?.avatar_url ? (
              <img
                src={insight.author.avatar_url}
                alt=""
                style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
              />
            ) : (
              <span style={{
                width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                background: "#1e3a8a", color: "#fff", fontSize: 10, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
              }}>
                {authorName[0]?.toUpperCase()}
              </span>
            )}
            <span style={{ fontWeight: 500, color: "#374151" }}>{authorName}</span>
            <span>·</span>
            <span>{timeAgo}</span>
            <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {insight.heat || 0}
              </span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
