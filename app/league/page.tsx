"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { listLeagues, getLeagueMemberCount, getSessionUser, supabase } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeagueWithCount = { memberCount: number } & Record<string, any>;
type Tab = "all" | "active" | "pending" | "mine";

const STATUS_LABEL: Record<string, string> = {
  draft_pending: "即将开始",
  drafting: "选秀中",
  active: "进行中",
};
const STATUS_COLOR: Record<string, { color: string; bg: string }> = {
  draft_pending: { color: "#92400e", bg: "#fef3c7" },
  drafting:      { color: "#065f46", bg: "#d1fae5" },
  active:        { color: "#1e40af", bg: "#dbeafe" },
};

export default function PublicLeaguesPage() {
  const { t } = useLang();
  const [leagues, setLeagues]         = useState<LeagueWithCount[]>([]);
  const [myLeagueIds, setMyLeagueIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]         = useState(true);
  const [searchTerm, setSearchTerm]   = useState("");
  const [activeTab, setActiveTab]     = useState<Tab>("all");
  const user = getSessionUser();

  useEffect(() => { load(); }, []);

  async function load() {
    const data = await listLeagues();
    const publicLeagues = data.filter(l => l.visibility === "public");
    const withCounts = await Promise.all(
      publicLeagues.map(async l => ({ ...l, memberCount: await getLeagueMemberCount(l.id) }))
    );
    setLeagues(withCounts);

    if (user) {
      const { data: memberRows } = await supabase
        .from("league_members")
        .select("league_id")
        .eq("user_id", user.id);
      const ids = new Set<string>([
        ...(memberRows || []).map((r: any) => r.league_id),
        ...publicLeagues.filter(l => l.commissioner_id === user.id).map(l => l.id),
      ]);
      setMyLeagueIds(ids);
    }
    setLoading(false);
  }

  const filtered = leagues.filter(l => {
    const matchSearch = l.name.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchSearch) return false;
    if (activeTab === "active")  return l.status === "active";
    if (activeTab === "pending") return l.status === "draft_pending" || l.status === "drafting";
    if (activeTab === "mine")    return myLeagueIds.has(l.id);
    return true;
  });

  const TABS: { key: Tab; label: string }[] = [
    { key: "all",     label: "全部联赛" },
    { key: "active",  label: "进行中" },
    { key: "pending", label: "即将开始" },
    { key: "mine",    label: "我的联赛" },
  ];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: FONT }}>
        <LightHeader activeHref="/league" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 12 }}>
          <div style={{ fontSize: 40 }}>🏀</div>
          <p style={{ color: "#9ca3af", fontSize: 15 }}>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />

      {/* ── Hero Banner ── */}
      <div className="league-hero">
        <div style={{
          position: "absolute", inset: 0, opacity: 0.07,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px)",
          pointerEvents: "none",
        }} />
        <div className="league-hero-inner">
          <h1 className="league-hero-title">
            加入公开联赛<br />与全国高手竞技
          </h1>
          <p style={{ margin: "0 0 28px", fontSize: 15, color: "rgba(255,255,255,0.78)", lineHeight: 1.7 }}>
            每周更新赛程，积分制排行，赛季末角逐总冠军荣誉。
          </p>
          <div className="league-hero-btns">
            <Link href="/league/new" style={{
              padding: "12px 24px", background: "#fff", color: "#1e3a8a",
              borderRadius: 10, fontSize: 14, fontWeight: 800, textDecoration: "none",
            }}>
              创建我的联赛
            </Link>
            <Link href="/guide" style={{
              padding: "12px 24px", background: "rgba(255,255,255,0.15)", color: "#fff",
              border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 10,
              fontSize: 14, fontWeight: 600, textDecoration: "none",
            }}>
              了解规则
            </Link>
          </div>
          <div className="league-hero-stats">
            {[
              { value: leagues.length,                             label: "活跃联赛" },
              { value: leagues.reduce((s, l) => s + l.memberCount, 0), label: "参与球迷" },
              { value: "S4",                                       label: "当前赛季" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 26, fontWeight: 900, color: "#fbbf24" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 60, zIndex: 10, overflowX: "auto" }}>
        <div className="league-tabs-inner">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "14px 16px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600, fontFamily: FONT, whiteSpace: "nowrap",
                color: activeTab === tab.key ? "#1e3a8a" : "#6b7280",
                borderBottom: activeTab === tab.key ? "2.5px solid #1e3a8a" : "2.5px solid transparent",
                flexShrink: 0,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="league-content">

        {/* search row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12 }}>
            <span style={{ fontSize: 14, color: "#9ca3af" }}>🔍</span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="搜索联赛名称..."
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#374151", background: "transparent", fontFamily: FONT }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#9ca3af", whiteSpace: "nowrap" }}>
            共 {filtered.length} 个
          </div>
        </div>

        {/* League cards */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "60px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{activeTab === "mine" ? "🏀" : "🔍"}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              {activeTab === "mine" ? "你还没有加入任何联赛" : searchTerm ? "没有找到匹配的联赛" : "暂无联赛"}
            </h3>
            <p style={{ color: "#9ca3af", margin: "0 0 24px", fontSize: 14 }}>
              {activeTab === "mine" ? "加入或创建一个联赛开始你的征程！" : "试试其他关键词"}
            </p>
            {activeTab === "mine" && (
              <Link href="/league/new" style={{ display: "inline-block", padding: "11px 28px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, textDecoration: "none" }}>
                创建联赛
              </Link>
            )}
          </div>
        ) : (
          <div className="league-grid">
            {filtered.map(league => {
              const sc   = STATUS_COLOR[league.status] ?? { color: "#374151", bg: "#f3f4f6" };
              const sl   = STATUS_LABEL[league.status] ?? league.status;
              const isFull = league.memberCount >= league.max_teams;
              const isMine = myLeagueIds.has(league.id);
              const pct  = Math.min(100, (league.memberCount / league.max_teams) * 100);

              return (
                <div
                  key={league.id}
                  className="league-card"
                  style={{ borderTop: `3px solid ${sc.color}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  {/* status badges */}
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ padding: "3px 9px", background: sc.bg, color: sc.color, borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {sl}
                    </span>
                    {isMine && (
                      <span style={{ marginLeft: 6, padding: "3px 9px", background: "#eff6ff", color: "#1e40af", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        已加入
                      </span>
                    )}
                  </div>

                  {/* name */}
                  <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 800, color: "#0f172a", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {league.name}
                  </h3>

                  {/* description */}
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "#64748b", lineHeight: 1.6, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {league.description || `${league.season} 赛季 · ${league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}`}
                  </p>

                  {/* team count */}
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 17, color: "#0f172a" }}>{league.max_teams}</span>
                    <span style={{ marginLeft: 4, color: "#9ca3af" }}>队位</span>
                  </div>

                  {/* progress bar */}
                  <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginBottom: 14, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isFull ? "#9ca3af" : "linear-gradient(90deg, #1e3a8a, #3b82f6)", borderRadius: 3 }} />
                  </div>

                  {/* bottom row */}
                  {(() => {
                    const isDraftCompleted = league.draft_completed_at || league.status === "active" || league.status === "completed";
                    const canJoin = !isMine && !isFull && !isDraftCompleted;
                    return (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>
                          {league.memberCount}/{league.max_teams} 已加入
                        </span>
                        {isMine ? (
                          <Link href={`/league/${league.slug}`} style={{ padding: "7px 14px", background: "#eff6ff", color: "#1e3a8a", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>进入联赛</Link>
                        ) : canJoin ? (
                          <Link href={`/league/${league.slug}`} style={{ padding: "7px 14px", background: "#1e3a8a", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>立即加入</Link>
                        ) : (
                          <Link href={`/league/${league.slug}`} style={{ padding: "7px 14px", background: "#f1f5f9", color: "#374151", borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>进入联赛</Link>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style jsx>{`
        /* ── Hero ── */
        .league-hero {
          background: linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%);
          padding: 52px 40px 44px;
          position: relative;
          overflow: hidden;
        }
        .league-hero-inner {
          max-width: 1100px;
          margin: 0 auto;
          position: relative;
        }
        .league-hero-title {
          margin: 0 0 12px;
          font-size: 40px;
          font-weight: 900;
          color: #fff;
          line-height: 1.15;
          letter-spacing: -0.5px;
        }
        .league-hero-btns {
          display: flex;
          gap: 12px;
          margin-bottom: 40px;
          flex-wrap: wrap;
        }
        .league-hero-stats {
          display: flex;
          gap: 36px;
          flex-wrap: wrap;
        }

        /* ── Tabs ── */
        .league-tabs-inner {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 40px;
          display: flex;
        }

        /* ── Content ── */
        .league-content {
          max-width: 1100px;
          margin: 0 auto;
          padding: 28px 40px 64px;
        }

        /* ── Cards grid ── */
        .league-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        .league-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          padding: 20px 20px 16px;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.2s;
        }

        /* ── Tablet (≤ 900px): 2 columns ── */
        @media (max-width: 900px) {
          .league-hero        { padding: 40px 24px 36px; }
          .league-hero-title  { font-size: 30px; }
          .league-hero-stats  { gap: 24px; }
          .league-tabs-inner  { padding: 0 16px; }
          .league-content     { padding: 20px 16px 48px; }
          .league-grid        { grid-template-columns: repeat(2, 1fr); gap: 14px; }
        }

        /* ── Mobile (≤ 600px): 1 column ── */
        @media (max-width: 600px) {
          .league-hero        { padding: 28px 16px 28px; }
          .league-hero-title  { font-size: 24px; }
          .league-hero-btns   { gap: 8px; margin-bottom: 28px; }
          .league-hero-stats  { gap: 20px; }
          .league-tabs-inner  { padding: 0 8px; }
          .league-content     { padding: 16px 12px 40px; }
          .league-grid        { grid-template-columns: 1fr; gap: 12px; }
          .league-card        { padding: 16px 16px 14px; }
        }
      `}</style>
    </div>
  );
}
