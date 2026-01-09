"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getSessionUser, createInsight, listLeagues } from "@/lib/store";

export default function NewInsightPage() {
  const { t } = useLang();
  const router = useRouter();
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [leagueSlug, setLeagueSlug] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]); // 多张配图
  const [loading, setLoading] = useState(false);
  const [leagues, setLeagues] = useState<{ slug: string; name: string }[]>([]);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (u) {
      setLeagues(listLeagues().map(l => ({ slug: l.slug, name: l.name })));
    }
  }, []);

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert(t("图片大小不能超过5MB", "Image size cannot exceed 5MB"));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setCoverImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    if (images.length + files.length > 9) {
      alert(t("最多上传9张配图", "Maximum 9 images allowed"));
      return;
    }

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        alert(t(`图片 ${file.name} 超过5MB，已跳过`, `Image ${file.name} exceeds 5MB, skipped`));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImages(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag) && tags.length < 5) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!title.trim() || !body.trim()) {
      alert(t("请填写标题和内容", "Please fill in title and content"));
      return;
    }

    setLoading(true);

    const metadata = {
      coverImage,
      images,
      tags,
    };
    const bodyWithMeta = JSON.stringify({ content: body, metadata });

    const result = createInsight({
      title,
      body: bodyWithMeta,
      leagueSlug: leagueSlug || undefined,
    });

    if (result.ok) {
      router.push(`/insights/${result.insight?.id}`);
    } else {
      alert(result.error || t("发布失败", "Failed to publish"));
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="app">
        <Header />
        <main className="page-content" style={{ textAlign: "center", paddingTop: 100 }}>
          <h1 className="page-title">{t("需要登录", "Login Required")}</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>{t("请先登录后发布内容", "Please login to publish content")}</p>
          <Link href="/auth/login" className="btn btn-primary">{t("登录", "Login")}</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("发布洞见", "Share Your Insight")}</h1>
          <p className="page-desc">{t("分享你的 Fantasy 篮球策略和分析", "Share your Fantasy basketball strategies and analysis")}</p>
        </div>

        <form onSubmit={handleSubmit} className="insight-form">
          {/* Cover Image Upload */}
          <div className="form-section">
            <label className="form-label">{t("封面图片", "Cover Image")} <span className="optional">({t("可选", "Optional")})</span></label>
            <div 
              className="cover-upload"
              onClick={() => coverInputRef.current?.click()}
              style={{
                backgroundImage: coverImage ? `url(${coverImage})` : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {!coverImage && (
                <div className="upload-placeholder">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 40, height: 40, marginBottom: 8 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span>{t("点击上传封面图", "Click to upload cover image")}</span>
                  <span className="upload-hint">{t("推荐尺寸 16:9，最大 5MB", "Recommended 16:9 ratio, max 5MB")}</span>
                </div>
              )}
              {coverImage && (
                <button 
                  type="button" 
                  className="remove-cover"
                  onClick={(e) => { e.stopPropagation(); setCoverImage(null); }}
                >
                  ✕
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              onChange={handleCoverUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Title */}
          <div className="form-section">
            <label className="form-label">{t("标题", "Title")} *</label>
            <input
              className="form-input title-input"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("例如：为什么我在首轮放弃了 Tatum", "E.g., Why I passed on Tatum in round 1")}
              maxLength={100}
            />
            <div className="char-count">{title.length}/100</div>
          </div>

          {/* Body */}
          <div className="form-section">
            <label className="form-label">{t("内容", "Content")} *</label>
            <textarea
              className="form-input body-input"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t(
                "分享你的策略、分析或经验...\n\n支持使用 Markdown 格式",
                "Share your strategy, analysis or experience...\n\nMarkdown formatting supported"
              )}
              rows={12}
            />
          </div>

          {/* Multiple Images Upload */}
          <div className="form-section">
            <label className="form-label">{t("分析配图", "Analysis Images")} <span className="optional">({t("最多9张", "Max 9")})</span></label>
            <div className="images-grid">
              {images.map((img, index) => (
                <div key={index} className="image-item">
                  <img src={img} alt={`Image ${index + 1}`} />
                  <button type="button" className="remove-image" onClick={() => removeImage(index)}>✕</button>
                </div>
              ))}
              {images.length < 9 && (
                <div className="add-image" onClick={() => imagesInputRef.current?.click()}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 24, height: 24 }}>
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                  <span>{t("添加图片", "Add Image")}</span>
                </div>
              )}
            </div>
            <input
              ref={imagesInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImagesUpload}
              style={{ display: "none" }}
            />
          </div>

          {/* Tags */}
          <div className="form-section">
            <label className="form-label">{t("标签", "Tags")} <span className="optional">({t("最多5个", "Max 5")})</span></label>
            <div className="tags-input-container">
              <div className="tags-list">
                {tags.map(tag => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)}>✕</button>
                  </span>
                ))}
              </div>
              {tags.length < 5 && (
                <div className="tag-input-wrapper">
                  <input
                    className="form-input tag-input"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("输入标签后按回车", "Type tag and press Enter")}
                  />
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleAddTag}>
                    {t("添加", "Add")}
                  </button>
                </div>
              )}
            </div>
            <div className="suggested-tags">
              <span className="suggested-label">{t("热门标签:", "Popular:")}</span>
              {["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"].map(tag => (
                <button
                  key={tag}
                  type="button"
                  className="suggested-tag"
                  onClick={() => {
                    if (!tags.includes(tag) && tags.length < 5) {
                      setTags([...tags, tag]);
                    }
                  }}
                >
                  #{tag}
                </button>
              ))}
            </div>
          </div>

          {/* League Association */}
          <div className="form-section">
            <label className="form-label">{t("关联联赛", "Associate with League")} <span className="optional">({t("可选", "Optional")})</span></label>
            <select
              className="form-input"
              value={leagueSlug}
              onChange={(e) => setLeagueSlug(e.target.value)}
            >
              <option value="">{t("不关联联赛", "No league association")}</option>
              {leagues.map(league => (
                <option key={league.slug} value={league.slug}>{league.name}</option>
              ))}
            </select>
          </div>

          {/* Submit */}
          <div className="form-actions">
            <Link href="/" className="btn btn-ghost">{t("取消", "Cancel")}</Link>
            <button type="submit" className="btn btn-primary" disabled={loading || !title.trim() || !body.trim()}>
              {loading ? t("发布中...", "Publishing...") : t("发布", "Publish")}
            </button>
          </div>
        </form>
      </main>

      <style jsx>{`
        .insight-form {
          max-width: 700px;
          margin: 0 auto;
        }
        .form-section {
          margin-bottom: 24px;
        }
        .form-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .optional {
          font-weight: 400;
          color: var(--text-muted);
          font-size: 14px;
        }
        .cover-upload {
          width: 100%;
          height: 200px;
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
          position: relative;
          overflow: hidden;
        }
        .cover-upload:hover {
          border-color: var(--accent);
          background: rgba(245, 158, 11, 0.05);
        }
        .upload-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: var(--text-muted);
        }
        .upload-hint {
          font-size: 12px;
          margin-top: 4px;
        }
        .remove-cover, .remove-image {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(0,0,0,0.6);
          color: white;
          border: none;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .remove-cover:hover, .remove-image:hover {
          background: rgba(239, 68, 68, 0.8);
        }
        .title-input {
          font-size: 18px;
          font-weight: 600;
        }
        .char-count {
          text-align: right;
          font-size: 12px;
          color: var(--text-muted);
          margin-top: 4px;
        }
        .body-input {
          min-height: 250px;
          resize: vertical;
          line-height: 1.6;
        }
        .images-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }
        .image-item {
          position: relative;
          aspect-ratio: 1;
          border-radius: 8px;
          overflow: hidden;
        }
        .image-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .add-image {
          aspect-ratio: 1;
          border: 2px dashed var(--border-color);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .add-image:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .add-image span {
          font-size: 12px;
        }
        .tags-input-container {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 12px;
        }
        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-bottom: 8px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(245, 158, 11, 0.15);
          color: var(--accent);
          padding: 4px 10px;
          border-radius: 16px;
          font-size: 14px;
        }
        .tag-chip button {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          font-size: 12px;
          opacity: 0.7;
        }
        .tag-chip button:hover {
          opacity: 1;
        }
        .tag-input-wrapper {
          display: flex;
          gap: 8px;
        }
        .tag-input {
          flex: 1;
          margin: 0;
        }
        .suggested-tags {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: center;
        }
        .suggested-label {
          font-size: 13px;
          color: var(--text-muted);
        }
        .suggested-tag {
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 4px 10px;
          font-size: 13px;
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .suggested-tag:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border-color);
        }
      `}</style>
    </div>
  );
}
