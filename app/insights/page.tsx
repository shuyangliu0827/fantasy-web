"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { listInsights, getSessionUser, isInsightLiked, type Insight } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const ALL_TAGS = ["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"];

export default function InsightsPage() {
  const { t, lang } = useLang();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [user, setUser] = useState<{ name: string; username: string } | null>(null);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser({ name: u.name, username: u.username });
    loadInsights();
  }, []);

  async function loadInsights() {
    setLoading(true);
    const data = await listInsights();
    setInsights(data);
    setLoading(false);
  }

  const filtered = activeTag
    ? insights.filter((p) => p.tags?.includes(activeTag))
    : insights;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 86400000);
    if (diff === 0) return t("今天", "Today");
    if (diff === 1) return t("昨天", "Yesterday");
    if (diff < 7) return `${diff}${t("天前", "d ago")}`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
      <Header />

      {/* Hero bar */}
      <div style={{
        background: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "40px 24px 32px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", background: "#eff6ff", borderRadius: 999, marginBottom: 14 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#2563eb", flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb" }}>
                {t("社区精选", "Community")}
              </span>
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.5px" }}>
              {t("球探报告", "Scout Reports")}
            </h1>
            <p style={{ fontSize: 15, color: "#64748b", margin: "8px 0 0" }}>
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
              ✏️ {t("发布笔记", "New Post")}
            </Link>
          )}
        </div>
      </div>

      {/* Tag filter */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", gap: 8, overflowX: "auto", paddingTop: 12, paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTag(null)}
            style={{
              padding: "6px 16px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              border: `1.5px solid ${activeTag === null ? "#1e3a8a" : "#e2e8f0"}`,
              background: activeTag === null ? "#1e3a8a" : "#fff",
              color: activeTag === null ? "#fff" : "#64748b",
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {t("全部", "All")}
          </button>
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              style={{
                padding: "6px 16px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 600,
                border: `1.5px solid ${activeTag === tag ? "#1e3a8a" : "#e2e8f0"}`,
                background: activeTag === tag ? "#1e3a8a" : "#fff",
                color: activeTag === tag ? "#fff" : "#64748b",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              #{tag}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px 64px" }}>
        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} style={{
                background: "#fff",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid #e2e8f0",
              }}>
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
            <div style={{ fontSize: 56, marginBottom: 16 }}>📝</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>
              {t("暂无笔记", "No posts yet")}
            </h2>
            <p style={{ fontSize: 15, color: "#64748b", margin: "0 0 24px" }}>
              {user
                ? t("成为第一个分享见解的人！", "Be the first to share an insight!")
                : t("登录后发布你的第一篇笔记", "Login to post your first note")}
            </p>
            {user ? (
              <Link
                href="/insights/new"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "12px 28px",
                  background: "#1e3a8a",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                ✏️ {t("发布笔记", "Write a Post")}
              </Link>
            ) : (
              <Link
                href="/auth/login"
                style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "12px 28px",
                  background: "#1e3a8a",
                  color: "#fff",
                  borderRadius: 10,
                  fontSize: 15,
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {t("去登录", "Login")}
              </Link>
            )}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 20,
          }}>
            {filtered.map((insight) => (
              <InsightCard key={insight.id} insight={insight} formatDate={formatDate} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  insight,
  formatDate,
}: {
  insight: Insight;
  formatDate: (d: string) => string;
}) {
  const [hovered, setHovered] = useState(false);
  const authorName = insight.author?.username || insight.author?.name || "Anonymous";
  const coverUrl = insight.cover_url || (insight.images?.[0] ?? null);

  return (
    <Link
      href={`/insights/${insight.id}`}
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
            <img
              src={coverUrl}
              alt={insight.title}
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 48, opacity: 0.4,
            }}>
              🏀
            </div>
          )}

          {/* Tags overlay */}
          {insight.tags && insight.tags.length > 0 && (
            <div style={{
              position: "absolute", bottom: 10, left: 10,
              display: "flex", gap: 6, flexWrap: "wrap",
            }}>
              {insight.tags.slice(0, 2).map((tag) => (
                <span key={tag} style={{
                  padding: "3px 10px",
                  background: "rgba(255,255,255,0.92)",
                  borderRadius: 999,
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#1e3a8a",
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: "14px 16px 16px" }}>
          <h3 style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#0f172a",
            margin: "0 0 10px",
            lineHeight: 1.45,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {insight.title}
          </h3>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Author */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 28, height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {authorName[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{authorName}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(insight.created_at)}</div>
              </div>
            </div>

            {/* Heat */}
            <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#94a3b8" }}>
              <span>❤️</span>
              <span style={{ fontWeight: 600 }}>{insight.heat || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
