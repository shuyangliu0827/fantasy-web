"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useLang } from "@/lib/lang";
import { translateTeam } from "@/lib/shared/i18n";
import PlayerAvatar from "@/components/PlayerAvatar";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { getLeagueBySlug, getSessionUser, type League } from "@/lib/shared/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type PlayerStats = {
  id: number;
  name: string;
  team: string;
  position: string;
  gamesPlayed: number;
  totals: {
    min: number; fgm: number; fga: number; fg3m: number; fg3a: number;
    ftm: number; fta: number; reb: number; ast: number; stl: number;
    blk: number; tov: number; pts: number;
  };
  averages: {
    min: number; fgm: number; fga: number; fg3m: number; fg3a: number;
    ftm: number; fta: number; fg_pct: number; fg3_pct: number; ft_pct: number;
    reb: number; ast: number; stl: number; blk: number; tov: number; pts: number;
  };
  fpts: number;
  fptsAvg: number;
  rank: number;
  injury?: string;
};

type SortKey = "rank" | "name" | "pts" | "reb" | "ast" | "stl" | "blk" | "fg3m" | "tov" | "fptsAvg" | "gamesPlayed";
type HealthFilter = "all" | "healthy" | "questionable" | "injured";
type ViewMode = "table" | "card";

function abbreviateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts[0].charAt(0)}. ${parts.slice(1).join(" ")}`;
}

const QUESTIONABLE_STATUSES = new Set(["Questionable", "Probable", "Day-To-Day"]);
const INJURED_STATUSES = new Set(["Out", "Doubtful"]);

export default function LeagueRankingsPage() {
  const { t, lang } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [league, setLeague] = useState<League | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [gamesLoaded, setGamesLoaded] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [statView] = useState<"averages" | "totals">("averages");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [healthFilter, setHealthFilter] = useState<HealthFilter>("all");
  const [minPts, setMinPts] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [isMobile, setIsMobile] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    getLeagueBySlug(slug).then(l => {
      if (!l) return;
      setLeague(l);
      const user = getSessionUser();
      setIsOwner(!!user && l.commissioner_id === user.id);
    });

    loadData();
    const interval = setInterval(loadData, 5 * 60 * 1000);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => { clearInterval(interval); window.removeEventListener("resize", handleResize); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (isMobile) setViewMode("card"); }, [isMobile]);

  async function loadData() {
    try {
      const response = await fetch("/api/nba-stats", { cache: "no-store" });
      const data = await response.json();
      if (data.status === "loading") { setTimeout(loadData, 5000); return; }
      if (data.players && data.players.length > 0) {
        setPlayers(data.players);
        setGamesLoaded(data.gamesLoaded);
        setLastUpdated(data.lastUpdated);
        setError(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  const filteredPlayers = useMemo(() => {
    let result = players;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(term) || p.team.toLowerCase().includes(term));
    }
    if (positionFilter !== "all") result = result.filter(p => p.position.split("/").includes(positionFilter));
    if (minPts > 0) result = result.filter(p => p.averages.pts >= minPts);
    if (healthFilter === "healthy") result = result.filter(p => !p.injury);
    else if (healthFilter === "questionable") result = result.filter(p => p.injury && QUESTIONABLE_STATUSES.has(p.injury));
    else if (healthFilter === "injured") result = result.filter(p => p.injury && INJURED_STATUSES.has(p.injury));

    return [...result].sort((a, b) => {
      let aVal: string | number, bVal: string | number;
      if (sortKey === "name") { aVal = a.name; bVal = b.name; }
      else if (sortKey === "rank" || sortKey === "gamesPlayed" || sortKey === "fptsAvg") { aVal = a[sortKey]; bVal = b[sortKey]; }
      else {
        aVal = statView === "averages" ? a.averages[sortKey as keyof typeof a.averages] : a.totals[sortKey as keyof typeof a.totals];
        bVal = statView === "averages" ? b.averages[sortKey as keyof typeof b.averages] : b.totals[sortKey as keyof typeof b.totals];
      }
      if (typeof aVal === "string" && typeof bVal === "string") return sortOrder === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [players, searchTerm, positionFilter, sortKey, sortOrder, statView, minPts, healthFilter]);

  const paginatedPlayers = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredPlayers.slice(start, start + pageSize);
  }, [filteredPlayers, page]);

  const totalPages = Math.ceil(filteredPlayers.length / pageSize);

  function handleSortButton(key: SortKey) { setSortKey(key); setSortOrder("desc"); setPage(1); }

  function getRankCircleStyle(rank: number): React.CSSProperties {
    const base: React.CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", fontSize: 12, fontWeight: 700 };
    if (rank === 1) return { ...base, background: "#fef3c7", color: "#92400e" };
    if (rank === 2) return { ...base, background: "#dbeafe", color: "#1e40af" };
    if (rank === 3) return { ...base, background: "#f3f4f6", color: "#374151" };
    return { ...base, background: "transparent", color: "#6b7280", fontSize: 13 };
  }

  function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
    return (
      <button style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: "1px solid #e5e7eb", background: active ? "#1e3a8a" : "#fff", color: active ? "#fff" : "#374151", transition: "all 0.15s" }} onClick={onClick}>
        {children}
      </button>
    );
  }

  const sectionLabelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8, marginTop: 18 };
  const thStyle: React.CSSProperties = { padding: "10px 12px", fontSize: 11, fontWeight: 600, color: "#9ca3af", textAlign: "left", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.04em" };
  const tdStyle: React.CSSProperties = { padding: "12px 12px", fontSize: 13, color: "#374151", borderBottom: "1px solid #f3f4f6", verticalAlign: "middle" };

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />
      <LeagueNav slug={slug} isOwner={isOwner} leagueId={league?.id} />

      {loading && players.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 48 }}>📊</div>
          <p style={{ color: "#6b7280", fontSize: 16 }}>{t("加载中...", "Loading...")}</p>
        </div>
      ) : error && players.length === 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "40vh", flexDirection: "column", gap: 16 }}>
          <p style={{ color: "#dc2626", fontSize: 18, fontWeight: 600 }}>{t("加载失败", "Failed to Load")}</p>
          <button onClick={loadData} style={{ padding: "10px 24px", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14 }}>{t("重试", "Retry")}</button>
        </div>
      ) : (
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: isMobile ? "16px 12px 28px" : "24px 32px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>

          {/* Sidebar */}
          <aside style={{ width: isMobile ? "100%" : 260, flexShrink: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: isMobile ? 16 : 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: filtersOpen || !isMobile ? 20 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{t("筛选条件", "Filters")}</div>
              {isMobile && (
                <button onClick={() => setFiltersOpen(o => !o)} style={{ padding: "5px 12px", background: filtersOpen ? "#eff6ff" : "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 600, color: filtersOpen ? "#1e3a8a" : "#374151", cursor: "pointer" }}>
                  {filtersOpen ? t("收起 ▲", "Hide ▲") : t("展开 ▼", "Show ▼")}
                </button>
              )}
            </div>
            {isMobile && !filtersOpen ? null : (<>
              <div style={sectionLabelStyle}>{t("位置", "Position")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { label: t("全部", "All"), value: "all" },
                  { label: t("PG 控球后卫", "PG"), value: "G", sub: "PG" },
                  { label: t("SG 得分后卫", "SG"), value: "G", sub: "SG" },
                  { label: t("SF 小前锋", "SF"), value: "F", sub: "SF" },
                  { label: t("PF 大前锋", "PF"), value: "F", sub: "PF" },
                  { label: t("C 中锋", "C"), value: "C", sub: "C" },
                ].map(pos => (
                  <Pill key={pos.sub ?? pos.value} active={positionFilter === (pos.sub ?? pos.value)} onClick={() => { setPositionFilter(pos.sub ?? pos.value); setPage(1); }}>
                    {pos.label}
                  </Pill>
                ))}
              </div>
              <div style={sectionLabelStyle}>{t("场均得分范围", "Min PPG")}</div>
              <div>
                <input type="range" min={0} max={50} step={1} value={minPts} onChange={e => setMinPts(Number(e.target.value))} style={{ width: "100%", accentColor: "#1e3a8a" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  <span>0</span><span style={{ fontWeight: 600, color: "#1e3a8a", fontSize: 12 }}>≥ {minPts}</span><span>40+</span>
                </div>
              </div>
              <div style={sectionLabelStyle}>{t("健康状态", "Health")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {([
                  { key: "all", label: t("全部", "All"), border: "#e5e7eb", activeBg: "#1e3a8a", activeColor: "#fff" },
                  { key: "healthy", label: t("健康", "Healthy"), border: "#16a34a", activeBg: "#dcfce7", activeColor: "#16a34a" },
                  { key: "questionable", label: t("问题", "Questionable"), border: "#d97706", activeBg: "#fef3c7", activeColor: "#d97706" },
                  { key: "injured", label: t("伤病", "Injured"), border: "#dc2626", activeBg: "#fee2e2", activeColor: "#dc2626" },
                ] as { key: HealthFilter; label: string; border: string; activeBg: string; activeColor: string }[]).map(h => (
                  <button key={h.key} onClick={() => setHealthFilter(h.key)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500, cursor: "pointer", border: healthFilter === h.key ? `1.5px solid ${h.border}` : "1px solid #e5e7eb", background: healthFilter === h.key ? h.activeBg : "#fff", color: healthFilter === h.key ? h.activeColor : "#374151" }}>
                    {h.label}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(1)} style={{ marginTop: 24, width: "100%", padding: "12px 0", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                {t("应用筛选", "Apply Filters")}
              </button>
              <div style={{ marginTop: 18, padding: "12px 14px", background: "#f9fafb", borderRadius: 10, fontSize: 12, color: "#6b7280" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span>{t("显示球员", "Showing")}</span>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{filteredPlayers.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{t("比赛场次", "Games")}</span>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{gamesLoaded}</span>
                </div>
                {lastUpdated && (
                  <div style={{ marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
                    {t("更新", "Updated")} {new Date(lastUpdated).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
              </div>
            </>)}
          </aside>

          {/* Main */}
          <div style={{ flex: 1, minWidth: 0, width: isMobile ? "100%" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 14px", flex: 1, maxWidth: 340 }}>
                <span style={{ fontSize: 14, color: "#9ca3af" }}>🔍</span>
                <input type="text" placeholder={t("搜索球员姓名...", "Search players...")} value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setPage(1); }} style={{ flex: 1, border: "none", outline: "none", fontSize: 13, color: "#374151", background: "transparent" }} />
              </div>
              <div style={{ display: "flex", gap: 6, overflowX: isMobile ? "auto" : "visible", paddingBottom: isMobile ? 2 : 0 }}>
                {([
                  { key: "fptsAvg" as SortKey, zh: "综合得分 ↓", en: "Fantasy Pts ↓" },
                  { key: "pts" as SortKey, zh: "场均得分", en: "PPG" },
                  { key: "ast" as SortKey, zh: "场均助攻", en: "APG" },
                ]).map(btn => {
                  const isActive = sortKey === btn.key;
                  return (
                    <button key={btn.key} onClick={() => handleSortButton(btn.key)} style={{ padding: "8px 14px", fontSize: 12, fontWeight: isActive ? 700 : 500, borderRadius: 8, cursor: "pointer", background: isActive ? "#1e3a8a" : "#fff", color: isActive ? "#fff" : "#374151", border: isActive ? "none" : "1px solid #e5e7eb" }}>
                      {t(btn.zh, btn.en)}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 8, overflow: "hidden", border: "1px solid #e5e7eb", marginLeft: isMobile ? 0 : "auto" }}>
                {(["table", "card"] as ViewMode[]).map(m => {
                  const isActive = viewMode === m;
                  return <button key={m} onClick={() => setViewMode(m)} style={{ padding: "7px 16px", fontSize: 12, fontWeight: 500, cursor: "pointer", border: "none", background: isActive ? "#111827" : "transparent", color: isActive ? "#fff" : "#6b7280" }}>{m === "table" ? t("表格", "Table") : t("卡片", "Cards")}</button>;
                })}
              </div>
            </div>

            {viewMode === "table" && (
              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb" }}>
                <div style={{ overflow: "auto", WebkitOverflowScrolling: "touch", maxHeight: isMobile ? "60vh" : undefined } as React.CSSProperties}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isMobile ? 760 : 820 }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr>
                        {[t("排名","Rank"), t("球员","Player"), t("综合分","FPTS"), t("得分","PTS"), t("篮板","REB"), t("助攻","AST"), t("抢断","STL"), t("盖帽","BLK"), t("失误","TOV"), t("命中率","FG%"), t("场均罚球","FTM")].map((h, i) => (
                          <th key={i} style={{ ...thStyle, textAlign: i === 0 ? "center" : i === 1 ? "left" : "right" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedPlayers.map(player => {
                        const rowBg = player.injury ? "#fff5f5" : undefined;
                        return (
                          <tr key={player.id} style={{ background: rowBg, transition: "background 0.12s" }} onMouseEnter={e => { if (!player.injury) (e.currentTarget as HTMLTableRowElement).style.background = "#f9fafb"; }} onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = rowBg || ""; }}>
                            <td style={{ ...tdStyle, textAlign: "center", width: 50 }}><span style={getRankCircleStyle(player.rank)}>{player.rank}</span></td>
                            <td style={{ ...tdStyle, textAlign: "left", minWidth: 180 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <PlayerAvatar name={player.name} size={40} />
                                <div>
                                  <div style={{ fontWeight: 700, color: "#111827", fontSize: 13 }}>{abbreviateName(player.name)}</div>
                                  <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{translateTeam(player.team, lang)} · {player.position}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...tdStyle, textAlign: "right", color: "#2563eb", fontWeight: 700, fontSize: 16 }}>{player.fptsAvg}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.pts.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.reb.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.ast.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.stl.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.blk.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.tov.toFixed(1)}</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.fg_pct.toFixed(1)}%</td>
                            <td style={{ ...tdStyle, textAlign: "right" }}>{player.averages.ftm.toFixed(1)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {viewMode === "card" && (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                {paginatedPlayers.map(player => (
                  <div key={player.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, ...(player.injury ? { background: "#fff5f5" } : {}) }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={getRankCircleStyle(player.rank)}>{player.rank}</span>
                        <PlayerAvatar name={player.name} size={38} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{abbreviateName(player.name)}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{translateTeam(player.team, lang)} · {player.position}</div>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: "center", marginBottom: 12 }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color: "#2563eb" }}>{player.fptsAvg}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{t("综合分", "Fantasy Pts")}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 6 }}>
                      {[
                        { label: t("得分","PTS"), val: player.averages.pts.toFixed(1) },
                        { label: t("篮板","REB"), val: player.averages.reb.toFixed(1) },
                        { label: t("助攻","AST"), val: player.averages.ast.toFixed(1) },
                        { label: t("抢断","STL"), val: player.averages.stl.toFixed(1) },
                        { label: t("盖帽","BLK"), val: player.averages.blk.toFixed(1) },
                        { label: t("失误","TOV"), val: player.averages.tov.toFixed(1) },
                      ].map(s => (
                        <div key={s.label} style={{ background: "#f9fafb", borderRadius: 8, padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{s.val}</div>
                          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 20 }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: "7px 14px", fontSize: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: page === 1 ? "not-allowed" : "pointer", color: page === 1 ? "#d1d5db" : "#374151" }}>← {t("上一页", "Prev")}</button>
                {(() => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const end = Math.min(totalPages, start + 4);
                  return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(pageNum => {
                    const isActive = pageNum === page;
                    return <button key={pageNum} onClick={() => setPage(pageNum)} style={{ width: 36, height: 36, fontSize: 13, fontWeight: isActive ? 700 : 400, background: isActive ? "#1e3a8a" : "#fff", color: isActive ? "#fff" : "#374151", border: isActive ? "none" : "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }}>{pageNum}</button>;
                  });
                })()}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: "7px 14px", fontSize: 13, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: page === totalPages ? "not-allowed" : "pointer", color: page === totalPages ? "#d1d5db" : "#374151" }}>{t("下一页", "Next")} →</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
