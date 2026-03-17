"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createInsight, getSessionUser, uploadImage } from "@/lib/store";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

type ImageItem = {
  id: string;
  file: File;
  preview: string;
};

export default function NewInsightPage() {
  const router = useRouter();
  const { t } = useLang();
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

  function handleFilesSelected(files: FileList | null) {
    if (!files) return;
    const newImages: ImageItem[] = [];
    const remaining = 9 - images.length;
    for (let i = 0; i < Math.min(files.length, remaining); i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) { setError(t("图片大小不能超过 10MB", "Image must be under 10MB")); continue; }
      const id = `img_${Date.now()}_${i}`;
      const preview = URL.createObjectURL(file);
      newImages.push({ id, file, preview });
    }
    setImages((prev) => [...prev, ...newImages]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const item = prev.find((img) => img.id === id);
      if (item) URL.revokeObjectURL(item.preview);
      return prev.filter((img) => img.id !== id);
    });
  }

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

  function addTag(raw: string) {
    const tg = raw.trim();
    if (!tg || tg.length > 16 || tags.includes(tg) || tags.length >= 5) return;
    setTags((prev) => [...prev, tg]);
  }

  function removeTag(tg: string) {
    setTags((prev) => prev.filter((x) => x !== tg));
  }

  async function onSubmit() {
    if (!user) {
      alert(t("需要登录后才能发布", "Login required to post"));
      router.push("/auth/login");
      return;
    }
    if (!title.trim()) { setError(t("请输入标题", "Title is required")); return; }
    if (images.length === 0) { setError(t("请至少上传一张图片", "Please upload at least one image")); return; }

    setSubmitting(true);
    setError(null);

    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(t(`正在上传图片 ${i + 1}/${images.length}...`, `Uploading image ${i + 1}/${images.length}...`));
        const res = await uploadImage(images[i].file, "posts");
        if (!res.ok) {
          setError(res.error || t("图片上传失败", "Image upload failed"));
          setSubmitting(false);
          setUploadProgress("");
          return;
        }
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

      if (!res.ok) {
        setError(res.error || t("发布失败", "Publish failed"));
        setSubmitting(false);
        setUploadProgress("");
        return;
      }

      images.forEach((img) => URL.revokeObjectURL(img.preview));
      router.push("/insights");
    } catch {
      setError(t("发布失败，请重试", "Publish failed, please try again"));
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  const POPULAR_TAGS = ["选秀策略", "球员分析", "交易建议", "新手指南", "Punt策略"];

  if (!user) {
    return (
      <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
        <Header />
        <div style={{ maxWidth: 480, margin: "100px auto", textAlign: "center", background: "#fff", borderRadius: 20, border: "1px solid #e2e8f0", padding: "48px 40px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0f172a", margin: "0 0 8px" }}>{t("需要登录", "Login Required")}</h2>
          <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px" }}>{t("登录后即可发布笔记", "Login to publish your notes")}</p>
          <button
            onClick={() => router.push("/auth/login")}
            style={{ padding: "12px 32px", background: "#1e3a8a", color: "#fff", borderRadius: 10, border: "none", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}
          >
            {t("去登录", "Login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: "#f8fafc", minHeight: "100vh", fontFamily: FONT }}>
      <Header />

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 64px" }}>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", margin: "0 0 6px", letterSpacing: "-0.5px" }}>
            {t("发布笔记", "New Post")}
          </h1>
          <p style={{ fontSize: 14, color: "#64748b", margin: 0 }}>
            {t("分享你的范特西篮球心得", "Share your fantasy basketball insights")}
          </p>
        </div>

        <div style={{
          background: "#fff",
          borderRadius: 20,
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 0,
          overflow: "hidden",
        }}>
          {/* Left: image upload */}
          <div style={{ padding: 28, borderRight: "1px solid #f1f5f9" }}>
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
                onClick={() => fileInputRef.current?.click()}
                disabled={submitting}
                style={{
                  width: "100%",
                  minHeight: 420,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 14,
                  background: "#f8fafc",
                  border: "2px dashed #cbd5e1",
                  borderRadius: 14,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  fontFamily: FONT,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e3a8a";
                  (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = "#cbd5e1";
                  (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
                }}
              >
                <div style={{ fontSize: 44 }}>📷</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{t("点击上传图片", "Click to upload")}</div>
                <div style={{ fontSize: 13, color: "#94a3b8" }}>{t("最多 9 张，第一张为封面", "Up to 9 images, first is cover")}</div>
              </button>
            ) : (
              <div>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 8,
                }}>
                  {images.map((img, idx) => (
                    <div key={img.id} style={{
                      position: "relative",
                      aspectRatio: "1",
                      borderRadius: 10,
                      overflow: "hidden",
                      background: "#f1f5f9",
                      border: "1px solid #e2e8f0",
                    }}>
                      <img src={img.preview} alt={`图片 ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      {idx === 0 && (
                        <div style={{
                          position: "absolute", top: 6, left: 6,
                          padding: "2px 8px",
                          background: "#1e3a8a",
                          color: "#fff",
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 4,
                        }}>
                          {t("封面", "Cover")}
                        </div>
                      )}
                      <div style={{
                        position: "absolute", bottom: 0, left: 0, right: 0,
                        display: "flex", justifyContent: "center", gap: 4,
                        padding: "6px",
                        background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                        opacity: 0,
                        transition: "opacity 0.2s",
                      }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "1"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.opacity = "0"; }}
                      >
                        {idx > 0 && (
                          <button onClick={() => moveImage(img.id, "left")} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>←</button>
                        )}
                        {idx < images.length - 1 && (
                          <button onClick={() => moveImage(img.id, "right")} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>→</button>
                        )}
                        <button onClick={() => removeImage(img.id)} style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(239,68,68,0.8)", color: "#fff", border: "none", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>×</button>
                      </div>
                    </div>
                  ))}

                  {images.length < 9 && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting}
                      style={{
                        aspectRatio: "1",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4,
                        background: "#f8fafc",
                        border: "2px dashed #cbd5e1",
                        borderRadius: 10,
                        color: "#94a3b8",
                        fontSize: 22,
                        cursor: "pointer",
                        fontFamily: FONT,
                        transition: "all 0.15s",
                      }}
                    >
                      <span>+</span>
                      <span style={{ fontSize: 11 }}>{t("添加", "Add")}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right: form */}
          <div style={{ padding: 28, display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Title */}
            <div style={{ position: "relative" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("填写标题，吸引更多人...", "Write a compelling title...")}
                maxLength={50}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: 17,
                  fontWeight: 600,
                  color: "#0f172a",
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  outline: "none",
                  fontFamily: FONT,
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = "#1e3a8a"; (e.target as HTMLInputElement).style.background = "#fff"; }}
                onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = "#e2e8f0"; (e.target as HTMLInputElement).style.background = "#f8fafc"; }}
              />
              <div style={{ position: "absolute", right: 12, bottom: -18, fontSize: 11, color: "#94a3b8" }}>{title.length}/50</div>
            </div>

            {/* Body */}
            <div style={{ marginTop: 4 }}>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("分享你的想法...（可选）", "Share your thoughts... (optional)")}
                rows={6}
                disabled={submitting}
                style={{
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: 14,
                  color: "#374151",
                  background: "#f8fafc",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  outline: "none",
                  resize: "vertical",
                  minHeight: 120,
                  fontFamily: FONT,
                  lineHeight: 1.6,
                  boxSizing: "border-box",
                }}
                onFocus={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#1e3a8a"; (e.target as HTMLTextAreaElement).style.background = "#fff"; }}
                onBlur={(e) => { (e.target as HTMLTextAreaElement).style.borderColor = "#e2e8f0"; (e.target as HTMLTextAreaElement).style.background = "#f8fafc"; }}
              />
            </div>

            {/* Tags */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{t("添加标签", "Tags")}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{t("（最多 5 个）", "(max 5)")}</span>
              </div>

              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                  {tags.map((tg) => (
                    <button key={tg} onClick={() => removeTag(tg)} style={{
                      padding: "5px 12px",
                      background: "#eff6ff",
                      border: "1.5px solid #bfdbfe",
                      borderRadius: 999,
                      color: "#1e3a8a",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: FONT,
                    }}>
                      #{tg} <span style={{ marginLeft: 4, opacity: 0.6 }}>×</span>
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {POPULAR_TAGS.filter((tg) => !tags.includes(tg)).map((tg) => (
                  <button key={tg} onClick={() => addTag(tg)} disabled={tags.length >= 5} style={{
                    padding: "5px 12px",
                    background: "#f1f5f9",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 999,
                    color: "#64748b",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: tags.length >= 5 ? "not-allowed" : "pointer",
                    opacity: tags.length >= 5 ? 0.5 : 1,
                    fontFamily: FONT,
                    transition: "all 0.15s",
                  }}>
                    #{tg}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder={t("自定义标签", "Custom tag")}
                  maxLength={16}
                  disabled={submitting || tags.length >= 5}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    fontSize: 13,
                    color: "#374151",
                    background: "#f8fafc",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 8,
                    outline: "none",
                    fontFamily: FONT,
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); addTag(tagInput); setTagInput(""); }
                  }}
                />
                <button
                  onClick={() => { addTag(tagInput); setTagInput(""); }}
                  disabled={submitting || tags.length >= 5 || !tagInput.trim()}
                  style={{
                    padding: "9px 16px",
                    background: "#f1f5f9",
                    border: "1.5px solid #e2e8f0",
                    borderRadius: 8,
                    color: "#374151",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: FONT,
                  }}
                >
                  {t("添加", "Add")}
                </button>
              </div>
            </div>

            {/* Error / progress */}
            {error && (
              <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#dc2626", fontSize: 13 }}>
                {error}
              </div>
            )}
            {uploadProgress && (
              <div style={{ padding: "10px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, color: "#1e3a8a", fontSize: 13, textAlign: "center" }}>
                {uploadProgress}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 12, marginTop: "auto", paddingTop: 8, borderTop: "1px solid #f1f5f9" }}>
              <button
                onClick={() => router.push("/insights")}
                disabled={submitting}
                style={{
                  flex: 1,
                  padding: "13px",
                  background: "#fff",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: 10,
                  color: "#64748b",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: FONT,
                }}
              >
                {t("取消", "Cancel")}
              </button>
              <button
                onClick={onSubmit}
                disabled={submitting || images.length === 0 || !title.trim()}
                style={{
                  flex: 2,
                  padding: "13px",
                  background: submitting || images.length === 0 || !title.trim() ? "#94a3b8" : "#1e3a8a",
                  border: "none",
                  borderRadius: 10,
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: submitting || images.length === 0 || !title.trim() ? "not-allowed" : "pointer",
                  fontFamily: FONT,
                  transition: "background 0.15s",
                }}
              >
                {submitting ? t("发布中...", "Publishing...") : t("发布笔记", "Publish")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
