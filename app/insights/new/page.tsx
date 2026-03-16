"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createInsight, getSessionUser, uploadImage } from "@/lib/store";
import Header from "@/components/Header";

type ImageItem = {
  id: string;
  file: File;
  preview: string;
};

export default function NewInsightPage() {
  const router = useRouter();
  const user = getSessionUser();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 添加图片
  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    
    const newImages: ImageItem[] = [];
    const remaining = 9 - images.length;
    
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        setError("图片大小不能超过 10MB");
        continue;
      }
      
      const id = `img_${Date.now()}_${i}`;
      const preview = URL.createObjectURL(file);
      newImages.push({ id, file, preview });
    }
    
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // 删除图片
  function removeImage(id: string) {
    setImages((prev) => {
      const item = prev.find((img) => img.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((img) => img.id !== id);
    });
  }

  // 移动图片（排序）
  function moveImage(id: string, direction: "left" | "right") {
    setImages((prev) => {
      const idx = prev.findIndex((img) => img.id === id);
      if (idx === -1) return prev;
      
      const newIdx = direction === "left" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      
      const newArr = [...prev];
      [newArr[idx], newArr[newIdx]] = [newArr[newIdx], newArr[idx]];
      return newArr;
    });
  }

  // 添加标签
  function addTag(raw: string) {
    const t = raw.trim();
    if (!t || t.length > 16 || tags.includes(t) || tags.length >= 5) return;
    setTags((prev) => [...prev, t]);
  }

  function removeTag(t: string) {
    setTags((prev) => prev.filter((x) => x !== t));
  }

  // 提交
  async function onSubmit() {
    if (!user) {
      alert("需要登录后才能发布");
      router.push("/auth/login");
      return;
    }

    if (!title.trim()) {
      setError("请输入标题");
      return;
    }

    if (images.length === 0) {
      setError("请至少上传一张图片");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // 1. 上传所有图片
      const uploadedUrls: string[] = [];
      
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(`正在上传图片 ${i + 1}/${images.length}...`);
        const res = await uploadImage(images[i].file, "posts");
        if (!res.ok) {
          setError(res.error || "图片上传失败");
          setSubmitting(false);
          setUploadProgress("");
          return;
        }
        uploadedUrls.push(res.url);
      }

      setUploadProgress("正在发布...");

      // 2. 创建 insight（第一张图作为封面）
      const res = await createInsight({
        title: title.trim(),
        body: body.trim() || " ", // body 不能为空
        cover_url: uploadedUrls[0], // 第一张作为封面
        images: uploadedUrls, // 所有图片
        tags: tags.length > 0 ? tags : undefined,
      });

      if (!res.ok) {
        setError(res.error || "发布失败");
        setSubmitting(false);
        setUploadProgress("");
        return;
      }

      // 清理预览 URL
      images.forEach((img) => URL.revokeObjectURL(img.preview));
      
      router.push("/");
    } catch (err) {
      setError("发布失败，请重试");
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  const POPULAR_TAGS = ["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"];

  if (!user) {
    return (
      <div className="app">
        <Header />
        <main className="page">
          <div className="login-prompt">
            <div className="icon">🔒</div>
            <h2>需要登录</h2>
            <p>登录后即可发布内容</p>
            <button onClick={() => router.push("/auth/login")} className="login-btn">
              去登录
            </button>
          </div>
        </main>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="page">
        <div className="container">
          {/* 头部 */}
          <div className="header">
            <h1>发布笔记</h1>
            <p>分享你的 Fantasy 篮球心得</p>
          </div>

          <div className="content">
            {/* 左侧：图片上传区 */}
            <div className="left-panel">
              <div className="upload-section">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFilesSelected(e.target.files)}
                  style={{ display: "none" }}
                  disabled={submitting}
                />

                {images.length === 0 ? (
                  <button
                    className="upload-placeholder"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                  >
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">点击上传图片</div>
                    <div className="upload-hint">最多 9 张，第一张为封面</div>
                  </button>
                ) : (
                  <div className="images-grid">
                    {images.map((img, idx) => (
                      <div key={img.id} className="image-item">
                        <img src={img.preview} alt={`图片 ${idx + 1}`} />
                        {idx === 0 && <div className="cover-badge">封面</div>}
                        <div className="image-actions">
                          {idx > 0 && (
                            <button onClick={() => moveImage(img.id, "left")} title="左移">
                              ←
                            </button>
                          )}
                          {idx < images.length - 1 && (
                            <button onClick={() => moveImage(img.id, "right")} title="右移">
                              →
                            </button>
                          )}
                          <button onClick={() => removeImage(img.id)} className="delete-btn" title="删除">
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                    
                    {images.length < 9 && (
                      <button
                        className="add-image-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={submitting}
                      >
                        <span>+</span>
                        <span className="add-text">添加</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：表单区 */}
            <div className="right-panel">
              {/* 标题 */}
              <div className="form-group">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="填写标题，吸引更多人..."
                  maxLength={50}
                  disabled={submitting}
                  className="title-input"
                />
                <div className="char-count">{title.length}/50</div>
              </div>

              {/* 正文 */}
              <div className="form-group">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="分享你的想法...（可选）"
                  rows={6}
                  disabled={submitting}
                  className="body-input"
                />
              </div>

              {/* 标签 */}
              <div className="form-group">
                <div className="tags-header">
                  <span className="label">添加标签</span>
                  <span className="hint">（最多 5 个）</span>
                </div>
                
                <div className="selected-tags">
                  {tags.map((t) => (
                    <button key={t} onClick={() => removeTag(t)} className="tag selected">
                      #{t} <span className="remove">×</span>
                    </button>
                  ))}
                </div>

                <div className="popular-tags">
                  {POPULAR_TAGS.filter((t) => !tags.includes(t)).map((t) => (
                    <button
                      key={t}
                      onClick={() => addTag(t)}
                      className="tag"
                      disabled={tags.length >= 5}
                    >
                      #{t}
                    </button>
                  ))}
                </div>

                <div className="tag-input-row">
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="自定义标签"
                    maxLength={16}
                    disabled={submitting || tags.length >= 5}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag(tagInput);
                        setTagInput("");
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      addTag(tagInput);
                      setTagInput("");
                    }}
                    disabled={submitting || tags.length >= 5 || !tagInput.trim()}
                  >
                    添加
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {error && <div className="error">{error}</div>}

              {/* 上传进度 */}
              {uploadProgress && <div className="progress">{uploadProgress}</div>}

              {/* 提交按钮 */}
              <div className="actions">
                <button
                  onClick={() => router.push("/")}
                  disabled={submitting}
                  className="cancel-btn"
                >
                  取消
                </button>
                <button
                  onClick={onSubmit}
                  disabled={submitting || images.length === 0 || !title.trim()}
                  className="submit-btn"
                >
                  {submitting ? "发布中..." : "发布笔记"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page {
    min-height: 100vh;
    background: #0a0a0a;
    padding: 24px 16px 60px;
  }

  .container {
    max-width: 1000px;
    margin: 0 auto;
  }

  .header {
    margin-bottom: 24px;
  }

  .header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #f59e0b;
    margin: 0 0 4px 0;
  }

  .header p {
    font-size: 14px;
    color: #666;
    margin: 0;
  }

  .content {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
    padding: 24px;
  }

  /* 左侧图片区 */
  .left-panel {
    min-height: 400px;
  }

  .upload-section {
    height: 100%;
  }

  .upload-placeholder {
    width: 100%;
    height: 100%;
    min-height: 400px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    background: #1a1a1a;
    border: 2px dashed #333;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .upload-placeholder:hover {
    border-color: #f59e0b;
    background: #1f1f1f;
  }

  .upload-icon {
    font-size: 48px;
  }

  .upload-text {
    font-size: 16px;
    color: #fff;
    font-weight: 500;
  }

  .upload-hint {
    font-size: 13px;
    color: #666;
  }

  .images-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .image-item {
    position: relative;
    aspect-ratio: 1;
    border-radius: 8px;
    overflow: hidden;
    background: #1a1a1a;
  }

  .image-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .cover-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    padding: 2px 8px;
    background: #f59e0b;
    color: #000;
    font-size: 11px;
    font-weight: 600;
    border-radius: 4px;
  }

  .image-actions {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    gap: 4px;
    padding: 6px;
    background: linear-gradient(transparent, rgba(0,0,0,0.8));
    opacity: 0;
    transition: opacity 0.2s;
  }

  .image-item:hover .image-actions {
    opacity: 1;
  }

  .image-actions button {
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    color: #fff;
    font-size: 14px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .image-actions button:hover {
    background: rgba(255,255,255,0.3);
  }

  .image-actions .delete-btn:hover {
    background: #ef4444;
  }

  .add-image-btn {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    background: #1a1a1a;
    border: 2px dashed #333;
    border-radius: 8px;
    color: #666;
    font-size: 24px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .add-image-btn:hover {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .add-text {
    font-size: 12px;
  }

  /* 右侧表单区 */
  .right-panel {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .form-group {
    position: relative;
  }

  .title-input {
    width: 100%;
    padding: 16px;
    font-size: 18px;
    font-weight: 600;
    color: #fff;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 10px;
    outline: none;
  }

  .title-input:focus {
    border-color: #f59e0b;
  }

  .char-count {
    position: absolute;
    right: 12px;
    bottom: -20px;
    font-size: 12px;
    color: #666;
  }

  .body-input {
    width: 100%;
    padding: 16px;
    font-size: 15px;
    color: #fff;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 10px;
    outline: none;
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
  }

  .body-input:focus {
    border-color: #f59e0b;
  }

  .tags-header {
    margin-bottom: 10px;
  }

  .tags-header .label {
    font-size: 14px;
    color: #fff;
    font-weight: 500;
  }

  .tags-header .hint {
    font-size: 12px;
    color: #666;
    margin-left: 6px;
  }

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 10px;
  }

  .popular-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 12px;
  }

  .tag {
    padding: 6px 12px;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 16px;
    color: #aaa;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tag:hover {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .tag.selected {
    background: rgba(245, 158, 11, 0.15);
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .tag .remove {
    margin-left: 4px;
    opacity: 0.6;
  }

  .tag-input-row {
    display: flex;
    gap: 8px;
  }

  .tag-input-row input {
    flex: 1;
    padding: 10px 14px;
    font-size: 14px;
    color: #fff;
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    outline: none;
  }

  .tag-input-row input:focus {
    border-color: #f59e0b;
  }

  .tag-input-row button {
    padding: 10px 16px;
    background: #333;
    border: none;
    border-radius: 8px;
    color: #fff;
    font-size: 14px;
    cursor: pointer;
  }

  .tag-input-row button:hover:not(:disabled) {
    background: #444;
  }

  .tag-input-row button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    padding: 12px 16px;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    color: #fca5a5;
    font-size: 14px;
  }

  .progress {
    padding: 12px 16px;
    background: rgba(245, 158, 11, 0.15);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 8px;
    color: #f59e0b;
    font-size: 14px;
    text-align: center;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid #222;
  }

  .cancel-btn {
    flex: 1;
    padding: 14px;
    background: transparent;
    border: 1px solid #333;
    border-radius: 10px;
    color: #aaa;
    font-size: 15px;
    cursor: pointer;
  }

  .cancel-btn:hover {
    background: #1a1a1a;
  }

  .submit-btn {
    flex: 2;
    padding: 14px;
    background: #f59e0b;
    border: none;
    border-radius: 10px;
    color: #000;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  .submit-btn:hover:not(:disabled) {
    background: #d97706;
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* 登录提示 */
  .login-prompt {
    max-width: 400px;
    margin: 80px auto;
    text-align: center;
    padding: 48px;
    background: #111;
    border: 1px solid #222;
    border-radius: 16px;
  }

  .login-prompt .icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .login-prompt h2 {
    font-size: 20px;
    color: #fff;
    margin: 0 0 8px 0;
  }

  .login-prompt p {
    font-size: 14px;
    color: #666;
    margin: 0 0 24px 0;
  }

  .login-btn {
    padding: 12px 32px;
    background: #f59e0b;
    border: none;
    border-radius: 8px;
    color: #000;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
  }

  /* 响应式 */
  @media (max-width: 768px) {
    .content {
      grid-template-columns: 1fr;
    }

    .left-panel {
      min-height: 300px;
    }

    .upload-placeholder {
      min-height: 300px;
    }
  }
`;