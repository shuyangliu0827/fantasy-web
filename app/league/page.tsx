"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { listLeagues, getLeagueMemberCount, getSessionUser, League } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type LeagueWithCount = League & { memberCount: number };

export default function PublicLeaguesPage() {
  const { t } = useLang();
  const router = useRouter();
  const [leagues, setLeagues] = useState<LeagueWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const user = getSessionUser();

  useEffect(() => {
    async function load() {
      const data = await listLeagues();
      const publicLeagues = data.filter(l => l.visibility === "public");
      const leaguesWithCounts = await Promise.all(
        publicLeagues.map(async (league) => {
          const memberCount = await getLeagueMemberCount(league.id);
          return { ...league, memberCount };
        })
      );
      setLeagues(leaguesWithCounts);
      setLoading(false);
    }
    load();
  }, []);

  const filteredLeagues = leagues.filter(league =>
    league.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
    if (days === 0) return t("今天", "Today");
    if (days === 1) return t("昨天", "Yesterday");
    if (days < 7) return `${days} ${t("天前", "days ago")}`;
    if (days < 30) return `${Math.floor(days / 7)} ${t("周前", "weeks ago")}`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/league" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 12 }}>
          <div style={{ fontSize: 40 }}></div>
          <p style={{ color: "#9ca3af", fontSize: 15 }}>{t("加载中...", "Loading...")}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />

      {/* Hero header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "32px 32px 28px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ width: 64, height: 64, background: "#fef3c7", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>
              
            </div>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "0 0 6px 0" }}>
                {t("公开联赛", "Public Leagues")}
              </h1>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                {t("加入一个联赛，和其他玩家一起竞技！", "Join a league and compete with other players!")}
              </p>
            </div>
          </div>
          <Link href="/league/new" style={{ padding: "12px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap", flexShrink: 0 }}>
            + {t("创建联赛", "Create League")}
          </Link>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 32px" }}>

        {/* Search bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
          <div style={{ flex: 1, maxWidth: 400, display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 12 }}>
            <span style={{ fontSize: 15, color: "#9ca3af" }}></span>
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder={t("搜索联赛名称...", "Search league name...")}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#374151", background: "transparent", fontFamily: FONT }}
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm("")} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
            )}
          </div>
          <div style={{ fontSize: 13, color: "#9ca3af", whiteSpace: "nowrap" }}>
            {t(`共 ${filteredLeagues.length} 个公开联赛`, `${filteredLeagues.length} public leagues`)}
          </div>
        </div>

        {/* Leagues grid */}
        {filteredLeagues.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "72px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>{searchTerm ? "" : ""}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>
              {searchTerm ? t("没有找到匹配的联赛", "No matching leagues found") : t("还没有公开联赛", "No public leagues yet")}
            </h3>
            <p style={{ color: "#9ca3af", margin: "0 0 24px 0", fontSize: 14 }}>
              {searchTerm ? t("试试其他关键词", "Try different keywords") : t("成为第一个创建联赛的人！", "Be the first to create a league!")}
            </p>
            {!searchTerm && (
              <Link href="/league/new" style={{ display: "inline-block", padding: "11px 28px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, textDecoration: "none" }}>
                {t("创建联赛", "Create League")}
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
            {filteredLeagues.map(league => (
              <div key={league.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", transition: "box-shadow 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}>
                <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                  <div style={{ width: 52, height: 52, background: "#fef3c7", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0 }}>
                    
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 8px 0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {league.name}
                    </h3>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ padding: "3px 10px", background: "#dcfce7", color: "#15803d", borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                        {t("公开", "Public")}
                      </span>
                      <span style={{ fontSize: 13, color: "#9ca3af" }}>{getTimeAgo(league.created_at)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 24, padding: "14px 0", borderTop: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}></span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{t("成员", "Members")}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{league.memberCount}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}></span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>{t("帖子", "Posts")}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>0</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <Link href={`/league/${league.slug}`} style={{ flex: 1, padding: "10px", fontSize: 14, fontWeight: 600, color: "#374151", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 10, textDecoration: "none", textAlign: "center" }}>
                    {t("查看详情", "View Details")}
                  </Link>
                  <Link href={`/league/${league.slug}`} style={{ flex: 1, padding: "10px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, textDecoration: "none", textAlign: "center" }}>
                    {t("加入联赛", "Join League")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
