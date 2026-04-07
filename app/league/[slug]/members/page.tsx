"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  isLeagueMember,
  joinLeague,
  leaveLeague,
  League,
  LeagueMember,
  supabase,
} from "@/lib/store";

export default function MembersPage() {
  const { t } = useLang();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [user] = useState(() => getSessionUser());
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [draftPositions, setDraftPositions] = useState<Record<string, number>>({});
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [copied, setCopied] = useState(false);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const membersData = await getLeagueMembers(leagueData.id);
      setMembers(membersData);
      const memberStatus = await isLeagueMember(leagueData.id);
      setIsMember(memberStatus);
      // 加载 fantasy_teams 以获取 draft_position
      const { data: teams } = await supabase
        .from("fantasy_teams")
        .select("user_id, draft_position")
        .eq("league_id", leagueData.id);
      if (teams) {
        const map: Record<string, number> = {};
        for (const t of teams) {
          if (t.draft_position != null) map[t.user_id] = t.draft_position;
        }
        setDraftPositions(map);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadData(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleJoin() {
    if (!user) {
      alert(t("请先登录", "Please login first"));
      router.push("/auth/login");
      return;
    }

    setJoining(true);
    const res = await joinLeague(league!.id);

    if (res.ok) {
      setIsMember(true);
      const membersData = await getLeagueMembers(league!.id);
      setMembers(membersData);
    } else {
      alert(res.error || t("加入失败", "Failed to join"));
    }
    setJoining(false);
  }

  async function handleLeave() {
    if (!confirm(t("确定要退出联赛吗？", "Are you sure you want to leave?"))) {
      return;
    }

    setJoining(true);
    const res = await leaveLeague(league!.id);

    if (res.ok) {
      setIsMember(false);
      const membersData = await getLeagueMembers(league!.id);
      setMembers(membersData);
    }
    setJoining(false);
  }

  function copyInviteLink() {
    const link = `${window.location.origin}/league/${slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="loading-container">
          <p>{t("加载中...", "Loading...")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <LightHeader activeHref="/league" />
      
      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon"></span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <div>
              <h1>{t("成员管理", "Members")}</h1>
              <p>{members.length}/{league?.max_teams || 10} {t("队伍", "teams")}</p>
            </div>
            {isOwner && (
              <button className="invite-btn" onClick={copyInviteLink}>
                {copied ? " " + t("已复制", "Copied!") : " " + t("复制邀请链接", "Copy Invite Link")}
              </button>
            )}
          </div>

          {/* 邀请卡片 */}
          {isOwner && (
            <div className="invite-card">
              <div className="invite-icon"></div>
              <div className="invite-content">
                <h3>{t("邀请成员", "Invite Members")}</h3>
                <p>{t("分享链接邀请朋友加入联赛", "Share the link to invite friends to join")}</p>
              </div>
              <button className="copy-btn" onClick={copyInviteLink}>
                {copied ? t("已复制!", "Copied!") : t("复制链接", "Copy Link")}
              </button>
            </div>
          )}

          {/* 成员列表：按选秀顺位排序 */}
          <div className="members-grid">
            {[...members]
              .sort((a, b) => {
                const pa = draftPositions[a.user_id] ?? 999;
                const pb = draftPositions[b.user_id] ?? 999;
                return pa - pb;
              })
              .map((member) => {
              const name = getMemberName(member);
              const isCurrentUser = user && member.user_id === user.id;
              const draftPos = draftPositions[member.user_id];

              return (
                <div key={member.id} className={`member-card ${isCurrentUser ? "current-user" : ""}`}>
                  <div className="member-rank">{draftPos != null ? `#${draftPos}` : "—"}</div>
                  <div className="member-avatar">{name[0]?.toUpperCase()}</div>
                  <div className="member-info">
                    <div className="member-name">
                      {name}
                      {isCurrentUser && <span className="you-badge">{t("你", "You")}</span>}
                    </div>
                    <div className="member-meta">
                      {member.role === "owner" && (
                        <span className="role-badge owner"> {t("联赛管理员", "League Manager")}</span>
                      )}
                      {member.role === "member" && (
                        <span className="role-badge member">{t("成员", "Member")}</span>
                      )}
                    </div>
                    <div className="join-date">
                      {t("加入于", "Joined")} {formatDate(member.joined_at)}
                    </div>
                  </div>
                  <div className="member-stats">
                    <div className="stat">
                      <span className="stat-value">0-0</span>
                      <span className="stat-label">{t("战绩", "Record")}</span>
                    </div>
                  </div>
                  {isOwner && !isCurrentUser && (
                    <div className="member-actions">
                      <button className="action-btn remove">{t("移除", "Remove")}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 加入/退出按钮 */}
          {!isMember ? (
            <div className="join-section">
              <button className="join-btn" onClick={handleJoin} disabled={joining}>
                {joining ? t("加入中...", "Joining...") : t("加入联赛", "Join League")}
              </button>
            </div>
          ) : !isOwner && (
            <div className="leave-section">
              <button className="leave-btn" onClick={handleLeave} disabled={joining}>
                {joining ? t("退出中...", "Leaving...") : t("退出联赛", "Leave League")}
              </button>
            </div>
          )}
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: #1e3a8a;
    border-bottom: none;
  }

  .league-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
  }

  .league-title {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .league-icon { font-size: 28px; }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #f9fafb;
    padding: 24px 16px;
  }

  .container { max-width: 900px; margin: 0 auto; }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0 0 4px 0;
  }

  .page-header p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .invite-btn {
    padding: 10px 20px;
    background: #1e3a8a;
    border: none;
    border-radius: 20px;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .invite-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #eff6ff;
    border: 1px solid #dbeafe;
    border-radius: 12px;
    margin-bottom: 24px;
  }

  .invite-icon { font-size: 32px; }

  .invite-content {
    flex: 1;
  }

  .invite-content h3 {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    margin: 0 0 4px 0;
  }

  .invite-content p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .copy-btn {
    padding: 10px 20px;
    background: #1e3a8a;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .members-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  .member-card.current-user {
    border-color: #1e3a8a;
    background: #f8fafc;
  }

  .member-rank {
    font-size: 14px;
    font-weight: 700;
    color: #9ca3af;
    width: 32px;
  }

  .member-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #fff;
    font-size: 22px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .member-info {
    flex: 1;
  }

  .member-name {
    font-size: 16px;
    font-weight: 600;
    color: #111827;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .you-badge {
    font-size: 11px;
    padding: 2px 8px;
    background: #1e3a8a;
    color: #fff;
    border-radius: 10px;
  }

  .member-meta {
    margin-top: 4px;
  }

  .role-badge {
    font-size: 12px;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .role-badge.owner {
    background: #dbeafe;
    color: #1e3a8a;
  }

  .role-badge.member {
    background: rgba(100, 100, 100, 0.2);
    color: #6b7280;
  }

  .join-date {
    font-size: 12px;
    color: #9ca3af;
    margin-top: 4px;
  }

  .member-stats {
    text-align: center;
  }

  .stat-value {
    font-size: 18px;
    font-weight: 700;
    color: #111827;
  }

  .stat-label {
    font-size: 12px;
    color: #9ca3af;
    display: block;
  }

  .member-actions {
    margin-left: 16px;
  }

  .action-btn.remove {
    padding: 8px 16px;
    background: transparent;
    border: 1px solid #ef4444;
    border-radius: 8px;
    color: #ef4444;
    font-size: 13px;
    cursor: pointer;
  }

  .join-section, .leave-section {
    margin-top: 32px;
    text-align: center;
  }

  .join-btn {
    padding: 14px 40px;
    background: #1e3a8a;
    border: none;
    border-radius: 24px;
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
  }

  .leave-btn {
    padding: 12px 32px;
    background: transparent;
    border: 1px solid #666;
    border-radius: 24px;
    color: #6b7280;
    font-size: 14px;
    cursor: pointer;
  }

  .leave-btn:hover {
    border-color: #ef4444;
    color: #ef4444;
  }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }
`;
