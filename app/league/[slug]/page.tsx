// app/league/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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

  useEffect(() => {
    init();
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
        .order('draft_position', { ascending: true });

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
          <div style={{ fontSize: 40 }}>❌</div>
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

  const statusLabel = league.status === "draft_pending" ? "准备中"
    : league.status === "drafting" ? "选秀中"
    : "进行中";
  const statusColor = league.status === "draft_pending" ? { color: "#92400e", bg: "#fef3c7" }
    : league.status === "drafting" ? { color: "#065f46", bg: "#d1fae5" }
    : { color: "#1e40af", bg: "#dbeafe" };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/league" />

      {/* League header */}
      <div style={{ background: "#1e3a8a", padding: "32px 32px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", gap: 24 }}>
          <div style={{ width: 64, height: 64, background: "rgba(255,255,255,0.15)", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, flexShrink: 0 }}>
            🏆
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ margin: "0 0 10px 0", fontSize: 26, fontWeight: 800, color: "#fff", wordBreak: "break-word" }}>
              {league.name}
            </h1>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {league.season} 赛季
              </span>
              <span style={{ padding: "4px 12px", background: "rgba(255,255,255,0.15)", borderRadius: 20, fontSize: 12, color: "rgba(255,255,255,0.85)" }}>
                {league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"}
              </span>
              <span style={{ padding: "4px 12px", background: statusColor.bg, color: statusColor.color, borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                {statusLabel}
              </span>
              {isCommissioner && (
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>👑 联盟管理员</span>
              )}
            </div>
          </div>
          {!myTeam ? (
            <button
              onClick={() => setShowJoinModal(true)}
              style={{ padding: "11px 24px", background: "#fff", color: "#1e3a8a", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0, fontFamily: FONT }}
            >
              + 加入联赛
            </button>
          ) : (
            <div style={{ padding: "11px 24px", background: "rgba(255,255,255,0.15)", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
              ✅ 已加入
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Announcement */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderLeft: "4px solid #1e3a8a", borderRadius: 12, padding: "20px 24px" }}>
          <h3 style={{ margin: "0 0 10px 0", fontSize: 16, fontWeight: 700, color: "#111827" }}>📢 联赛公告</h3>
          <p style={{ margin: 0, color: "#374151", lineHeight: 1.7, fontSize: 14 }}>
            欢迎来到联赛！准备好开始你的Fantasy 篮球之旅了吗?
          </p>
          {canStartDraft && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef3c7", borderRadius: 8, color: "#92400e", fontSize: 13, fontWeight: 500 }}>
              💡 提示：已有{teams.length}支队伍加入（偶数），可以开始选秀了！
            </div>
          )}
        </div>

        {/* Quick actions - active league */}
        {league.status === 'active' && myTeam && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { href: `/league/${leagueId}/roster`, icon: "📋", title: "查看阵容", desc: "管理首发和板凳" },
              { href: `/league/${leagueId}/free-agents`, icon: "🏪", title: "自由市场", desc: "签约和放弃球员" },
              { href: `/league/${leagueId}/trade`, icon: "🔄", title: "球员交易", desc: "与其他队伍交易" },
              { href: `/league/${leagueId}/standings`, icon: "🏆", title: "排行榜", desc: "查看联赛排名" },
            ].map(item => (
              <a key={item.href} href={item.href} style={{ background: "#fff", border: "1.5px solid #e5e7eb", padding: "18px 20px", borderRadius: 12, textDecoration: "none", display: "flex", alignItems: "center", gap: 14, transition: "border-color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#1e3a8a")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#e5e7eb")}>
                <span style={{ fontSize: 28 }}>{item.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{item.desc}</div>
                </div>
              </a>
            ))}
          </div>
        )}

        {/* Teams */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#111827" }}>
              👥 参赛队伍 ({teams.length}/{league.max_teams})
            </h3>
            {canStartDraft && (
              <button
                onClick={handleStartDraft}
                disabled={starting}
                style={{ padding: "10px 20px", background: "#15803d", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14, cursor: starting ? "not-allowed" : "pointer", opacity: starting ? 0.6 : 1, fontFamily: FONT }}
              >
                {starting ? "⏳ 开始中..." : "🚀 开始选秀"}
              </button>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {teams.map(team => (
              <div key={team.id} style={{ background: myTeam?.id === team.id ? "#eff6ff" : "#f9fafb", padding: "18px", borderRadius: 12, display: "flex", alignItems: "center", gap: 14, border: myTeam?.id === team.id ? "2px solid #1e3a8a" : "2px solid transparent" }}>
                <div style={{ width: 44, height: 44, background: "#1e3a8a", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                  #{team.draft_position}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, color: "#111827" }}>
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{team.name}</span>
                    {myTeam?.id === team.id && (
                      <span style={{ padding: "2px 7px", background: "#1e3a8a", color: "#fff", borderRadius: 6, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>你</span>
                    )}
                    {team.user_id === league.commissioner_id && <span style={{ fontSize: 13 }}>👑</span>}
                  </div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>
                    {league.status === "draft_pending" ? "等待选秀" : `${team.wins}-${team.losses}`}
                  </div>
                </div>
              </div>
            ))}

            {/* Empty slots */}
            {Array.from({ length: league.max_teams - teams.length }).map((_, i) => (
              <div key={`empty-${i}`} onClick={() => !myTeam && setShowJoinModal(true)} style={{ background: "#f9fafb", border: "2px dashed #d1d5db", padding: "18px", borderRadius: 12, display: "flex", justifyContent: "center", alignItems: "center", cursor: myTeam ? "default" : "pointer", flexDirection: "column", gap: 6, color: "#9ca3af" }}>
                <span style={{ fontSize: 28 }}>+</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>等待加入</span>
              </div>
            ))}
          </div>
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
                <p style={{ margin: "0 0 10px 0", fontWeight: 700, fontSize: 13, color: "#111827" }}>📋 你将获得:</p>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  <li style={{ marginBottom: 6, color: "#374151", fontSize: 13 }}>一个独特的选秀位置 (#{teams.length + 1})</li>
                  <li style={{ marginBottom: 6, color: "#374151", fontSize: 13 }}>13个球员名额</li>
                  <li style={{ color: "#374151", fontSize: 13 }}>参与所有周赛</li>
                </ul>
              </div>
            </div>

            <div style={{ padding: "16px 24px", borderTop: "1px solid #f3f4f6", display: "flex", gap: 12, justifyContent: "flex-end" }}>
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
