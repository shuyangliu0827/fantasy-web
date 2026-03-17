"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
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

export default function InsightDetailPage() {
  const { t } = useLang();
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [hiddenComments, setHiddenComments] = useState<string[]>([]);
  const [newComment, setNewComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const currentUser = getSessionUser();
    setUser(currentUser);
    setHiddenComments(getHiddenComments());
    loadInsight();
  }, [id]);

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

  const isAuthor = user && insight && insight.author_id === user.id;

  const getAuthorName = () => {
    if (!insight) return "Anonymous";
    if (insight.author?.username) return insight.author.username;
    if (insight.author?.name) return insight.author.name;
    return "Anonymous";
  };

  const allImages = insight?.images || (insight?.cover_url ? [insight.cover_url] : []);

  const handleLike = async () => {
    if (!user) { alert(t("请先登录", "Please login first")); return; }
    if (liked) {
      const res = await unlikeInsight(id);
      if (res.ok) { setLiked(false); setLikeCount(prev => Math.max(0, prev - 1)); }
    } else {
      const res = await likeInsight(id);
      if (res.ok) { setLiked(true); setLikeCount(prev => prev + 1); }
    }
  };

  const handleDeletePost = async () => {
    if (!isAuthor) return;
    setDeletingPost(true);
    const res = await deleteInsight(id);
    if (res.ok) {
      router.push("/insights");
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

  const visibleComments = comments.filter(c => !hiddenComments.includes(c.id));

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return t("今天", "Today");
    if (days === 1) return t("昨天", "Yesterday");
    if (days < 7) return `${days} ${t("天前", "days ago")}`;
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <Header />
        <div style={{ maxWidth: 1100, margin: "60px auto", padding: "0 24px", textAlign: "center", color: "#94a3b8" }}>
          <p>{t("加载中...", "Loading...")}</p>
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <Header />
        <div style={{ maxWidth: 480, margin: "100px auto", padding: "0 24px", textAlign: "center" }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>😕</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("内容不存在", "Content Not Found")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 24px" }}>{t("该内容可能已被删除", "This content may have been deleted")}</p>
          <Link href="/insights" style={{ display: "inline-block", padding: "12px 24px", background: "#1e3a8a", color: "#fff", fontWeight: 600, borderRadius: 8, textDecoration: "none" }}>
            {t("返回列表", "Back to Feed")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
      <Header />

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Back link */}
        <Link href="/insights" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14, color: "#64748b", textDecoration: "none", marginBottom: 20, fontWeight: 500 }}>
          ← {t("返回球探报告", "Back to Feed")}
        </Link>

        <div style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: "1fr 400px",
        }}>
          {/* Left: image viewer */}
          <div style={{ background: "#f8fafc", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column" }}>
            {allImages.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {/* Main image */}
                <div style={{ aspectRatio: "4/5", display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9", overflow: "hidden" }}>
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
                          borderRadius: 8,
                          overflow: "hidden",
                          cursor: "pointer",
                          padding: 0,
                          background: "none",
                          flexShrink: 0,
                        }}>
                          <img src={img} alt={`${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ aspectRatio: "4/5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 80, opacity: 0.2 }}>
                🏀
              </div>
            )}
          </div>

          {/* Right: content */}
          <div style={{ display: "flex", flexDirection: "column", padding: 24, maxHeight: "80vh", overflowY: "auto" }}>
            {/* Author */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 16, borderBottom: "1px solid #f1f5f9", marginBottom: 16 }}>
              <Link href={`/u/${getAuthorName()}`} style={{ display: "flex", alignItems: "center", gap: 12, textDecoration: "none", color: "inherit" }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {getAuthorName()[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: "#0f172a", fontSize: 14 }}>{getAuthorName()}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>{formatDate(insight.created_at)}</div>
                </div>
              </Link>

              {isAuthor && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  title={t("删除帖子", "Delete Post")}
                  style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", opacity: 0.5, padding: 8 }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.5"; }}
                >🗑️</button>
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
                  borderRadius: 8,
                  color: liked ? "#dc2626" : "#64748b",
                  fontSize: 14,
                  cursor: "pointer",
                  padding: "8px 14px",
                  fontFamily: FONT,
                  fontWeight: 600,
                  transition: "all 0.15s",
                }}
              >
                <span>{liked ? "❤️" : "🤍"}</span>
                <span>{likeCount}</span>
              </button>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#64748b", fontSize: 14, fontWeight: 600 }}>
                <span>💬</span>
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
                    flex: 1,
                    padding: "10px 14px",
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 20,
                    color: "#374151",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: FONT,
                  }}
                />
                <button
                  type="submit"
                  disabled={!user || !newComment.trim()}
                  style={{
                    padding: "10px 18px",
                    background: !user || !newComment.trim() ? "#e2e8f0" : "#1e3a8a",
                    border: "none",
                    borderRadius: 20,
                    color: !user || !newComment.trim() ? "#94a3b8" : "#fff",
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: !user || !newComment.trim() ? "not-allowed" : "pointer",
                    fontFamily: FONT,
                    transition: "all 0.15s",
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
                    const commentAuthor = comment.author?.username || comment.author?.name || "Anonymous";
                    const isCommentAuthor = user && user.id === comment.author_id;
                    return (
                      <div key={comment.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          {commentAuthor[0]?.toUpperCase()}
                        </div>
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
                            style={{ background: "none", border: "none", fontSize: 13, cursor: "pointer", padding: 4, opacity: 0, transition: "opacity 0.2s" }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "0"; }}
                          >
                            {isCommentAuthor ? "🗑️" : "👁️‍🗨️"}
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
