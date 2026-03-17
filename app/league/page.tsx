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
  const [leagues, setLeagues]       = useState<LeagueWithCount[]>([]);
  const [myLeagueIds, setMyLeagueIds] = useState<Set<string>>(new Set());
  const [loading, setLoading]       = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab]   = useState<Tab>("all");
  const [isMobile, setIsMobile] = useState(false);
  const user = getSessionUser();

  useEffect(() => {
    load();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function load() {
    // load all public leagues with member counts
    const data = await listLeagues();
    const publicLeagues = data.filter(l => l.visibility === "public");
    const withCounts = await Promise.all(
      publicLeagues.map(async l => ({ ...l, memberCount: await getLeagueMemberCount(l.id) }))
    );
    setLeagues(withCounts);

    // load user's leagues (member OR commissioner)
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
    return true; // "all"
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
      <div style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 55%, #2563eb 100%)",
        padding: isMobile ? "32px 16px 28px" : "56px 40px 48px",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* decorative grid pattern */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.07,
          backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px), repeating-linear-gradient(90deg, transparent, transparent 30px, rgba(255,255,255,0.5) 30px, rgba(255,255,255,0.5) 31px)",
          pointerEvents: "none",
        }} />
        <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative" }}>
          <h1 style={{ margin: "0 0 12px", fontSize: isMobile ? 30 : 42, fontWeight: 900, color: "#fff", lineHeight: 1.15, letterSpacing: "-0.5px" }}>
            加入公开联赛<br />与全国高手竞技
          </h1>
          <p style={{ margin: "0 0 32px", fontSize: 15, color: "rgba(255,255,255,0.78)", lineHeight: 1.7 }}>
            每周更新赛程，积分制排行，赛季末角逐总冠军荣誉。
          </p>
          <div style={{ display: "flex", gap: 12, marginBottom: 48, flexWrap: "wrap" }}>
            <Link href="/league/new" style={{
              padding: "13px 28px", background: "#fff", color: "#1e3a8a",
              borderRadius: 10, fontSize: 15, fontWeight: 800, textDecoration: "none",
            }}>
              创建我的联赛
            </Link>
            <Link href="/guide" style={{
              padding: "13px 28px", background: "rgba(255,255,255,0.15)", color: "#fff",
              border: "1.5px solid rgba(255,255,255,0.35)", borderRadius: 10,
              fontSize: 15, fontWeight: 600, textDecoration: "none",
            }}>
              了解规则
            </Link>
          </div>
          {/* stats row */}
          <div style={{ display: "flex", gap: 40, flexWrap: "wrap" }}>
            {[
              { value: leagues.length,                            label: "活跃联赛" },
              { value: leagues.reduce((s,l)=>s+l.memberCount,0), label: "参与球迷" },
              { value: "S4",                                      label: "当前赛季" },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: 28, fontWeight: 900, color: "#fbbf24" }}>{s.value}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: isMobile ? 60 : 64, zIndex: 10 }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "0 12px" : "0 40px", display: "flex", gap: 0, overflowX: "auto" }}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "16px 22px", background: "none", border: "none", cursor: "pointer",
                fontSize: 14, fontWeight: 600, fontFamily: FONT,
                color: activeTab === tab.key ? "#1e3a8a" : "#6b7280",
                borderBottom: activeTab === tab.key ? "2.5px solid #1e3a8a" : "2.5px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "20px 12px 36px" : "32px 40px 64px" }}>

        {/* search row */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ flex: 1, maxWidth: isMobile ? "100%" : 400, minWidth: isMobile ? "100%" : 0, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12 }}>
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
          <div style={{ fontSize: 13, color: "#9ca3af" }}>
            共 {filtered.length} 个联赛
          </div>
        </div>

        {/* League cards grid */}
        {filtered.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "72px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>{activeTab === "mine" ? "🏀" : "🔍"}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>
              {activeTab === "mine"
                ? "你还没有加入任何联赛"
                : searchTerm ? "没有找到匹配的联赛" : "暂无联赛"}
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
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 20 }}>
            {filtered.map(league => {
              const sc = STATUS_COLOR[league.status] ?? { color: "#374151", bg: "#f3f4f6" };
              const sl = STATUS_LABEL[league.status] ?? league.status;
              const isFull = league.memberCount >= league.max_teams;
              const isMine = myLeagueIds.has(league.id);
              const pct = Math.min(100, (league.memberCount / league.max_teams) * 100);

              return (
                <div
                  key={league.id}
                  style={{
                    background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16,
                    padding: "22px 22px 18px", display: "flex", flexDirection: "column",
                    transition: "box-shadow 0.2s, border-color 0.2s",
                    borderTop: `3px solid ${sc.color}`,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
                >
                  {/* status badge */}
                  <div style={{ marginBottom: 12 }}>
                    <span style={{ padding: "4px 10px", background: sc.bg, color: sc.color, borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                      {sl}
                    </span>
                    {isMine && (
                      <span style={{ marginLeft: 6, padding: "4px 10px", background: "#eff6ff", color: "#1e40af", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                        已加入
                      </span>
                    )}
                  </div>

                  {/* name */}
                  <h3 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 800, color: "#0f172a", lineHeight: 1.3, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {league.name}
                  </h3>

                  {/* description */}
                  <p style={{ margin: "0 0 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6, flex: 1, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                    {league.description || `${league.season} 赛季 · ${league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}`}
                  </p>

                  {/* team count */}
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 18, color: "#0f172a" }}>{league.max_teams}</span>
                    <span style={{ marginLeft: 4, color: "#9ca3af" }}>队位</span>
                  </div>

                  {/* progress bar */}
                  <div style={{ height: 5, background: "#f1f5f9", borderRadius: 3, marginBottom: 16, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: isFull ? "#9ca3af" : "linear-gradient(90deg, #1e3a8a, #3b82f6)", borderRadius: 3, transition: "width 0.4s" }} />
                  </div>

                  {/* bottom row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      {league.memberCount}/{league.max_teams} 已加入
                    </span>
                    {isFull ? (
                      <span style={{ padding: "8px 18px", background: "#f1f5f9", color: "#9ca3af", borderRadius: 8, fontSize: 13, fontWeight: 700 }}>
                        已满
                      </span>
                    ) : isMine ? (
                      <Link href={`/league/${league.slug}`} style={{ padding: "8px 18px", background: "#eff6ff", color: "#1e3a8a", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        进入联赛
                      </Link>
                    ) : (
                      <Link href={`/league/${league.slug}`} style={{ padding: "8px 18px", background: "#1e3a8a", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                        立即加入
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
