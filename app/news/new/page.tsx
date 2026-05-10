"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createNewsInsight, canUserPublishNews, getSessionUser, uploadImage } from "@/lib/shared/store";
import { useLang } from "@/lib/lang";
import LightHeader from "@/components/LightHeader";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

const NEWS_TAGS = ["球员分析", "交易建议", "选秀策略", "伤病报告", "赛季预测"];

type ImageItem = { id: string; file: File; preview: string };

export default function NewNewsPage() {
  const router = useRouter();
  const { t } = useLang();
  const user = getSessionUser();

  const [authorized, setAuthorized] = useState<boolean | null>(() => user ? null : false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState<ImageItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
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

  // Check permission on mount
  useEffect(() => {
    if (!user) return;
    canUserPublishNews().then((ok) => setAuthorized(ok));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!body.trim()) { setError(t("请输入正文内容", "Body content is required")); return; }

    setSubmitting(true);
    setError(null);

    try {
      // Upload images if any
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(t(`正在上传图片 ${i + 1}/${images.length}...`, `Uploading image ${i + 1}/${images.length}...`));
        const res = await uploadImage(images[i].file, "news");
        if (!res.ok) { setError(res.error || t("图片上传失败", "Image upload failed")); setSubmitting(false); setUploadProgress(""); return; }
        uploadedUrls.push(res.url);
      }

      setUploadProgress(t("正在发布...", "Publishing..."));

      // createNewsInsight checks can_publish_news on the backend
      const res = await createNewsInsight({
        title: title.trim(),
        body: body.trim(),
        cover_url: uploadedUrls.length > 0 ? uploadedUrls[0] : undefined,
        images: uploadedUrls.length > 0 ? uploadedUrls : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      if (!res.ok) {
        setError(res.error || t("发布失败", "Publish failed"));
        setSubmitting(false);
        setUploadProgress("");
        return;
      }

      images.forEach(img => URL.revokeObjectURL(img.preview));
      router.push("/draft-guide");
    } catch {
      setError(t("发布失败，请重试", "Publish failed, please try again"));
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  // Not logged in
  if (!user) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <LightHeader activeHref="/draft-guide" />
        <div style={{ maxWidth: 480, margin: "100px auto", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "48px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("需要登录", "Login Required")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>{t("登录后才能发布新闻", "Login to publish news")}</p>
          <button onClick={() => router.push("/auth/login")} style={{ padding: "12px 32px", background: "#1e3a8a", color: "#fff", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
            {t("去登录", "Login")}
          </button>
        </div>
      </div>
    );
  }

  // Permission check loading
  if (authorized === null) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <LightHeader activeHref="/draft-guide" />
        <div style={{ textAlign: "center", padding: "120px 0", color: "#9ca3af" }}>
          <div style={{
            width: 36, height: 36, border: "3px solid #e5e7eb", borderTopColor: "#1e3a8a",
            borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px",
          }} />
          {t("验证权限中…", "Verifying permissions…")}
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      </div>
    );
  }

  // Not authorized
  if (!authorized) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <LightHeader activeHref="/draft-guide" />
        <div style={{ maxWidth: 480, margin: "100px auto", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "48px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("无发布权限", "Not Authorized")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px", lineHeight: 1.6 }}>
            {t("仅授权的编辑和专家可以发布Fantasy新闻。", "Only authorized editors and experts can publish Fantasy News.")}
          </p>
          <Link href="/draft-guide" style={{ padding: "12px 32px", background: "#1e3a8a", color: "#fff", borderRadius: 10, fontSize: 15, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
            {t("返回新闻", "Back to News")}
          </Link>
        </div>
      </div>
    );
  }

  // Authorized — show the editor
  return (
    <div style={{ background: "#f0f2f7", minHeight: "100vh", fontFamily: FONT }}>
      <LightHeader activeHref="/draft-guide" />

      {/* Page toolbar */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: isMobile ? "10px 10px" : "0 24px", minHeight: isMobile ? 0 : 56, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Link href="/draft-guide" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 500, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#f8fafc" }}>
            ← {t("返回新闻", "Back to News")}
          </Link>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", margin: 0, flex: 1, minWidth: isMobile ? "100%" : "auto", order: isMobile ? 2 : 0 }}>
            {t("发布新闻", "Publish News")}
          </h1>
          <button
            onClick={onSubmit}
            disabled={submitting || !title.trim() || !body.trim()}
            style={{
              padding: isMobile ? "8px 16px" : "8px 24px",
              background: submitting || !title.trim() || !body.trim() ? "#94a3b8" : "#1e3a8a",
              border: "none", borderRadius: 8, color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: submitting || !title.trim() || !body.trim() ? "not-allowed" : "pointer",
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

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || images.length >= 9}
              style={{
                width: "calc(100% - 32px)", minHeight: 160, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 10,
                background: "#f8fafc", border: "2px dashed #cbd5e1",
                borderRadius: 12, cursor: images.length >= 9 ? "not-allowed" : "pointer",
                fontFamily: FONT, padding: 24, margin: 16,
                boxSizing: "border-box", transition: "all 0.15s",
              }}
              onMouseEnter={e => { if (images.length < 9) { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e3a8a"; (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1"; (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            >
              <div style={{ width: 48, height: 48, background: "#e2e8f0", borderRadius: 12 }} />
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151" }}>{t("上传封面图 / 配图（可选）", "Upload cover / images (optional)")}</div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{t("支持 JPG、PNG、GIF · 单张最大 30MB · 最多 9 张", "JPG, PNG, GIF · Max 30MB each · Up to 9 images")}</div>
            </button>

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
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t("新闻标题", "News Title")}</div>
            <div style={{ position: "relative" }}>
              <input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder={t("填写新闻标题...", "Write a news title...")}
                maxLength={100}
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 16, fontWeight: 600,
                  color: "#0f172a", background: "#f8fafc", border: "1.5px solid #e2e8f0",
                  borderRadius: 10, outline: "none", fontFamily: FONT, boxSizing: "border-box",
                }}
                onFocus={e => { (e.target as HTMLInputElement).style.borderColor = "#1e3a8a"; (e.target as HTMLInputElement).style.background = "#fff"; }}
                onBlur={e => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; (e.target as HTMLInputElement).style.background = "#f8fafc"; }}
              />
              <div style={{ position: "absolute", right: 12, bottom: -18, fontSize: 11, color: "#94a3b8" }}>{title.length}/100</div>
            </div>
          </div>

          {/* Body */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginBottom: 16, marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 8 }}>{t("新闻正文", "News Body")}</div>
            <div style={{ position: "relative" }}>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder={t("撰写新闻内容...", "Write your news content...")}
                rows={12}
                maxLength={10000}
                disabled={submitting}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: 14, color: "#374151",
                  background: "#f8fafc", border: "1.5px solid #e2e8f0", borderRadius: 10,
                  outline: "none", resize: "vertical", minHeight: 240, fontFamily: FONT,
                  lineHeight: 1.65, boxSizing: "border-box",
                }}
                onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#1e3a8a"; (e.target as HTMLTextAreaElement).style.background = "#fff"; }}
                onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = "#e2e8f0"; (e.target as HTMLTextAreaElement).style.background = "#f8fafc"; }}
              />
              <div style={{ position: "absolute", right: 12, bottom: -18, fontSize: 11, color: "#94a3b8" }}>{body.length}/10000</div>
            </div>
          </div>

          {/* Tags */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: isMobile ? "16px 14px" : "20px 24px", marginTop: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 12 }}>{t("新闻分类", "News Category")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              {tags.map(tg => (
                <button key={tg} onClick={() => setTags(prev => prev.filter(x => x !== tg))} style={{
                  padding: "5px 12px", background: "#eff6ff", border: "1.5px solid #bfdbfe",
                  borderRadius: 999, color: "#1e3a8a", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT,
                }}>
                  #{tg} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
                </button>
              ))}
              {NEWS_TAGS.filter(tg => !tags.includes(tg)).map(tg => (
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
                placeholder={t("添加分类...", "Add category...")}
                maxLength={16}
                disabled={tags.length >= 5}
                style={{ padding: "5px 12px", fontSize: 12, color: "#374151", background: "transparent", border: "none", outline: "none", fontFamily: FONT, minWidth: 80 }}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); setTagInput(""); } }}
              />
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
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>{t("新闻预览", "News Preview")}</div>

            {images[0] ? (
              <div style={{ aspectRatio: "16/9", background: "#f1f5f9", borderRadius: 10, overflow: "hidden", marginBottom: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={images[0].preview} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              </div>
            ) : (
              <div style={{ aspectRatio: "16/9", background: "#f1f5f9", borderRadius: 10, marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{t("封面预览", "Cover preview")}</div>
              </div>
            )}

            <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 6, lineHeight: 1.4 }}>
              {title || <span style={{ color: "#cbd5e1" }}>{t("新闻标题将显示在这里", "News title appears here")}</span>}
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 8, maxHeight: 48, overflow: "hidden" }}>
              {body ? body.slice(0, 100) : <span style={{ color: "#cbd5e1" }}>{t("正文摘要...", "Body excerpt...")}</span>}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {user.name?.[0]?.toUpperCase()}
              </div>
              <span style={{ fontSize: 11, color: "#64748b" }}>{user.name || user.username}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>·</span>
              <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>{t("新闻", "News")}</span>
            </div>
          </div>

          {/* Guidelines */}
          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e2e8f0", padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>{t("新闻发布指南", "Publishing Guidelines")}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{t("内容要求", "Content Requirements")}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{t("新闻文章应包含专业分析、数据支撑和明确观点，帮助读者做出更好的Fantasy决策。", "News articles should include professional analysis, data-backed insights, and clear opinions to help readers make better Fantasy decisions.")}</div>
              </div>
              <div style={{ height: 1, background: "#f1f5f9" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", marginBottom: 4 }}>{t("分类标签", "Categories")}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.55 }}>{t("请选择合适的分类标签，方便读者按类别浏览新闻内容。", "Select appropriate category tags so readers can browse news by category.")}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
