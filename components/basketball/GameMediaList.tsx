"use client";

// components/basketball/GameMediaList.tsx
//
// Game highlights section. Two render branches:
//
//   • Admin view  — league admins / platform admins see an upload form
//     that accepts a local video file (mp4/mov/webm) plus an optional
//     title and visibility selector.
//   • Public view — everyone else only sees the list of highlights they
//     are allowed to view (visibility filtering happens server-side).
//
// Backwards-compatibility: legacy basketball_game_media rows with
// source_type='external_link' / media_type='link' are still rendered
// (YouTube + Bilibili iframes, generic link card fallback) so existing
// highlights are not lost. New highlights only come in through the
// uploaded-video path.

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { uploadBasketballGameVideo } from "@/lib/basketball/uploads";

type Media = {
  id: string;
  title: string | null;
  url: string;
  media_type: "link" | "video" | "image";
  source_type?: "external_link" | "upload" | null;
  mime_type?: string | null;
  visibility: "public" | "members_only";
  created_at: string;
};

type Props = {
  gameId: string;
  /** Whether the current viewer can add/remove media (league admin / platform admin). */
  canManage: boolean;
};

const MAX_FILE_BYTES = 200 * 1024 * 1024;

function toEmbedSrc(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    if (u.hostname.includes("bilibili.com") && u.pathname.match(/\/video\/(BV\w+)/)) {
      const bv = u.pathname.match(/\/video\/(BV\w+)/)![1];
      return `https://player.bilibili.com/player.html?bvid=${bv}&high_quality=1`;
    }
  } catch {
    return null;
  }
  return null;
}

function isUploadedVideo(m: Media): boolean {
  return m.media_type === "video" && m.source_type === "upload";
}

export default function GameMediaList({ gameId, canManage }: Props) {
  const { t } = useLang();
  const [media, setMedia] = useState<Media[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<"public" | "members_only">("public");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const res = await basketballJson<{ media: Media[] }>(
      `/api/basketball-games/${gameId}/media`,
    );
    if (res.data) setMedia(res.data.media);
    setLoaded(true);
  }, [gameId]);

  useEffect(() => {
    load();
  }, [load]);

  const translateError = (code: string) => {
    if (code === "forbidden") {
      return t(
        "只有联赛管理员可以上传比赛集锦。",
        "Only league admins can upload highlights.",
      );
    }
    if (code === "file_too_large") {
      return t(
        "视频文件过大（最大 200MB）。",
        "Video file too large (max 200MB).",
      );
    }
    if (code === "unsupported_file_type") {
      return t(
        "暂不支持该视频格式，请使用 mp4 / mov / webm。",
        "Unsupported video format. Please use mp4, mov, or webm.",
      );
    }
    if (code === "empty_file" || code === "missing_file") {
      return t("请选择要上传的视频文件。", "Please pick a video file to upload.");
    }
    if (code === "upload_failed") {
      return t("上传失败，请稍后再试。", "Upload failed. Please try again.");
    }
    return code;
  };

  const upload = async () => {
    if (!file) {
      setErr(translateError("missing_file"));
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setErr(translateError("file_too_large"));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await uploadBasketballGameVideo(gameId, file, {
        title: title.trim() || undefined,
        visibility,
      });
      setFile(null);
      setTitle("");
      // Reset the visible <input type="file"> by reloading state — the
      // input is uncontrolled so we wipe it via a key rerender below.
      setFileInputKey((k) => k + 1);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // postFile-style errors look like "code: details"
      const code = msg.split(":")[0]?.trim() ?? msg;
      setErr(translateError(code));
    } finally {
      setBusy(false);
    }
  };

  const [fileInputKey, setFileInputKey] = useState(0);

  const remove = async (id: string) => {
    const ok =
      typeof window === "undefined"
        ? true
        : window.confirm(
            t("确认删除该集锦？此操作无法撤销。", "Delete this highlight? This cannot be undone."),
          );
    if (!ok) return;
    const res = await basketballFetch(
      `/api/basketball-games/${gameId}/media/${id}`,
      { method: "DELETE" },
    );
    if (res.ok) setMedia((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.02em",
          margin: "0 0 14px",
        }}
      >
        {t("精彩集锦", "Highlights")}
      </h2>

      {canManage && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 14,
            marginBottom: 14,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 8,
                color: "#1e3a8a",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t("上传视频文件", "Upload Video File")}
              <input
                key={fileInputKey}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,video/x-m4v,.mp4,.mov,.webm,.m4v"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
            </label>
            <div
              style={{
                fontSize: 12,
                color: "#64748b",
                flex: "1 1 200px",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={file?.name}
            >
              {file
                ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB`
                : t("尚未选择文件", "No file selected")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("标题（可选）", "Title (optional)")}
              style={inputStyle({ flex: "2 1 240px" })}
              maxLength={120}
            />
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "members_only")}
              style={inputStyle({ flex: "0 0 160px" })}
            >
              <option value="public">{t("所有人可见", "Visible to all")}</option>
              <option value="members_only">{t("仅联赛成员可见", "Members only")}</option>
            </select>
            <button
              onClick={upload}
              disabled={busy || !file}
              style={{
                minHeight: 40,
                padding: "0 18px",
                background: busy || !file ? "#94a3b8" : "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 800,
                cursor: busy || !file ? "default" : "pointer",
              }}
            >
              {busy ? t("上传中…", "Uploading…") : t("上传集锦", "Upload highlight")}
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {t(
              "支持 mp4 / mov / webm，单个文件最大 200MB。",
              "Supports mp4 / mov / webm; up to 200MB per file.",
            )}
          </div>
          {err && (
            <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
          )}
        </div>
      )}

      {!loaded ? (
        <div style={{ color: "#94a3b8", fontSize: 14 }}>{t("加载中…", "Loading…")}</div>
      ) : media.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 14 }}>
          {t("暂无集锦", "No highlights yet")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 14,
          }}
        >
          {media.map((m) => {
            const embed =
              !isUploadedVideo(m) ? toEmbedSrc(m.url) : null;
            return (
              <div
                key={m.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {isUploadedVideo(m) ? (
                  <video
                    src={m.url}
                    controls
                    preload="metadata"
                    style={{
                      width: "100%",
                      maxHeight: 320,
                      borderRadius: 8,
                      background: "#000",
                    }}
                  />
                ) : embed ? (
                  <div
                    style={{
                      position: "relative",
                      paddingBottom: "56.25%",
                      borderRadius: 8,
                      overflow: "hidden",
                      background: "#000",
                    }}
                  >
                    <iframe
                      src={embed}
                      title={m.title ?? "highlight"}
                      style={{
                        position: "absolute",
                        inset: 0,
                        width: "100%",
                        height: "100%",
                        border: "none",
                      }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "block",
                      padding: "20px",
                      background: "#f8fafc",
                      borderRadius: 8,
                      textAlign: "center",
                      color: "#1e3a8a",
                      fontWeight: 800,
                      textDecoration: "none",
                      wordBreak: "break-all",
                    }}
                  >
                    ↗ {m.url}
                  </a>
                )}
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ fontWeight: 800, color: "#0f172a", flex: 1, minWidth: 0 }}>
                    {m.title || t("未命名集锦", "Untitled clip")}
                    {m.visibility === "members_only" && (
                      <span
                        style={{
                          marginLeft: 8,
                          padding: "2px 6px",
                          fontSize: 10,
                          background: "#fef3c7",
                          color: "#92400e",
                          borderRadius: 4,
                          fontWeight: 800,
                          letterSpacing: "0.04em",
                          textTransform: "uppercase",
                        }}
                      >
                        {t("仅成员", "Members")}
                      </span>
                    )}
                  </div>
                  {canManage && (
                    <button
                      onClick={() => remove(m.id)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#991b1b",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    >
                      {t("删除", "Delete")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function inputStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    ...extra,
  };
}
