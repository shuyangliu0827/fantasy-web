"use client";
// components/PostImageUploader.tsx
//
// Reusable image uploader for post editors.
// Handles file validation, upload progress, thumbnail preview, and removal.
// Images are uploaded immediately on selection so the user sees instant feedback.
//
// Props:
//   uploadedUrls  – controlled list of already-uploaded image URLs
//   onUpload      – called with (newUrls: string[]) after successful uploads
//   onRemove      – called with (index: number) to remove an image
//   uploading     – true while any upload is in flight
//   onUploading   – setter to toggle uploading state in parent
//   uploadFn      – async (file: File) => Promise<{ok: true; url: string} | {ok: false; error: string}>
//   maxImages     – default 4
//   maxMB         – per-file size limit in MB, default 10
//   lang          – "zh" | "en" for copy

import { useRef, useState } from "react";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXT   = "JPG / PNG / WEBP";

type UploadResult = { ok: true; url: string } | { ok: false; error: string };

interface Props {
  uploadedUrls: string[];
  onUpload:    (newUrls: string[]) => void;
  onRemove:    (index: number) => void;
  uploading:   boolean;
  onUploading: (v: boolean) => void;
  uploadFn:    (file: File) => Promise<UploadResult>;
  maxImages?:  number;
  maxMB?:      number;
  lang?:       string;
}

export default function PostImageUploader({
  uploadedUrls,
  onUpload,
  onRemove,
  uploading,
  onUploading,
  uploadFn,
  maxImages = 4,
  maxMB     = 10,
  lang      = "zh",
}: Props) {
  const inputRef  = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const t = (zh: string, en: string) => lang === "zh" ? zh : en;
  const remaining = maxImages - uploadedUrls.length;
  const atLimit   = remaining <= 0;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);

    const toUpload: File[] = [];
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError(t(`格式不支持：${file.name}，请上传 ${ACCEPTED_EXT}`, `Unsupported format: ${file.name}. Use ${ACCEPTED_EXT}.`));
        return;
      }
      if (file.size > maxMB * 1024 * 1024) {
        setError(t(`图片过大：${file.name}（最大 ${maxMB}MB）`, `File too large: ${file.name} (max ${maxMB}MB)`));
        return;
      }
      toUpload.push(file);
    }

    const wouldExceed = uploadedUrls.length + toUpload.length > maxImages;
    if (wouldExceed) {
      setError(t(`最多上传 ${maxImages} 张图片`, `Maximum ${maxImages} images allowed`));
      return;
    }

    onUploading(true);
    const newUrls: string[] = [];
    const errors: string[]  = [];

    for (const file of toUpload) {
      const res = await uploadFn(file);
      if (res.ok) {
        newUrls.push(res.url);
      } else {
        errors.push(res.error);
      }
    }

    onUploading(false);

    if (newUrls.length > 0) onUpload(newUrls);
    if (errors.length > 0) {
      setError(t(`${errors.length} 张图片上传失败，请重试`, `${errors.length} image(s) failed to upload. Please retry.`));
    }

    // Reset file input so the same file can be re-selected after removal
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      {/* Section header */}
      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
        {t("图片（可选）", "Images (optional)")}
      </div>
      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 8 }}>
        {t(`支持 ${ACCEPTED_EXT}，最多 ${maxImages} 张`, `${ACCEPTED_EXT}, up to ${maxImages} images`)}
      </div>

      {/* Thumbnail grid */}
      {uploadedUrls.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, 80px)",
          gap: 8, marginBottom: 8,
        }}>
          {uploadedUrls.map((url, i) => (
            <div key={url} style={{ position: "relative", width: 80, height: 80 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                style={{
                  width: 80, height: 80, objectFit: "cover",
                  borderRadius: 8, border: "1px solid #e5e7eb", display: "block",
                }}
              />
              <button
                onClick={() => { setError(null); onRemove(i); }}
                aria-label={t("删除", "Remove")}
                style={{
                  position: "absolute", top: -6, right: -6,
                  width: 20, height: 20, borderRadius: "50%",
                  background: "#1f2937", color: "#fff", border: "none",
                  cursor: "pointer", fontSize: 12, lineHeight: 1,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload button / empty drop zone */}
      {!atLimit && (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: "100%",
            padding: uploadedUrls.length === 0 ? "20px 0" : "8px 0",
            border: "1.5px dashed #d1d5db",
            borderRadius: 8,
            background: uploading ? "#f9fafb" : "#fff",
            color: uploading ? "#9ca3af" : "#6b7280",
            cursor: uploading ? "not-allowed" : "pointer",
            fontSize: 13, fontWeight: 500,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          {uploading ? (
            t("上传中…", "Uploading…")
          ) : uploadedUrls.length === 0 ? (
            <>
              <span style={{ fontSize: 18, lineHeight: 1 }}>+</span>
              {t("上传图片", "Upload image")}
            </>
          ) : (
            t("继续上传", "Add more")
          )}
        </button>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        multiple
        style={{ display: "none" }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Error message */}
      {error && (
        <div style={{
          marginTop: 6, padding: "6px 10px",
          background: "#fef2f2", border: "1px solid #fecaca",
          borderRadius: 6, fontSize: 12, color: "#991b1b",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
