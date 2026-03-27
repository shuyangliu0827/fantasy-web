// app/league/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import { getLeagueBySlug, getSessionUser, supabase as storeSupa } from "@/lib/store";

import DraftRoom from "@/components/DraftRoom";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

export default function LeaguePage() {
  const params = useParams();
  const leagueId = params.slug as string;

  const [league, setLeague] = useState<any | null>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [myTeam, setMyTeam] = useState<any | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [joining, setJoining] = useState(false);
  const [starting, setStarting] = useState(false);
  const [activeTab, setActiveTab] = useState<"standings" | "schedule" | "history" | "draft" | "news" | "settings">("standings");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    init();
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  async function init() {
    try {
      setCurrentUser(getSessionUser());
      await loadLeagueInfo();
    } catch (err) {
      console.error("Init error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function loadLeagueInfo() {
    try {
      const leagueData = await getLeagueBySlug(leagueId);
      if (!leagueData) return;
      setLeague(leagueData as any);

      const { data: teamsData } = await storeSupa
        .from('fantasy_teams')
        .select('*')
        .eq('league_id', leagueData.id)
        .order('wins', { ascending: false });

      setTeams(teamsData || []);

      const user = getSessionUser();
      if (user) {
        const myTeamData = teamsData?.find((t: any) => t.user_id === user.id);
        setMyTeam(myTeamData || null);
      }
    } catch (err) {
      console.error("Failed to load league:", err);
    }
  }

  async function handleJoinDraft() {
    if (!teamName.trim()) {
      alert("请输入队伍名称");
      return;
    }
    setJoining(true);
    try {
      const user = getSessionUser();
      if (!user) throw new Error("请先登录");
      const leagueData = league;
      if (!leagueData) throw new Error("联赛不存在");

      // 校验联赛状态：仅 draft_pending 状态允许加入
      if (leagueData.status !== "draft_pending") {
        throw new Error("选秀已开始或已完成，无法加入");
      }

      // 校验人数上限
      const { count: memberCount } = await storeSupa
        .from("league_members")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueData.id);
      if ((memberCount ?? 0) >= leagueData.max_teams) {
        throw new Error("联赛已满，无法加入");
      }

      const { count } = await storeSupa
        .from("fantasy_teams")
        .select("*", { count: "exact", head: true })
        .eq("league_id", leagueData.id);
      const { data: team, error } = await storeSupa
        .from("fantasy_teams")
        .insert({ league_id: leagueData.id, user_id: user.id, name: teamName.trim(), draft_position: (count ?? 0) + 1 })
        .select()
        .single();
      if (error) throw error;
      await storeSupa.from("league_members").upsert({ league_id: leagueData.id, user_id: user.id, role: "member" }, { onConflict: "league_id,user_id" });
      setMyTeam(team);
      setShowJoinModal(false);
      setTeamName("");
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Join error:", err);
      alert(err.message || "加入失败");
    } finally {
      setJoining(false);
    }
  }

  async function handleStartDraft() {
    if (!confirm("确定开始选秀吗？")) return;
    setStarting(true);
    try {
      const { error } = await storeSupa.from("leagues").update({ status: "drafting" }).eq("slug", leagueId);
      if (error) throw error;
      await loadLeagueInfo();
    } catch (err: any) {
      console.error("Start draft error:", err);
      alert(err.message || "开始选秀失败");
    } finally {
      setStarting(false);
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/league" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 12 }}>
          <div style={{ fontSize: 40 }}>🏀</div>
          <p style={{ color: "#9ca3af", fontSize: 15 }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!league) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/league" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "50vh", gap: 12 }}>
          <div style={{ fontSize: 40 }}>😕</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>联赛未找到</h2>
          <p style={{ color: "#9ca3af" }}>League ID: {leagueId}</p>
        </div>
      </div>
    );
  }

  // If drafting and user has joined, show draft room
  if (league.status === "drafting" && myTeam) {
    return (
      <DraftRoom
        league={league}
        teams={teams}
        myTeam={myTeam}
        onDraftComplete={async () => {
          await loadLeagueInfo();
        }}
      />
    );
  }

  const isCommissioner = currentUser?.id === league.commissioner_id;
  const canStartDraft = isCommissioner && teams.length >= 2 && teams.length % 2 === 0 && league.status === 'draft_pending';
  const isActive = league.status === 'active';

  const statusLabel = league.status === "draft_pending" ? "准备中"
    : league.status === "drafting" ? "选秀中"
    : "进行中";
  const statusColor = league.status === "draft_pending" ? { color: "#92400e", bg: "#fef3c7" }
    : league.status === "drafting" ? { color: "#065f46", bg: "#d1fae5" }
    : { color: "#1e40af", bg: "#dbeafe" };

  // ─── ACTIVE STATE: standings-style layout ────────────────────────────────
  if (isActive) {
    const sortedTeams = [...teams].sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.losses - b.losses;
    });
    const myRank = myTeam ? sortedTeams.findIndex(t => t.id === myTeam.id) + 1 : null;
    const myWinPct = myTeam
      ? (myTeam.wins + myTeam.losses) > 0
        ? ((myTeam.wins / (myTeam.wins + myTeam.losses)) * 1000 / 10).toFixed(1) + "%"
        : "—"
      : null;

    const TABS: { key: string; label: string; href?: string }[] = [
      { key: "standings", label: "积分榜" },
      { key: "schedule", label: "赛程", href: `/league/${leagueId}/schedule` },
      { key: "draft", label: "选秀记录" },
      { key: "news", label: "联赛公告" },
      { key: "settings", label: "联赛设置" },
    ];

    return (
      <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: FONT }}>
        <LightHeader activeHref="/league" />

        {/* ── Hero ── */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)",
          padding: isMobile ? "24px 12px 20px" : "40px 32px 36px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* decorative circles */}
          <div style={{ position: "absolute", right: -60, top: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 80, bottom: -80, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 20 : 32, alignItems: "flex-start" }}>
            {/* left content */}
            <div style={{ flex: 1 }}>
              {/* breadcrumb */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
                <Link href="/league" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>← 返回公开联赛</Link>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>公开联赛</span>
                <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/</span>
                <span style={{ fontSize: 13, color: "#fff" }}>{league.name}</span>
              </div>

              {/* tag row */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
                <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                  精选联赛
                </span>
                <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                  {league.season} NBA赛季
                </span>
              </div>

              {/* title */}
              <h1 style={{ margin: "0 0 12px", fontSize: isMobile ? 26 : 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
                {league.name}
              </h1>
              <p style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 600 }}>
                {league.description || `${teams.length}支队伍，${league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}，每周对决出本周胜者，赛季末积分最高者夺冠。`}
              </p>

              {/* stat badges */}
              <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 32 }}>
                {[
                  { value: teams.length, label: "参赛队伍" },
                  { value: league.draft_type === "snake" ? "蛇形" : "线性", label: "选秀方式" },
                  { value: league.max_teams, label: "最大队伍" },
                  { value: league.scoring_categories || "标准", label: "统计类别" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{s.value}</span>
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                  </div>
                ))}
              </div>

              {/* action buttons */}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {myTeam && (
                  <Link href={`/league/${leagueId}/roster`} style={{
                    padding: "11px 22px", background: "#fff", color: "#1e3a8a",
                    border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                    🏀 管理我的球队
                  </Link>
                )}
                <button
                  onClick={() => {
                    const url = window.location.href;
                    navigator.clipboard.writeText(url).then(() => alert("邀请链接已复制！"));
                  }}
                  style={{
                    padding: "11px 22px", background: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14,
                    fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                  }}>
                  邀请好友
                </button>
                {isCommissioner && (
                  <Link href={`/league/${leagueId}/settings`} style={{
                    padding: "11px 22px", background: "rgba(255,255,255,0.15)", color: "#fff",
                    border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14,
                    fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center",
                  }}>
                    联赛设置
                  </Link>
                )}
              </div>
            </div>

            {/* right: my ranking card */}
            {myTeam && (
              <div style={{
                background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16,
                padding: "24px 28px", minWidth: 200, flexShrink: 0, textAlign: "center",
              }}>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>你的当前排名</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fbbf24", lineHeight: 1, marginBottom: 8 }}>
                  {myRank}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 20 }}>
                  {myTeam.wins}胜 {myTeam.losses}负 · {myWinPct}
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>本赛季总得分</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: "#fff" }}>
                    {myTeam.total_score != null ? myTeam.total_score.toFixed(1) : "—"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 64, zIndex: 10 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 12px" : "0 32px", display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            {TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: isMobile ? "12px 14px" : "16px 20px", background: "none", border: "none", cursor: "pointer",
                  fontSize: isMobile ? 13 : 14, fontWeight: 600, fontFamily: FONT,
                  whiteSpace: "nowrap", flexShrink: 0,
                  color: activeTab === tab.key ? "#1e3a8a" : "#6b7280",
                  borderBottom: activeTab === tab.key ? "2.5px solid #1e3a8a" : "2.5px solid transparent",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Main content ── */}
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "18px 12px" : "28px 32px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>

          {/* ── Standings table ── */}
          {activeTab === "standings" && (
            <div style={{ flex: 1 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>积分榜</h2>
                  <Link href={`/league/${leagueId}/standings`} style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 600, textDecoration: "none" }}>
                    查看完整排名 →
                  </Link>
                </div>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch", scrollbarWidth: "none" } as React.CSSProperties}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
                  <thead>
                    <tr style={{ background: "#f9fafb" }}>
                      <th style={thStyle}>次名</th>
                      <th style={{ ...thStyle, textAlign: "left", minWidth: 200 }}>球队</th>
                      <th style={thStyle}>胜</th>
                      <th style={thStyle}>负</th>
                      <th style={thStyle}>胜率</th>
                      <th style={thStyle}>赛季总分</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, idx) => {
                      const rank = idx + 1;
                      const total = team.wins + team.losses;
                      const pct = total > 0 ? (team.wins / total).toFixed(3) : ".000";
                      const isMe = myTeam?.id === team.id;
                      return (
                        <tr
                          key={team.id}
                          style={{
                            background: isMe ? "#eff6ff" : "transparent",
                            borderLeft: isMe ? "3px solid #1e3a8a" : "3px solid transparent",
                            transition: "background 0.1s",
                          }}
                        >
                          <td style={tdStyle}>
                            <span style={{
                              display: "inline-flex", alignItems: "center", justifyContent: "center",
                              width: 28, height: 28, borderRadius: 7, fontSize: 13, fontWeight: 700,
                              background: rank === 1 ? "#1e3a8a" : rank === 2 ? "#64748b" : rank === 3 ? "#b45309" : "#f1f5f9",
                              color: rank <= 3 ? "#fff" : "#374151",
                            }}>
                              {rank}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, textAlign: "left", padding: "14px 16px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                                background: isMe ? "#1e3a8a" : "#e2e8f0",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                fontSize: 14, fontWeight: 700,
                                color: isMe ? "#fff" : "#64748b",
                                border: isMe ? "2px dashed rgba(255,255,255,0.4)" : "none",
                              }}>
                                {team.name[0]?.toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                                  {team.name}
                                  {isMe && <span style={{ padding: "1px 6px", background: "#1e3a8a", color: "#fff", borderRadius: 5, fontSize: 10, fontWeight: 700 }}>你</span>}
                                  {team.user_id === league.commissioner_id && <span style={{ fontSize: 11, color: "#6b7280" }}>👑</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 700, color: "#16a34a" }}>{team.wins}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 700, color: "#dc2626" }}>{team.losses}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600, color: isMe ? "#1e3a8a" : "#374151" }}>{pct}</span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 600, color: isMe ? "#1e3a8a" : "#374151" }}>
                              {team.total_score != null ? team.total_score.toFixed(1) : "—"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
                {sortedTeams.length === 0 && (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#9ca3af", fontSize: 14 }}>
                    暂无队伍数据
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Other tabs placeholder */}
          {activeTab !== "standings" && (
            <div style={{ flex: 1 }}>
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "60px 24px", textAlign: "center", color: "#9ca3af" }}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>🏗️</div>
                <p style={{ fontSize: 15, fontWeight: 600, color: "#374151", margin: "0 0 6px" }}>
                  {TABS.find(t => t.key === activeTab)?.label} 功能即将上线
                </p>
                <p style={{ fontSize: 13, margin: 0 }}>敬请期待</p>
              </div>
            </div>
          )}

          {/* ── Right sidebar ── */}
          <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Season progress */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>赛季进度</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                <span>常规赛</span>
                <span>{teams.length > 0 ? `${teams.reduce((s, t) => s + t.wins + t.losses, 0) / teams.length | 0} / 22 周` : "—"}</span>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{
                  height: "100%", background: "linear-gradient(90deg, #1e3a8a, #3b82f6)",
                  borderRadius: 3,
                  width: teams.length > 0
                    ? `${Math.min(100, (teams.reduce((s, t) => s + t.wins + t.losses, 0) / teams.length / 22) * 100)}%`
                    : "0%",
                }} />
              </div>
            </div>

            {/* Top scorers */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>积分榜前三</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {sortedTeams.slice(0, 3).map((team, idx) => (
                  <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      width: 22, height: 22, borderRadius: 6, fontSize: 12, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: idx === 0 ? "#1e3a8a" : idx === 1 ? "#64748b" : "#b45309",
                      color: "#fff", flexShrink: 0,
                    }}>{idx + 1}</span>
                    <div style={{
                      width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                      background: myTeam?.id === team.id ? "#1e3a8a" : "#e2e8f0",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700,
                      color: myTeam?.id === team.id ? "#fff" : "#64748b",
                    }}>
                      {team.name[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {team.name}
                      </div>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", flexShrink: 0 }}>
                      {team.wins}W
                    </span>
                  </div>
                ))}
                {sortedTeams.length === 0 && (
                  <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>暂无数据</div>
                )}
              </div>
            </div>

            {/* Invite */}
            <button
              onClick={() => {
                const url = window.location.href;
                navigator.clipboard.writeText(url).then(() => alert("邀请链接已复制！"));
              }}
              style={{
                width: "100%", padding: "13px", background: "#fff",
                border: "2px dashed #1e3a8a", borderRadius: 12, color: "#1e3a8a",
                fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT,
              }}>
              + 邀请好友加入联赛
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── PRE-DRAFT STATE: same hero layout as active, pre-draft content ─────────
  const PRE_DRAFT_TABS = [
    { key: "standings", label: "参赛队伍" },
    { key: "news",      label: "联赛公告" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f0f4f8", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />

      {/* ── Hero (same gradient as active) ── */}
      <div style={{
        background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)",
        padding: isMobile ? "24px 12px 20px" : "40px 32px 36px",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", right: -60, top: -60, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", right: 80, bottom: -80, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 20 : 32, alignItems: "flex-start" }}>
          {/* left */}
          <div style={{ flex: 1 }}>
            {/* breadcrumb */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 18 }}>
              <Link href="/league" style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", textDecoration: "none" }}>← 返回公开联赛</Link>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/</span>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.65)" }}>公开联赛</span>
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 13 }}>/</span>
              <span style={{ fontSize: 13, color: "#fff" }}>{league.name}</span>
            </div>

            {/* tags */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ padding: "4px 12px", background: statusColor.bg, color: statusColor.color, borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {statusLabel}
              </span>
              <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {league.season} NBA赛季
              </span>
            </div>

            {/* title */}
            <h1 style={{ margin: "0 0 12px", fontSize: isMobile ? 26 : 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              {league.name}
            </h1>
            <p style={{ margin: "0 0 28px", fontSize: 14, color: "rgba(255,255,255,0.75)", lineHeight: 1.7, maxWidth: 600 }}>
              {league.description || `${teams.length}支队伍已加入，${league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}，选秀尚未开始。`}
            </p>

            {/* stat badges */}
            <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginBottom: 32 }}>
              {[
                { value: `${teams.length} / ${league.max_teams}`, label: "参赛队伍" },
                { value: league.draft_type === "snake" ? "蛇形" : "线性", label: "选秀方式" },
                { value: league.max_teams, label: "最大队伍" },
                { value: league.scoring_categories || "标准", label: "统计类别" },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>{s.value}</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* action buttons */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {!myTeam ? (
                (() => {
                  const isDraftCompleted = league.draft_completed_at || league.status === "active" || league.status === "completed";
                  const isFull = teams.length >= league.max_teams;
                  const canJoin = league.status === "draft_pending" && !isFull;
                  if (canJoin) {
                    return (
                      <button
                        onClick={() => setShowJoinModal(true)}
                        style={{ padding: "11px 22px", background: "#fff", color: "#1e3a8a", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
                      >
                        + 加入联赛
                      </button>
                    );
                  }
                  return (
                    <span style={{ padding: "11px 22px", background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", borderRadius: 10, fontSize: 14, fontWeight: 600, fontFamily: FONT }}>
                      {isDraftCompleted ? "选秀已完成，无法再加入" : isFull ? "联赛已满，无法加入" : "暂不可加入"}
                    </span>
                  );
                })()
              ) : (
                <Link href={`/league/${leagueId}/roster`} style={{
                  padding: "11px 22px", background: "#fff", color: "#1e3a8a",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                  🏀 管理我的球队
                </Link>
              )}
              <button
                onClick={() => { navigator.clipboard.writeText(window.location.href).then(() => alert("邀请链接已复制！")); }}
                style={{ padding: "11px 22px", background: "rgba(255,255,255,0.15)", color: "#fff", border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
              >
                邀请好友
              </button>
              {isCommissioner && (
                <Link href={`/league/${leagueId}/settings`} style={{
                  padding: "11px 22px", background: "rgba(255,255,255,0.15)", color: "#fff",
                  border: "1.5px solid rgba(255,255,255,0.3)", borderRadius: 10, fontSize: 14,
                  fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center",
                }}>
                  联赛设置
                </Link>
              )}
            </div>
          </div>

          {/* right: pre-draft status card */}
          <div style={{
            background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.2)", borderRadius: 16,
            padding: "24px 28px", minWidth: 200, flexShrink: 0, textAlign: "center",
          }}>
            {myTeam ? (
              <>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>你的选秀位</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fbbf24", lineHeight: 1, marginBottom: 8 }}>
                  #{myTeam.draft_position}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 20 }}>
                  等待选秀开始
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 8 }}>剩余名额</div>
                <div style={{ fontSize: 56, fontWeight: 900, color: "#fbbf24", lineHeight: 1, marginBottom: 8 }}>
                  {league.max_teams - teams.length}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", marginBottom: 20 }}>
                  等待加入
                </div>
              </>
            )}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: 16 }}>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginBottom: 6 }}>选秀状态</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                {canStartDraft ? "✅ 可以开始" : `${teams.length} / ${league.max_teams} 队伍`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 64, zIndex: 10 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 12px" : "0 32px", display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {PRE_DRAFT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              style={{
                padding: isMobile ? "12px 14px" : "16px 20px", background: "none", border: "none", cursor: "pointer",
                fontSize: isMobile ? 13 : 14, fontWeight: 600, fontFamily: FONT,
                whiteSpace: "nowrap", flexShrink: 0,
                color: activeTab === tab.key ? "#1e3a8a" : "#6b7280",
                borderBottom: activeTab === tab.key ? "2.5px solid #1e3a8a" : "2.5px solid transparent",
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main content + sidebar ── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "18px 12px" : "28px 32px", display: "flex", flexDirection: isMobile ? "column" : "row", gap: 24, alignItems: "flex-start" }}>

        {/* ── Teams tab ── */}
        {activeTab === "standings" && (
          <div style={{ flex: 1 }}>
            {/* draft-ready notice */}
            {canStartDraft && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "14px 18px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontSize: 14, color: "#15803d", fontWeight: 600 }}>
                  ✅ 已有 {teams.length} 支队伍加入（偶数），可以开始选秀了！
                </div>
                <button
                  onClick={handleStartDraft}
                  disabled={starting}
                  style={{ padding: "9px 20px", background: "#15803d", border: "none", borderRadius: 9, color: "#fff", fontWeight: 700, fontSize: 13, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1, fontFamily: FONT, whiteSpace: "nowrap", flexShrink: 0 }}
                >
                  {starting ? "⏳ 开始中..." : "🎯 开始选秀"}
                </button>
              </div>
            )}

            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "18px 24px", borderBottom: "1px solid #f3f4f6" }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" }}>
                  参赛队伍 ({teams.length}/{league.max_teams})
                </h2>
              </div>

              <div style={{ padding: "16px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {teams.map(team => (
                  <div key={team.id} style={{
                    background: myTeam?.id === team.id ? "#eff6ff" : "#f9fafb",
                    padding: "16px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14,
                    border: myTeam?.id === team.id ? "2px solid #1e3a8a" : "2px solid transparent",
                  }}>
                    <div style={{ width: 44, height: 44, background: "#1e3a8a", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                      #{team.draft_position}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3, display: "flex", alignItems: "center", gap: 6, color: "#111827" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
                        {myTeam?.id === team.id && <span style={{ padding: "1px 6px", background: "#1e3a8a", color: "#fff", borderRadius: 5, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>你</span>}
                        {team.user_id === league.commissioner_id && <span style={{ fontSize: 13 }}>👑</span>}
                      </div>
                      <div style={{ color: "#9ca3af", fontSize: 12 }}>等待选秀开始</div>
                    </div>
                  </div>
                ))}

                {/* empty slots */}
                {Array.from({ length: league.max_teams - teams.length }).map((_, i) => (
                  <div
                    key={`empty-${i}`}
                    onClick={() => !myTeam && setShowJoinModal(true)}
                    style={{ background: "#f9fafb", border: "2px dashed #d1d5db", padding: "16px", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", cursor: myTeam ? "default" : "pointer", flexDirection: "column", gap: 6, color: "#9ca3af", minHeight: 76 }}
                  >
                    <span style={{ fontSize: 22 }}>+</span>
                    <span style={{ fontSize: 12, fontWeight: 500 }}>等待加入</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Announcement tab ── */}
        {activeTab === "news" && (
          <div style={{ flex: 1 }}>
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: "4px solid #1e3a8a", borderRadius: 14, padding: "24px" }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 17, fontWeight: 700, color: "#111827" }}>📢 联赛公告</h2>
              <p style={{ margin: 0, color: "#374151", lineHeight: 1.8, fontSize: 14 }}>
                {league.description || "欢迎来到联赛！准备好开始你的 Fantasy 篮球之旅了吗？"}
              </p>
              <div style={{ marginTop: 16, padding: "14px 16px", background: "#f9fafb", borderRadius: 10, fontSize: 13, color: "#6b7280", lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>选秀规则</div>
                <div>· 赛制：{league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}</div>
                <div>· 最大队伍数：{league.max_teams}</div>
                <div>· 当前状态：{statusLabel}，选秀尚未开始</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Right sidebar ── */}
        <div style={{ width: 260, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Draft readiness */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>选秀准备状态</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#6b7280" }}>
                <span>已加入队伍</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{teams.length} / {league.max_teams}</span>
              </div>
              <div style={{ height: 6, background: "#f1f5f9", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, #1e3a8a, #3b82f6)", borderRadius: 3, width: `${Math.min(100, (teams.length / league.max_teams) * 100)}%`, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 12, color: canStartDraft ? "#15803d" : "#6b7280", fontWeight: canStartDraft ? 700 : 400 }}>
                {canStartDraft ? "✅ 人数充足，可以开始选秀" : `还需 ${Math.max(0, 2 - teams.length % 2 === 0 && teams.length >= 2 ? 0 : 2 - (teams.length % 2 || 2))} 队伍加入（需偶数）`}
              </div>
            </div>
          </div>

          {/* Commissioner: start draft shortcut */}
          {canStartDraft && (
            <button
              onClick={handleStartDraft}
              disabled={starting}
              style={{ width: "100%", padding: "13px", background: "#15803d", border: "none", borderRadius: 12, color: "#fff", fontSize: 14, fontWeight: 700, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1, fontFamily: FONT }}
            >
              {starting ? "⏳ 开始中..." : "🎯 开始选秀"}
            </button>
          )}

          {/* Invite */}
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.href).then(() => alert("邀请链接已复制！")); }}
            style={{ width: "100%", padding: "13px", background: "#fff", border: "2px dashed #1e3a8a", borderRadius: 12, color: "#1e3a8a", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
          >
            + 邀请好友加入联赛
          </button>
        </div>
      </div>

      {/* Join modal */}
      {showJoinModal && (
        <div onClick={() => setShowJoinModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 480, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.15)", fontFamily: FONT }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>+ 加入联赛</h3>
              <button onClick={() => setShowJoinModal(false)} style={{ width: 32, height: 32, border: "none", background: "#f3f4f6", borderRadius: "50%", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
            </div>
            <div style={{ padding: "24px" }}>
              <p style={{ margin: "0 0 14px 0", color: "#374151", fontSize: 14 }}>请为你的队伍起个名字</p>
              <input
                type="text"
                placeholder="输入队伍名称..."
                value={teamName}
                onChange={e => setTeamName(e.target.value)}
                maxLength={50}
                autoFocus
                onKeyPress={e => { if (e.key === "Enter" && teamName.trim()) handleJoinDraft(); }}
                style={{ width: "100%", padding: "11px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 15, boxSizing: "border-box", outline: "none", fontFamily: FONT }}
              />
              <div style={{ marginTop: 16, padding: "14px 16px", background: "#f9fafb", borderRadius: 10 }}>
                <p style={{ margin: "0 0 10px 0", fontWeight: 700, fontSize: 13, color: "#111827" }}>🎁 你将获得:</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li style={{ marginBottom: 6, color: "#374151", fontSize: 13 }}>一个独特的选秀位置 (#{teams.length + 1})</li>
                  <li style={{ marginBottom: 6, color: "#374151", fontSize: 13 }}>13个球员名额</li>
                  <li style={{ color: "#374151", fontSize: 13 }}>参与所有周赛</li>
                </ul>
              </div>
            </div>
            <div style={{ padding: isMobile ? "14px 12px" : "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 12, justifyContent: isMobile ? "stretch" : "flex-end", flexDirection: isMobile ? "column" : "row" }}>
              <button onClick={() => setShowJoinModal(false)} style={{ padding: "10px 22px", border: "1.5px solid #e5e7eb", borderRadius: 10, background: "#fff", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14, fontFamily: FONT }}>
                取消
              </button>
              <button onClick={handleJoinDraft} disabled={joining || !teamName.trim()} style={{ padding: "10px 22px", border: "none", borderRadius: 10, background: "#1e3a8a", color: "#fff", fontWeight: 700, cursor: joining || !teamName.trim() ? "not-allowed" : "pointer", opacity: joining || !teamName.trim() ? 0.5 : 1, fontSize: 14, fontFamily: FONT }}>
                {joining ? "加入中..." : "确认加入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── table style helpers ──────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: 12,
  fontWeight: 600,
  color: "#6b7280",
  textTransform: "uppercase",
  textAlign: "center",
  borderBottom: "1px solid #e5e7eb",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "14px 16px",
  fontSize: 14,
  color: "#374151",
  textAlign: "center",
  borderBottom: "1px solid #f3f4f6",
};
