"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getInsightById,
  addComment,
  listComments,
  deleteInsight,
  deleteComment,
  getHiddenComments,
  likeInsight,
  unlikeInsight,
  isInsightLiked,
  Comment,
  Insight
} from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const NAV_ITEMS = [
  { href: "/", labelZh: "首页", labelEn: "Home" },
  { href: "/discover", labelZh: "发现", labelEn: "Discover" },
  { href: "/rankings", labelZh: "球员排名", labelEn: "Rankings" },
  { href: "/league", labelZh: "公开联赛", labelEn: "Leagues" },
  { href: "/compare", labelZh: "球员对比", labelEn: "Compare" },
  { href: "/draft-guide", labelZh: "Fantasy新闻", labelEn: "Fantasy News" },
  { href: "/cheat-sheet", labelZh: "备忘单", labelEn: "Cheat Sheet" },
  { href: "/how-to-play", labelZh: "新手入门", labelEn: "How To Play" },
];

export default function DiscoverPostPage() {
  const { t, lang, setLang } = useLang();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState(() => getSessionUser());
  const [insight, setInsight] = useState<Insight | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hiddenComments, setHiddenComments] = useState(() => getHiddenComments());
  const [newComment, setNewComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiking, setIsLiking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [loginHovered, setLoginHovered] = useState(false);
  const [signupHovered, setSignupHovered] = useState(false);

  async function loadInsight() {
    const data = await getInsightById(id);
    if (data) {
      setInsight(data);
      setLikeCount(data.heat || 0);
      const commentsData = await listComments(id);
      setComments(commentsData);
      setLiked(isInsightLiked(id));
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadInsight(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const isAuthor = user && insight && insight.author_id === user.id;

  const getAuthorDisplayName = () => {
    if (!insight) return "Anonymous";
    return insight.author?.name || insight.author?.username || "Anonymous";
  };
  const getAuthorUsername = () => {
    if (!insight) return "";
    return insight.author?.username || "";
  };
  const getAuthorAvatar = () => {
    return insight?.author?.avatar_url || null;
  };

  const allImages = insight?.images || (insight?.cover_url ? [insight.cover_url] : []);

  const handleLike = async () => {
    if (!user) { alert(t("请先登录", "Please login first")); return; }
    if (isLiking) return;
    setIsLiking(true);
    if (liked) {
      setLiked(false);
      setLikeCount(prev => Math.max(0, prev - 1));
      const res = await unlikeInsight(id);
      if (!res.ok) { setLiked(true); setLikeCount(prev => prev + 1); }
    } else {
      setLiked(true);
      setLikeCount(prev => prev + 1);
      const res = await likeInsight(id);
      if (!res.ok) { setLiked(false); setLikeCount(prev => Math.max(0, prev - 1)); }
    }
    setIsLiking(false);
  };

  const handleDeletePost = async () => {
    if (!isAuthor) return;
    setDeletingPost(true);
    const res = await deleteInsight(id);
    if (res.ok) {
      router.push("/discover");
    } else {
      alert(res.error || t("删除失败", "Delete failed"));
      setDeletingPost(false);
      setShowDeleteModal(false);
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert(t("请先登录", "Please login first")); return; }
    if (!newComment.trim()) return;
    const result = await addComment(id, newComment.trim());
    if (result.ok && result.comment) {
      setComments([...comments, result.comment]);
      setNewComment("");
    }
  };

  const handleDeleteComment = async (commentId: string, commentAuthorId: string) => {
    if (!user) return;
    const isCommentAuthor = user.id === commentAuthorId;
    const confirmMsg = isCommentAuthor
      ? t("确定删除这条评论吗？删除后所有人都看不到", "Delete this comment? It will be removed for everyone.")
      : t("确定隐藏这条评论吗？只有你看不到", "Hide this comment? Only you won't see it.");
    if (!confirm(confirmMsg)) return;
    const res = await deleteComment(commentId, commentAuthorId);
    if (res.ok) {
      if (res.type === "deleted") {
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        setHiddenComments([...hiddenComments, commentId]);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("bp_session");
    setUser(null);
    window.location.href = "/";
  };

  const visibleComments = comments.filter(c => !hiddenComments.includes(c.id));

  const formatDate = (dateStr: string) => {
    const normalized = dateStr.includes("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z";
    const date = new Date(normalized);
    const now = new Date();
    const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 0) return t("刚刚", "just now");
    if (days === 1) return t("昨天", "Yesterday");
    if (days < 7) return `${days} ${t("天前", "days ago")}`;
    return date.toLocaleDateString();
  };

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>

      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "rgba(255,255,255,0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e2e8f0",
      }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto", padding: "0 24px",
          height: 64, display: "flex", alignItems: "center", gap: 32,
        }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
          </Link>
          <nav style={{ display: "flex", gap: 2, flex: 1, overflow: "hidden" }}>
            {NAV_ITEMS.map(item => (
              <Link key={item.href} href={item.href} style={{
                padding: "7px 13px", borderRadius: 8, fontSize: 14, fontWeight: 500,
                color: "#64748b", background: "transparent", textDecoration: "none", whiteSpace: "nowrap",
              }}>
                {lang === "zh" ? item.labelZh : item.labelEn}
              </Link>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
              中 / EN
            </button>
            {!user ? (
              <>
                <Link href="/auth/login" onMouseEnter={() => setLoginHovered(true)} onMouseLeave={() => setLoginHovered(false)}
                  style={{ padding: "8px 18px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#374151", textDecoration: "none", background: loginHovered ? "#f8fafc" : "#fff", transition: "background 0.15s" }}>
                  {t("登录", "Login")}
                </Link>
                <Link href="/auth/signup" onMouseEnter={() => setSignupHovered(true)} onMouseLeave={() => setSignupHovered(false)}
                  style={{ padding: "8px 20px", background: signupHovered ? "#1e40af" : "#1e3a8a", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none", transition: "background 0.15s" }}>
                  {t("注册", "Sign Up")}
                </Link>
              </>
            ) : (
              <>
                <Link href={`/u/${user.username}`} style={{ fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500, padding: "8px 4px" }}>{user.name || user.username}</Link>
                <button onClick={handleLogout} style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>
                  {t("退出", "Logout")}
                </button>
              </>
            )}
          </div>
        </div>

      </header>

      {loading ? (
        <div style={{ maxWidth: 1100, margin: "60px auto", padding: "0 24px", textAlign: "center", color: "#94a3b8" }}>
          <p>{t("加载中...", "Loading...")}</p>
        </div>
      ) : !insight ? (
        <div style={{ maxWidth: 480, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ width: 64, height: 64, background: "#f1f5f9", borderRadius: 16, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, background: "#e2e8f0", borderRadius: 8 }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("内容不存在", "Content Not Found")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>{t("该内容可能已被删除", "This content may have been deleted")}</p>
          <Link href="/discover" style={{ display: "inline-block", padding: "12px 24px", background: "#1e3a8a", color: "#fff", fontWeight: 600, borderRadius: 8, textDecoration: "none" }}>
            {t("返回发现", "Back to Discover")}
          </Link>
        </div>
      ) : (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
          {/* Back link */}
          <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#64748b", textDecoration: "none", marginBottom: 20, fontWeight: 500 }}>
            ← {t("返回发现", "Back to Discover")}
          </Link>

          <div style={{
            background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06)", overflow: "hidden",
            display: "grid", gridTemplateColumns: "1fr 400px",
          }}>
            {/* Left: image viewer */}
            <div style={{ background: "#f8fafc", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
              {allImages.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ aspectRatio: "4/5", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", overflow: "hidden" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={allImages[currentImageIndex]} alt={insight.title} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }} />
                  </div>

                  {allImages.length > 1 && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, padding: "12px", borderTop: "1px solid #e2e8f0" }}>
                        <button
                          onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                          disabled={currentImageIndex === 0}
                          style={{ width: 36, height: 36, border: "1.5px solid #e2e8f0", borderRadius: "50%", background: "#fff", color: "#374151", fontSize: 16, cursor: currentImageIndex === 0 ? "not-allowed" : "pointer", opacity: currentImageIndex === 0 ? 0.3 : 1, fontFamily: FONT }}
                        >←</button>
                        <span style={{ fontSize: 13, color: "#94a3b8" }}>{currentImageIndex + 1} / {allImages.length}</span>
                        <button
                          onClick={() => setCurrentImageIndex(i => Math.min(allImages.length - 1, i + 1))}
                          disabled={currentImageIndex === allImages.length - 1}
                          style={{ width: 36, height: 36, border: "1.5px solid #e2e8f0", borderRadius: "50%", background: "#fff", color: "#374151", fontSize: 16, cursor: currentImageIndex === allImages.length - 1 ? "not-allowed" : "pointer", opacity: currentImageIndex === allImages.length - 1 ? 0.3 : 1, fontFamily: FONT }}
                        >→</button>
                      </div>
                      <div style={{ display: "flex", gap: 8, padding: "0 12px 12px", overflowX: "auto" }}>
                        {allImages.map((img, idx) => (
                          <button key={idx} onClick={() => setCurrentImageIndex(idx)} style={{
                            width: 60, height: 60,
                            border: `2px solid ${idx === currentImageIndex ? "#1e3a8a" : "#e2e8f0"}`,
                            borderRadius: 8, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", flexShrink: 0,
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img} alt={`${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ aspectRatio: "4/5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 80, height: 80, background: "#e2e8f0", borderRadius: 20 }} />
                </div>
              )}
            </div>

            {/* Right: content */}
            <div style={{ display: "flex", flexDirection: "column", padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
              {/* Author */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
                <Link href={`/u/${getAuthorUsername()}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
                  {getAuthorAvatar() ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getAuthorAvatar()!} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {getAuthorDisplayName()[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{getAuthorDisplayName()}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(insight.created_at)}</div>
                  </div>
                </Link>

                {isAuthor && (
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    title={t("删除帖子", "Delete Post")}
                    style={{ background: "none", border: "none", fontSize: 14, cursor: "pointer", opacity: 0.5, padding: "8px 12px", color: "#64748b", fontWeight: 600, fontFamily: FONT }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
                  >{t("删除", "Delete")}</button>
                )}
              </div>

              {/* Title & body */}
              <div style={{ flex: 1, marginBottom: 16 }}>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: "#0f172a", margin: "0 0 12px", lineHeight: 1.4 }}>{insight.title}</h1>

                {insight.body && insight.body.trim() && (
                  <div style={{ color: "#374151", fontSize: 14, lineHeight: 1.75 }}>
                    {insight.body.split("\n").map((p, i) =>
                      p.trim() ? <p key={i} style={{ margin: "0 0 10px" }}>{p}</p> : <br key={i} />
                    )}
                  </div>
                )}

                {insight.tags && insight.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
                    {insight.tags.map(tag => (
                      <span key={tag} style={{ padding: "4px 12px", background: "#eff6ff", color: "#1e3a8a", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Like / comment counts */}
              <div style={{ display: "flex", gap: 12, padding: "14px 0", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
                <button
                  onClick={handleLike}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: liked ? "#fef2f2" : "#f8fafc",
                    border: `1.5px solid ${liked ? "#fecaca" : "#e2e8f0"}`,
                    borderRadius: 8, color: liked ? "#dc2626" : "#64748b",
                    fontSize: 14, cursor: "pointer", padding: "8px 14px",
                    fontFamily: FONT, fontWeight: 600, transition: "all 0.15s",
                  }}
                >
                  <div style={{ width: 14, height: 14, background: liked ? "#dc2626" : "#cbd5e1", borderRadius: "50%", flexShrink: 0 }} />
                  <span>{likeCount}</span>
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#64748b", fontSize: 14, fontWeight: 600 }}>
                  <div style={{ width: 14, height: 14, background: "#cbd5e1", borderRadius: 3, flexShrink: 0 }} />
                  <span>{visibleComments.length}</span>
                </div>
              </div>

              {/* Comments */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", margin: "0 0 14px" }}>
                  {t("评论", "Comments")} ({visibleComments.length})
                </h3>

                <form onSubmit={handleComment} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder={user ? t("说点什么...", "Say something...") : t("登录后评论", "Login to comment")}
                    disabled={!user}
                    style={{
                      flex: 1, padding: "10px 14px", background: "#f8fafc",
                      border: "1.5px solid #e2e8f0", borderRadius: 20, color: "#374151",
                      fontSize: 13, outline: "none", fontFamily: FONT,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!user || !newComment.trim()}
                    style={{
                      padding: "10px 18px",
                      background: !user || !newComment.trim() ? "#e2e8f0" : "#1e3a8a",
                      border: "none", borderRadius: 20,
                      color: !user || !newComment.trim() ? "#94a3b8" : "#fff",
                      fontWeight: 600, fontSize: 13,
                      cursor: !user || !newComment.trim() ? "not-allowed" : "pointer",
                      fontFamily: FONT, transition: "all 0.15s",
                    }}
                  >
                    {t("发送", "Send")}
                  </button>
                </form>

                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {visibleComments.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px", color: "#94a3b8", fontSize: 13 }}>
                      {t("还没有评论", "No comments yet")}
                    </div>
                  ) : (
                    visibleComments.map(comment => {
                      const commentAuthor = comment.author?.name || comment.author?.username || "Anonymous";
                      const commentAvatar = comment.author?.avatar_url;
                      const isCommentAuthor = user && user.id === comment.author_id;
                      return (
                        <div key={comment.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                          {commentAvatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={commentAvatar} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              {commentAuthor[0]?.toUpperCase()}
                            </div>
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, color: "#0f172a", fontSize: 13 }}>{commentAuthor}</span>
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>{formatDate(comment.created_at)}</span>
                            </div>
                            <p style={{ color: "#374151", fontSize: 13, lineHeight: 1.55, margin: 0, wordBreak: "break-word" }}>{comment.body}</p>
                          </div>
                          {user && (
                            <button
                              onClick={() => handleDeleteComment(comment.id, comment.author_id)}
                              title={isCommentAuthor ? t("删除评论", "Delete") : t("隐藏评论", "Hide")}
                              style={{ background: "none", border: "none", fontSize: 11, cursor: "pointer", padding: "4px 8px", opacity: 0, transition: "opacity 0.2s", color: "#94a3b8", fontFamily: FONT }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; }}
                            >
                              {isCommentAuthor ? t("删除", "del") : t("隐藏", "hide")}
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete modal */}
      {showDeleteModal && (
        <div
          onClick={() => setShowDeleteModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 20, padding: 28, maxWidth: 400, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}
          >
            <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: "0 0 10px" }}>{t("确认删除", "Confirm Delete")}</h3>
            <p style={{ color: "#64748b", fontSize: 14, margin: "0 0 24px" }}>{t("确定要删除这篇笔记吗？此操作无法撤销。", "Are you sure you want to delete this post? This cannot be undone.")}</p>
            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deletingPost}
                style={{ padding: "10px 20px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#64748b", cursor: "pointer", fontFamily: FONT, fontSize: 14, fontWeight: 600 }}
              >
                {t("取消", "Cancel")}
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deletingPost}
                style={{ padding: "10px 20px", background: "#dc2626", border: "none", borderRadius: 8, color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: FONT, fontSize: 14, opacity: deletingPost ? 0.5 : 1 }}
              >
                {deletingPost ? t("删除中...", "Deleting...") : t("确认删除", "Delete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
