"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";

type Media = {
  id: string;
  title: string | null;
  url: string;
  media_type: "link" | "video" | "image";
  visibility: "public" | "members_only";
  created_at: string;
};

type Props = {
  gameId: string;
  /** Whether the current viewer can add/remove media (league admin / platform admin). */
  canManage: boolean;
};

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

export default function GameMediaList({ gameId, canManage }: Props) {
  const { t } = useLang();
  const [media, setMedia] = useState<Media[]>([]);
  const [url, setUrl] = useState("");
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

  const add = async () => {
    if (!url.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(`/api/basketball-games/${gameId}/media`, {
      method: "POST",
      body: JSON.stringify({
        url: url.trim(),
        title: title.trim() || undefined,
        visibility,
        media_type: "link",
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setUrl("");
    setTitle("");
    load();
  };

  const remove = async (id: string) => {
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
            gap: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("视频链接 (YouTube / Bilibili / 其他)", "Video URL (YouTube / Bilibili / other)")}
              style={inputStyle({ flex: "2 1 320px" })}
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("标题（可选）", "Title (optional)")}
              style={inputStyle({ flex: "1 1 180px" })}
            />
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as "public" | "members_only")}
              style={inputStyle({ flex: "0 0 130px" })}
            >
              <option value="public">{t("所有人可见", "public")}</option>
              <option value="members_only">{t("仅成员可见", "members_only")}</option>
            </select>
            <button
              onClick={add}
              disabled={busy}
              style={{
                minHeight: 40,
                padding: "0 18px",
                background: busy ? "#94a3b8" : "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 800,
                cursor: busy ? "default" : "pointer",
              }}
            >
              {busy ? t("添加中…", "Adding…") : t("添加链接", "Add link")}
            </button>
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
          {t("尚无集锦", "No highlights yet.")}
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
            const embed = toEmbedSrc(m.url);
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
                {embed ? (
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
