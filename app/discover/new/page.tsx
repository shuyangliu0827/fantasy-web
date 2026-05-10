"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createInsight, getSessionUser, uploadImage } from "@/lib/shared/store";
import { useLang } from "@/lib/lang";
import { LANGUAGE_LABELS } from "@/lib/shared/language-labels";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const NAV_ITEMS = [
  { href: "/", labelZh: "首页", labelEn: "Home" },
  { href: "/discover", labelZh: "发现", labelEn: "Discover" },
  { href: "/league", labelZh: "公开联赛", labelEn: "Leagues" },
  { href: "/contest", labelZh: "每日竞赛", labelEn: "Daily Fantasy" },
];

const POPULAR_TAGS = ["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"];

type ImageItem = { id: string; file: File; preview: string };
type Visibility = "public" | "followers" | "private";

export default function NewPostPage() {
  const router = useRouter();
  const { t, lang, setLang } = useLang();
  const user = getSessionUser();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const newImages: ImageItem[] = [];
    const remaining = 9 - images.length;
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 30 * 1024 * 1024) { setError(t("图片大小不能超过 30MB", "Image must be under 30MB")); continue; }
      const id = `img_${Date.now()}_${i}`;
      newImages.push({ id, file, preview: URL.createObjectURL(file) });
    }
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages(prev => {
      const item = prev.find(img => img.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter(img => img.id !== id);
    });
  }

  function moveImage(id: string, dir: "left" | "right") {
    setImages(prev => {
      const idx = prev.findIndex(img => img.id === id);
      if (idx === -1) return prev;
      const newIdx = dir === "left" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  }

  function addTag(raw: string) {
    const tg = raw.trim();
    if (!tg || tg.length > 16 || tags.includes(tg) || tags.length >= 5) return;
    setTags(prev => [...prev, tg]);
  }

  async function onSubmit() {
    if (!user) { router.push("/auth/login"); return; }
    if (!title.trim()) { setError(t("请输入标题", "Title is required")); return; }
    if (images.length === 0) { setError(t("请至少上传一张图片", "Please upload at least one image")); return; }

    setSubmitting(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(t(`正在上传图片 ${i + 1}/${images.length}...`, `Uploading image ${i + 1}/${images.length}...`));
        const res = await uploadImage(images[i].file, "posts");
        if (!res.ok) { setError(res.error || t("图片上传失败", "Image upload failed")); setSubmitting(false); setUploadProgress(""); return; }
        uploadedUrls.push(res.url);
      }

      setUploadProgress(t("正在发布...", "Publishing..."));
      const res = await createInsight({
        title: title.trim(),
        body: body.trim() || " ",
        cover_url: uploadedUrls[0],
        images: uploadedUrls,
        tags: tags.length > 0 ? tags : undefined,
      });

      if (!res.ok) { setError(res.error || t("发布失败", "Publish failed")); setSubmitting(false); setUploadProgress(""); return; }

      images.forEach(img => URL.revokeObjectURL(img.preview));
      router.push("/discover");
    } catch {
      setError(t("发布失败，请重试", "Publish failed, please try again"));
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  if (!user) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <div style={{ maxWidth: 480, margin: "100px auto", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "48px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 56, height: 56, background: "#f1f5f9", borderRadius: 14, margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 24, height: 30, background: "#cbd5e1", borderRadius: 4 }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("需要登录", "Login Required")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>{t("登录后即可发布笔记", "Login to publish your notes")}</p>
          <button onClick={() => router.push("/auth/login")} style={{ padding: "12px 32px", background: "#1e3a8a", color: "#fff", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            {t("去登录", "Login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f0f2f7", minHeight: "100vh", fontFamily: FONT }}>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 10px" : "0 24px", height: isMobile ? 60 : 64, display: "flex", alignItems: "center", gap: isMobile ? 8 : 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
          </Link>
          <nav style={{ display: "flex", gap: 2, flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
            {NAV_ITEMS.map(item => {
              const isActive = item.href === "/discover";
              return (
                <Link key={item.href} href={item.href} style={{
                  padding: "7px 13px", borderRadius: 8, fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0f172a" : "#64748b",
                  background: isActive ? "#f1f5f9" : "transparent",
                  textDecoration: "none", whiteSpace: "nowrap", transition: "all 0.15s",
                }}>
                  {lang === "zh" ? item.labelZh : item.labelEn}
                </Link>
              );
            })}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 10, flexShrink: 0 }}>
            <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} style={{ padding: isMobile ? "6px 9px" : "7px 14px", border: "1px solid #e2e8f0", borderRadius: 999, background: "#fff", fontSize: isMobile ? 12 : 13, fontWeight: 600, color: "#64748b", cursor: "pointer" }}>
              {LANGUAGE_LABELS.zh} / {LANGUAGE_LABELS.en}
            </button>
            <Link href={`/u/${user.username}`} style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 8, textDecoration: "none" }}>
              <div style={{ width: isMobile ? 30 : 32, height: isMobile ? 30 : 32, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              {!isMobile && <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{t("我的主页", "My Profile")}</span>}
            </Link>
          </div>
        </div>
      </header>

      {/* Page toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "10px 10px" : "0 24px", minHeight: isMobile ? 0 : 56, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/discover" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 500, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#f8fafc" }}>
            ← {t("返回发现", "Back to Discover")}
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0, flex: 1, minWidth: isMobile ? "100%" : "auto", order: isMobile ? 2 : 0 }}>
            {t("创建内容", "Create Post")}
          </h1>
          <button
            onClick={() => router.push("/discover")}
            disabled={submitting}
            style={{ padding: isMobile ? "8px 14px" : "8px 20px", background: "#fff", border: "1.5px solid #e2e8f0", borderRadius: 8, color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
          >
            {t("存为草稿", "Save Draft")}
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting || images.length === 0 || !title.trim()}
            style={{
              padding: isMobile ? "8px 16px" : "8px 24px",
              background: submitting || images.length === 0 || !title.trim() ? "#94a3b8" : "#1e3a8a",
              border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: submitting || images.length === 0 || !title.trim() ? "not-allowed" : "pointer",
              fontFamily: FONT, transition: "background 0.15s",
            }}
          >
            {submitting ? t("发布中...", "Publishing...") : t("发布", "Publish")}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "14px 10px 36px" : "24px 24px 64px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 320px", gap: isMobile ? 14 : 24 }}>

        {/* Left: editor */}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

          {/* Image upload area */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", overflow: "hidden", marginBottom: 16 }}>
            <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={e => handleFilesSelected(e.target.files)} style={{ display: "none" }} disabled={submitting} />

            {/* Drop zone */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || images.length >= 9}
              style={{
                width: "calc(100% - 32px)", minHeight: 200, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
                background: "#f8fafc", border: "2px dashed #cbd5e1",
                borderRadius: 12, cursor: images.length >= 9 ? "not-allowed" : "pointer",
                fontFamily: FONT, padding: 32, margin: 16,
                boxSizing: "border-box", transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (images.length < 9) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e3a8a"; (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1"; (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            >
              <div style={{ width: 48, height: 48, background: "#e2e8f0", borderRadius: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{t("点击或拖拽上传封面图 / 配图", "Click or drag to upload cover / images")}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("支持 JPG、PNG、GIF · 单张最大 30MB · 最多 9 张", "JPG, PNG, GIF · Max 30MB each · Up to 9 images")}</div>
            </button>

            {/* Uploaded thumbnails */}
            {images.length > 0 && (
              <div style={{ padding: "0 16px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 10 }}>
                  {t(`已上传图片 (${images.length}/9)`, `Uploaded (${images.length}/9)`)}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {images.map((img, idx) => (
                    <div key={img.id} style={{ position: "relative", width: 80, height: 80, borderRadius: 10, overflow: "hidden", border: `2px solid ${idx === 0 ? "#1e3a8a" : "#e2e8f0"}`, flexShrink: 0 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt={`img-${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {idx === 0 && (
                        <div style={{ position: "absolute", top: 4, left: 4, padding: "1px 6px", background: "#1e3a8a", color: "#fff", fontSize: 9, fontWeight: 700, borderRadius: 3 }}>
                          {t("封面", "Cover")}
                        </div>
                      )}
                      <div style={{ position: "absolute", top: 4, right: 4, display: "flex", gap: 3 }}>
                        {idx > 0 && (
                          <button onClick={() => moveImage(img.id, "left")} style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(0,0,0,0.45)", color: "#fff", border: "none", fontSize: 10, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
                        )}
                        <button onClick={() => removeImage(img.id)} style={{ width: 20, height: 20, borderRadius: "50%", background: "rgba(220,38,38,0.8)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
                      </div>
                    </div>
                  ))}
                  {images.length < 9 && (
                    <button onClick={() => fileInputRef.current?.click()} style={{ width: 80, height: 80, borderRadius: 10, border: "2px dashed #cbd5e1", background: "#f8fafc", cursor: "pointer", fontSize: 22, color: "#94a3b8", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Title */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t("标题", "Title")}</div>
            <div style={{ position: "relative" }}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t("填写标题...", "Write a title...")}
                maxLength={50}
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 16, fontWeight: 600,
                  color: "#0f172a", background: "#f8fafc", border: "1.5px solid #e2e8f0",
                  borderRadius: 10, outline: "none", fontFamily: FONT, boxSizing: "border-box",
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#1e3a8a"; (e.target as HTMLInputElement).style.background = "#fff"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; (e.target as HTMLInputElement).style.background = "#f8fafc"; }}
              />
              <div style={{ position: "absolute", right: 12, bottom: -18, fontSize: 11, color: "#94a3b8" }}>{title.length}/50</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginBottom: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t("正文内容", "Body")}</div>
            <div style={{ position: "relative" }}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t("分享你的想法...（可选）", "Share your thoughts... (optional)")}
                rows={7}
                maxLength={2000}
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 14, color: "#374151",
                  background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10,
                  outline: "none", resize: "vertical", minHeight: 140, fontFamily: FONT,
                  lineHeight: 1.65, boxSizing: "border-box",
                }}
                onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#1e3a8a"; (e.target as HTMLTextAreaElement).style.background = "#fff"; }}
                onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#e2e8f0"; (e.target as HTMLTextAreaElement).style.background = "#f8fafc"; }}
              />
              <div style={{ position: "absolute", right: 12, bottom: -18, fontSize: 11, color: "#94a3b8" }}>{body.length}/2000</div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginBottom: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>{t("话题标签", "Hashtags")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {tags.map(tg => (
                <button key={tg} onClick={() => setTags(prev => prev.filter(x => x !== tg))} style={{
                  padding: "5px 12px", background: "#eff6ff", border: "1.5px solid #bfdbfe",
                  borderRadius: 999, color: "#1e3a8a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                }}>
                  #{tg} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
                </button>
              ))}
              {POPULAR_TAGS.filter(tg => !tags.includes(tg)).map(tg => (
                <button key={tg} onClick={() => addTag(tg)} disabled={tags.length >= 5} style={{
                  padding: "5px 12px", background: "#f1f5f9", border: "1.5px solid #e2e8f0",
                  borderRadius: 999, color: "#64748b", fontSize: 12, fontWeight: 600,
                  cursor: tags.length >= 5 ? "not-allowed" : "pointer", opacity: tags.length >= 5 ? 0.5 : 1, fontFamily: FONT,
                }}>
                  #{tg}
                </button>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                placeholder={t("添加话题...", "Add topic...")}
                maxLength={16}
                disabled={tags.length >= 5}
                style={{ padding: "5px 12px", fontSize: 12, color: "#374151", background: "transparent", border: "none", outline: "none", fontFamily: FONT, minWidth: 80 }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); setTagInput(""); } }}
              />
            </div>
          </div>

          {/* Visibility */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>{t("可见范围", "Visibility")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {([
                { key: "public", zh: "公开", en: "Public" },
                { key: "followers", zh: "仅关注者", en: "Followers" },
                { key: "private", zh: "仅自己", en: "Only Me" },
              ] as const).map(opt => (
                <button key={opt.key} onClick={() => setVisibility(opt.key)} style={{
                  padding: "7px 18px",
                  background: visibility === opt.key ? "#1e3a8a" : "#f1f5f9",
                  border: `1.5px solid ${visibility === opt.key ? "#1e3a8a" : "#e2e8f0"}`,
                  borderRadius: 999, color: visibility === opt.key ? "#fff" : "#64748b",
                  fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT, transition: "all 0.15s",
                }}>
                  {lang === "zh" ? opt.zh : opt.en}
                </button>
              ))}
            </div>
          </div>

          {/* Error / progress */}
          {error && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
              {error}
            </div>
          )}
          {uploadProgress && (
            <div style={{ marginTop: 12, padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, color: "#1e3a8a", fontSize: 13, textAlign: "center" }}>
              {uploadProgress}
            </div>
          )}
        </div>

        {/* Right: preview panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, order: isMobile ? -1 : 0 }}>

          {/* Preview card */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>{t("预览效果", "Preview")}</div>

            {/* Cover preview */}
            <div style={{ aspectRatio: "4/3", background: "#f1f5f9", borderRadius: 10, overflow: "hidden", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={images[0].preview} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("封面预览", "Cover preview")}</div>
              )}
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6, lineHeight: 1.4 }}>
              {title || <span style={{ color: "#cbd5e1" }}>{t("标题将显示在这里", "Title appears here")}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>{user.username || user.name}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>{t("公开", "Public")}</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>{t("发布后将以双列卡片形式展示在发现页", "Will appear as a card in the Discover feed")}</div>
          </div>

          {/* Tips */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>{t("发帖小贴士", "Tips")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{t("封面图决定点击率", "Cover image drives clicks")}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{t("清晰的数据截图或球员图片，搭配醒目标题，点击率提升 3 倍。", "Clear data screenshots or player photos paired with bold titles boost click-through 3x.")}</div>
              </div>
              <div style={{ height: 1, background: "#f1f5f9" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{t("善用话题标签", "Use hashtags")}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{t("帖子中关联球员数据卡片，读者可以直接跳转球员详情页。", "Tag your post with relevant topics so it gets discovered by the right readers.")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
