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
      
      // 检查是否已点赞（使用新函数）
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

  // 点赞
  const handleLike = async () => {
    if (!user) {
      alert(t("请先登录", "Please login first"));
      return;
    }
    
    if (liked) {
      // 取消点赞
      const res = await unlikeInsight(id);
      if (res.ok) {
        setLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
      }
    } else {
      // 点赞
      const res = await likeInsight(id);
      if (res.ok) {
        setLiked(true);
        setLikeCount(prev => prev + 1);
      }
    }
  };

  // 删除帖子
  const handleDeletePost = async () => {
    if (!isAuthor) return;
    
    setDeletingPost(true);
    const res = await deleteInsight(id);
    
    if (res.ok) {
      router.push("/");
    } else {
      alert(res.error || "删除失败");
      setDeletingPost(false);
      setShowDeleteModal(false);
    }
  };

  // 发表评论
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      alert(t("请先登录", "Please login first"));
      return;
    }
    if (!newComment.trim()) return;

    const result = await addComment(id, newComment.trim());

    if (result.ok && result.comment) {
      setComments([...comments, result.comment]);
      setNewComment("");
    }
  };

  // 删除评论
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
        // 真正删除了，从列表移除
        setComments(comments.filter(c => c.id !== commentId));
      } else {
        // 只是隐藏，更新隐藏列表
        setHiddenComments([...hiddenComments, commentId]);
      }
    }
  };

  // 过滤掉隐藏的评论
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
      <div className="app">
        <Header />
        <main className="detail-page">
          <div className="loading">
            <p>{t("加载中...", "Loading...")}</p>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="app">
        <Header />
        <main className="detail-page">
          <div className="not-found">
            <div className="icon">😕</div>
            <h2>{t("内容不存在", "Content Not Found")}</h2>
            <p>{t("该内容可能已被删除", "This content may have been deleted")}</p>
            <Link href="/" className="back-btn">{t("返回首页", "Back to Home")}</Link>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="detail-page">
        <div className="container">
          {/* 左侧：图片区 */}
          <div className="left-panel">
            {allImages.length > 0 ? (
              <div className="image-viewer">
                <div className="main-image">
                  <img src={allImages[currentImageIndex]} alt={insight.title} />
                </div>
                
                {allImages.length > 1 && (
                  <>
                    <div className="image-nav">
                      <button 
                        onClick={() => setCurrentImageIndex(i => Math.max(0, i - 1))}
                        disabled={currentImageIndex === 0}
                        className="nav-btn prev"
                      >
                        ←
                      </button>
                      <span className="image-counter">
                        {currentImageIndex + 1} / {allImages.length}
                      </span>
                      <button 
                        onClick={() => setCurrentImageIndex(i => Math.min(allImages.length - 1, i + 1))}
                        disabled={currentImageIndex === allImages.length - 1}
                        className="nav-btn next"
                      >
                        →
                      </button>
                    </div>
                    
                    <div className="thumbnails">
                      {allImages.map((img, idx) => (
                        <button
                          key={idx}
                          className={`thumb ${idx === currentImageIndex ? "active" : ""}`}
                          onClick={() => setCurrentImageIndex(idx)}
                        >
                          <img src={img} alt={`${idx + 1}`} />
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="no-image">
                <span>🏀</span>
              </div>
            )}
          </div>

          {/* 右侧：内容区 */}
          <div className="right-panel">
            {/* 作者信息 */}
            <div className="author-section">
              <Link href={`/u/${getAuthorName()}`} className="author-info">
                <div className="avatar">{getAuthorName()[0]?.toUpperCase()}</div>
                <div className="author-details">
                  <span className="name">{getAuthorName()}</span>
                  <span className="date">{formatDate(insight.created_at)}</span>
                </div>
              </Link>
              
              {isAuthor && (
                <button 
                  className="delete-post-btn"
                  onClick={() => setShowDeleteModal(true)}
                  title={t("删除帖子", "Delete Post")}
                >
                  🗑️
                </button>
              )}
            </div>

            {/* 标题和内容 */}
            <div className="content-section">
              <h1 className="title">{insight.title}</h1>
              
              {insight.body && insight.body.trim() && (
                <div className="body">
                  {insight.body.split("\n").map((p, i) => (
                    p.trim() ? <p key={i}>{p}</p> : <br key={i} />
                  ))}
                </div>
              )}
              
              {insight.tags && insight.tags.length > 0 && (
                <div className="tags">
                  {insight.tags.map(tag => (
                    <span key={tag} className="tag">#{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* 互动区 */}
            <div className="actions-section">
              <button 
                className={`action-btn ${liked ? "liked" : ""}`}
                onClick={handleLike}
              >
                <span>{liked ? "❤️" : "🤍"}</span>
                <span>{likeCount}</span>
              </button>
              <button className="action-btn">
                <span>💬</span>
                <span>{visibleComments.length}</span>
              </button>
            </div>

            {/* 评论区 */}
            <div className="comments-section">
              <h3 className="comments-title">
                {t("评论", "Comments")} ({visibleComments.length})
              </h3>

              {/* 发表评论 */}
              <form className="comment-form" onSubmit={handleComment}>
                <input
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={user ? t("说点什么...", "Say something...") : t("登录后评论", "Login to comment")}
                  disabled={!user}
                />
                <button type="submit" disabled={!user || !newComment.trim()}>
                  {t("发送", "Send")}
                </button>
              </form>

              {/* 评论列表 */}
              <div className="comments-list">
                {visibleComments.length === 0 ? (
                  <div className="no-comments">
                    <p>{t("还没有评论", "No comments yet")}</p>
                  </div>
                ) : (
                  visibleComments.map(comment => {
                    const commentAuthor = comment.author?.username || comment.author?.name || "Anonymous";
                    const isCommentAuthor = user && user.id === comment.author_id;
                    
                    return (
                      <div key={comment.id} className="comment-item">
                        <div className="comment-avatar">
                          {commentAuthor[0]?.toUpperCase()}
                        </div>
                        <div className="comment-content">
                          <div className="comment-header">
                            <span className="comment-author">{commentAuthor}</span>
                            <span className="comment-date">{formatDate(comment.created_at)}</span>
                          </div>
                          <p className="comment-body">{comment.body}</p>
                        </div>
                        {user && (
                          <button
                            className="delete-comment-btn"
                            onClick={() => handleDeleteComment(comment.id, comment.author_id)}
                            title={isCommentAuthor ? t("删除评论", "Delete") : t("隐藏评论", "Hide")}
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

        {/* 删除确认弹窗 */}
        {showDeleteModal && (
          <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <h3>{t("确认删除", "Confirm Delete")}</h3>
              <p>{t("确定要删除这篇笔记吗？此操作无法撤销。", "Are you sure you want to delete this post? This cannot be undone.")}</p>
              <div className="modal-actions">
                <button 
                  className="cancel-btn"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={deletingPost}
                >
                  {t("取消", "Cancel")}
                </button>
                <button 
                  className="confirm-btn"
                  onClick={handleDeletePost}
                  disabled={deletingPost}
                >
                  {deletingPost ? t("删除中...", "Deleting...") : t("确认删除", "Delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .detail-page {
    min-height: 100vh;
    background: #0a0a0a;
    padding: 24px 16px;
  }

  .container {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr 400px;
    gap: 24px;
    background: #111;
    border: 1px solid #1a1a1a;
    border-radius: 16px;
    overflow: hidden;
  }

  /* 左侧图片区 */
  .left-panel {
    background: #000;
    display: flex;
    flex-direction: column;
  }

  .image-viewer {
    display: flex;
    flex-direction: column;
  }

  .main-image {
    aspect-ratio: 4/5;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }

  .main-image img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  .image-nav {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 12px;
    background: #111;
  }

  .nav-btn {
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 50%;
    background: #222;
    color: #fff;
    font-size: 16px;
    cursor: pointer;
  }

  .nav-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .nav-btn:hover:not(:disabled) {
    background: #333;
  }

  .image-counter {
    font-size: 14px;
    color: #888;
  }

  .thumbnails {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: #111;
    overflow-x: auto;
  }

  .thumb {
    width: 60px;
    height: 60px;
    border: 2px solid transparent;
    border-radius: 8px;
    overflow: hidden;
    cursor: pointer;
    padding: 0;
    background: none;
  }

  .thumb.active {
    border-color: #f59e0b;
  }

  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .no-image {
    aspect-ratio: 4/5;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 80px;
    opacity: 0.2;
  }

  /* 右侧内容区 */
  .right-panel {
    display: flex;
    flex-direction: column;
    padding: 24px;
    max-height: 80vh;
    overflow-y: auto;
  }

  .author-section {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    border-bottom: 1px solid #222;
    margin-bottom: 16px;
  }

  .author-info {
    display: flex;
    align-items: center;
    gap: 12px;
    text-decoration: none;
    color: inherit;
  }

  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .author-details {
    display: flex;
    flex-direction: column;
  }

  .author-details .name {
    font-weight: 600;
    color: #fff;
  }

  .author-details .date {
    font-size: 12px;
    color: #666;
  }

  .delete-post-btn {
    background: none;
    border: none;
    font-size: 20px;
    cursor: pointer;
    padding: 8px;
    opacity: 0.5;
    transition: opacity 0.2s;
  }

  .delete-post-btn:hover {
    opacity: 1;
  }

  .content-section {
    flex: 1;
    margin-bottom: 16px;
  }

  .title {
    font-size: 20px;
    font-weight: 700;
    color: #fff;
    margin: 0 0 12px 0;
    line-height: 1.4;
  }

  .body {
    color: #ccc;
    font-size: 15px;
    line-height: 1.7;
  }

  .body p {
    margin: 0 0 12px 0;
  }

  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }

  .tag {
    padding: 4px 12px;
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border-radius: 16px;
    font-size: 13px;
  }

  .actions-section {
    display: flex;
    gap: 16px;
    padding: 16px 0;
    border-top: 1px solid #222;
    border-bottom: 1px solid #222;
    margin-bottom: 16px;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    background: none;
    border: none;
    color: #888;
    font-size: 15px;
    cursor: pointer;
    padding: 8px 12px;
    border-radius: 8px;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #1a1a1a;
  }

  .action-btn.liked {
    color: #ef4444;
  }

  /* 评论区 */
  .comments-section {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .comments-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    margin: 0 0 16px 0;
  }

  .comment-form {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }

  .comment-form input {
    flex: 1;
    padding: 12px 16px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 24px;
    color: #fff;
    font-size: 14px;
    outline: none;
  }

  .comment-form input:focus {
    border-color: #f59e0b;
  }

  .comment-form button {
    padding: 12px 20px;
    background: #f59e0b;
    border: none;
    border-radius: 24px;
    color: #000;
    font-weight: 600;
    cursor: pointer;
  }

  .comment-form button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .comments-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .no-comments {
    text-align: center;
    padding: 32px;
    color: #666;
  }

  .comment-item {
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .comment-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .comment-content {
    flex: 1;
    min-width: 0;
  }

  .comment-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
  }

  .comment-author {
    font-weight: 500;
    color: #fff;
    font-size: 14px;
  }

  .comment-date {
    font-size: 12px;
    color: #666;
  }

  .comment-body {
    color: #ccc;
    font-size: 14px;
    line-height: 1.5;
    margin: 0;
    word-break: break-word;
  }

  .delete-comment-btn {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 4px;
    opacity: 0;
    transition: opacity 0.2s;
  }

  .comment-item:hover .delete-comment-btn {
    opacity: 0.5;
  }

  .delete-comment-btn:hover {
    opacity: 1 !important;
  }

  /* 弹窗 */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal {
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
  }

  .modal h3 {
    font-size: 18px;
    color: #fff;
    margin: 0 0 12px 0;
  }

  .modal p {
    color: #888;
    font-size: 14px;
    margin: 0 0 24px 0;
  }

  .modal-actions {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
  }

  .cancel-btn {
    padding: 10px 20px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 8px;
    color: #888;
    cursor: pointer;
  }

  .confirm-btn {
    padding: 10px 20px;
    background: #ef4444;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-weight: 600;
    cursor: pointer;
  }

  .confirm-btn:disabled {
    opacity: 0.5;
  }

  /* 加载和错误状态 */
  .loading, .not-found {
    text-align: center;
    padding: 80px 20px;
  }

  .not-found .icon {
    font-size: 64px;
    margin-bottom: 16px;
  }

  .not-found h2 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .not-found p {
    color: #666;
    margin: 0 0 24px 0;
  }

  .back-btn {
    display: inline-block;
    padding: 12px 24px;
    background: #f59e0b;
    color: #000;
    font-weight: 600;
    border-radius: 8px;
    text-decoration: none;
  }

  /* 响应式 */
  @media (max-width: 800px) {
    .container {
      grid-template-columns: 1fr;
    }

    .right-panel {
      max-height: none;
    }
  }
`;