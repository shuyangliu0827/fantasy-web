"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  isLeagueMember,
  League,
  LeagueMember,
  supabase,
} from "@/lib/store";

type Message = {
  id: string;
  user_id: string;
  title: string | null;
  body: string;
  is_pinned: boolean;
  created_at: string;
  user?: { name: string; username: string };
};

export default function BoardPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const membersData = await getLeagueMembers(leagueData.id);
      setMembers(membersData);
      const memberStatus = await isLeagueMember(leagueData.id);
      setIsMember(memberStatus);

      // 加载消息
      const { data } = await supabase
        .from("league_messages")
        .select("*")
        .eq("league_id", leagueData.id)
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (data) {
        // 关联用户信息
        const { data: users } = await supabase.from("users").select("id, name, username");
        const messagesWithUsers = data.map(msg => ({
          ...msg,
          user: users?.find(u => u.id === msg.user_id),
        }));
        setMessages(messagesWithUsers);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function handlePost() {
    if (!user || !league) return;
    if (!newBody.trim()) return;

    setPosting(true);

    const { data, error } = await supabase
      .from("league_messages")
      .insert({
        league_id: league.id,
        user_id: user.id,
        title: newTitle.trim() || null,
        body: newBody.trim(),
      })
      .select()
      .single();

    if (!error && data) {
      setMessages([{ ...data, user: { name: user.name, username: user.username } }, ...messages]);
      setNewTitle("");
      setNewBody("");
      setShowNewPost(false);
    }

    setPosting(false);
  }

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

  const formatTime = (dateStr: string) => {
    const normalized = dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    if (diff < 0) return t("刚刚", "just now");
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (mins < 60) return `${mins}${t("分钟前", "m ago")}`;
    if (hours < 24) return `${hours}${t("小时前", "h ago")}`;
    if (days < 7) return `${days}${t("天前", "d ago")}`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="app">
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
      <div className="app">
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
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
            <h1> {t("讨论区", "Message Board")}</h1>
            {isMember && (
              <button className="new-post-btn" onClick={() => setShowNewPost(true)}>
                + {t("发布帖子", "New Post")}
              </button>
            )}
          </div>

          {/* 新帖子表单 */}
          {showNewPost && (
            <div className="new-post-form">
              <input
                type="text"
                placeholder={t("标题（可选）", "Title (optional)")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="post-title-input"
              />
              <textarea
                placeholder={t("写点什么...", "Write something...")}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                className="post-body-input"
                rows={4}
              />
              <div className="post-actions">
                <button className="cancel-btn" onClick={() => setShowNewPost(false)}>
                  {t("取消", "Cancel")}
                </button>
                <button 
                  className="submit-btn" 
                  onClick={handlePost}
                  disabled={posting || !newBody.trim()}
                >
                  {posting ? t("发布中...", "Posting...") : t("发布", "Post")}
                </button>
              </div>
            </div>
          )}

          {/* 消息列表 */}
          <div className="messages-list">
            {messages.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>{t("还没有帖子", "No messages yet")}</h3>
                <p>{t("成为第一个发言的人吧！", "Be the first to post!")}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`message-card ${msg.is_pinned ? "pinned" : ""}`}>
                  {msg.is_pinned && (
                    <div className="pinned-badge"> {t("置顶", "Pinned")}</div>
                  )}
                  <div className="message-header">
                    <div className="author-info">
                      <span className="author-avatar">
                        {(msg.user?.username || msg.user?.name || "A")[0]?.toUpperCase()}
                      </span>
                      <span className="author-name">{msg.user?.username || msg.user?.name || "Anonymous"}</span>
                    </div>
                    <span className="message-time">{formatTime(msg.created_at)}</span>
                  </div>
                  {msg.title && <h3 className="message-title">{msg.title}</h3>}
                  <p className="message-body">{msg.body}</p>
                  <div className="message-footer">
                    <button className="reply-btn"> {t("回复", "Reply")}</button>
                  </div>
                </div>
              ))
            )}
          </div>
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

  .container { max-width: 800px; margin: 0 auto; }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    margin: 0;
  }

  .new-post-btn {
    padding: 10px 20px;
    background: #1e3a8a;
    border: none;
    border-radius: 20px;
    color: #000;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
  }

  .new-post-btn:hover { background: #fbbf24; }

  .new-post-form {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
    margin-bottom: 24px;
  }

  .post-title-input, .post-body-input {
    width: 100%;
    padding: 12px 16px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    margin-bottom: 12px;
    resize: none;
  }

  .post-title-input:focus, .post-body-input:focus {
    outline: none;
    border-color: #1e3a8a;
  }

  .post-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
  }

  .cancel-btn {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #6b7280;
    cursor: pointer;
  }

  .submit-btn {
    padding: 10px 24px;
    background: #1e3a8a;
    border: none;
    border-radius: 8px;
    color: #000;
    font-weight: 600;
    cursor: pointer;
  }

  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .messages-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .message-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 20px;
  }

  .message-card.pinned {
    border-color: #1e3a8a;
    background: #f8fafc;
  }

  .pinned-badge {
    font-size: 12px;
    color: #1e3a8a;
    margin-bottom: 12px;
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .author-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #000;
    font-size: 14px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .author-name {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
  }

  .message-time {
    font-size: 12px;
    color: #9ca3af;
  }

  .message-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .message-body {
    font-size: 14px;
    color: #374151;
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
  }

  .message-footer {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid #e5e7eb;
  }

  .reply-btn {
    background: none;
    border: none;
    color: #6b7280;
    font-size: 13px;
    cursor: pointer;
  }

  .reply-btn:hover { color: #1e3a8a; }

  .empty-state {
    text-align: center;
    padding: 60px 20px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  .empty-icon { font-size: 48px; margin-bottom: 16px; }
  .empty-state h3 { font-size: 18px; color: #fff; margin: 0 0 8px 0; }
  .empty-state p { font-size: 14px; color: #6b7280; margin: 0; }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }
`;
