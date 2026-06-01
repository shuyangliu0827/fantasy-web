"use client";

// components/basketball/PlayerHighlights.tsx
//
// Player Highlights section — featured card, gallery, inline upload/edit
// form, empty state. Visibility-aware: edit affordances render only when
// the API reports `permissions.canCreate / canEditAny` for the viewer.
//
// Upload flow lives directly on the player page (no modal route): an
// expanding panel under the section header keeps the interaction one
// click away on both desktop and mobile.

import { useCallback, useEffect, useState } from "react";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import {
  uploadBasketballPlayerHighlightImage,
  uploadBasketballPlayerHighlightVideo,
} from "@/lib/basketball/uploads";
import { useLang } from "@/lib/lang";

type MediaType = "image" | "video_file" | "video_link";
type Visibility = "public" | "members_only";

type Highlight = {
  id: string;
  basketball_league_id: string;
  player_id: string;
  created_by: string;
  media_type: MediaType;
  media_url: string | null;
  external_url: string | null;
  thumbnail_url: string | null;
  storage_path: string | null;
  title: string;
  description: string | null;
  game_opponent: string | null;
  highlight_date: string | null;
  tag: string | null;
  is_featured: boolean;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
};

function playableUrl(h: Highlight): string {
  return h.media_type === "video_link"
    ? (h.external_url ?? "")
    : (h.media_url ?? "");
}

type Permissions = {
  canCreate: boolean;
  canEditAny: boolean;
  canFeature: boolean;
  isAdminLike: boolean;
  isTeamManagerOfPlayer: boolean;
  isOwnerOfPlayer: boolean;
};

type Props = {
  playerId: string;
};

export default function PlayerHighlights({ playerId }: Props) {
  const { t } = useLang();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [perms, setPerms] = useState<Permissions | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Highlight | null>(null);

  const load = useCallback(async () => {
    const res = await basketballJson<{
      highlights: Highlight[];
      permissions: Permissions;
    }>(`/api/basketball-players/${playerId}/highlights`);
    if (res.error || !res.data) {
      setError(res.error ?? "load_failed");
      setLoading(false);
      return;
    }
    setHighlights(res.data.highlights);
    setPerms(res.data.permissions);
    setError(null);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    void load(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [load]);

  const onSaved = () => {
    setShowForm(false);
    setEditing(null);
    load();
  };

  const featured = highlights.find((h) => h.is_featured) ?? null;
  const gallery = highlights.filter((h) => h.id !== featured?.id);

  return (
    <section style={{ marginTop: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 12,
        }}
      >
        <h2
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
            margin: 0,
          }}
        >
          {t("球员精彩瞬间", "Player Highlights")}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            · {highlights.length}
          </span>
        </h2>
        {perms?.canCreate && !showForm && !editing && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            style={{
              padding: "8px 14px",
              background: "#1e3a8a",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            + {t("上传精彩瞬间", "Add Highlight")}
          </button>
        )}
      </div>

      {(showForm || editing) && perms && (
        <HighlightForm
          playerId={playerId}
          existing={editing}
          canFeature={perms.canFeature}
          onCancel={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      )}

      {loading ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 18,
            color: "#94a3b8",
            fontSize: 14,
          }}
        >
          {t("加载中…", "Loading…")}
        </div>
      ) : error ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #fecaca",
            borderRadius: 12,
            padding: 18,
            color: "#991b1b",
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          {error}
        </div>
      ) : highlights.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {featured && (
            <FeaturedHighlightCard
              highlight={featured}
              perms={perms}
              onEdit={() => setEditing(featured)}
              onChanged={load}
            />
          )}
          {gallery.length > 0 && (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fill, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              {gallery.map((h) => (
                <GalleryCard
                  key={h.id}
                  highlight={h}
                  perms={perms}
                  onEdit={() => setEditing(h)}
                  onChanged={load}
                />
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function EmptyState() {
  const { t } = useLang();
  return (
    <div
      style={{
        background: "#fff",
        border: "1px dashed #cbd5e1",
        borderRadius: 12,
        padding: 22,
        color: "#64748b",
        fontSize: 14,
        lineHeight: 1.55,
        textAlign: "center",
      }}
    >
      {t(
        "暂无精彩瞬间。上传比赛集锦、照片或关键时刻，丰富该球员的档案。",
        "No highlights yet. Upload game clips, photos, or key moments to build this player's profile.",
      )}
    </div>
  );
}

function FeaturedHighlightCard({
  highlight,
  perms,
  onEdit,
  onChanged,
}: {
  highlight: Highlight;
  perms: Permissions | null;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const canMutate =
    !!perms &&
    (perms.isAdminLike ||
      perms.isTeamManagerOfPlayer ||
      perms.isOwnerOfPlayer);
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "minmax(0, 1.2fr) minmax(0, 1fr)",
          gap: 0,
        }}
        className="bp-featured-grid"
      >
        <Thumbnail highlight={highlight} large />
        <div
          style={{
            padding: 18,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                background: "#fef3c7",
                color: "#92400e",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "3px 8px",
                borderRadius: 999,
              }}
            >
              ★ {t("精选", "Featured")}
            </span>
            {highlight.tag && <TagChip text={highlight.tag} />}
            {highlight.visibility === "members_only" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#64748b",
                  background: "#f1f5f9",
                  padding: "3px 8px",
                  borderRadius: 999,
                }}
              >
                {t("仅成员可见", "Members only")}
              </span>
            )}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
            }}
          >
            {highlight.title}
          </h3>
          <MetaRow highlight={highlight} />
          {highlight.description && (
            <p
              style={{
                margin: 0,
                color: "#475569",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              {highlight.description}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
            <ViewButton highlight={highlight} primary />
            {canMutate && (
              <>
                <button
                  type="button"
                  onClick={onEdit}
                  style={ghostButtonStyle()}
                >
                  {t("编辑", "Edit")}
                </button>
                <DeleteButton highlight={highlight} onDeleted={onChanged} />
              </>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 720px) {
          .bp-featured-grid { grid-template-columns: minmax(0, 1fr) !important; }
        }
      `}</style>
    </article>
  );
}

function GalleryCard({
  highlight,
  perms,
  onEdit,
  onChanged,
}: {
  highlight: Highlight;
  perms: Permissions | null;
  onEdit: () => void;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const canMutate =
    !!perms &&
    (perms.isAdminLike ||
      perms.isTeamManagerOfPlayer ||
      perms.isOwnerOfPlayer);
  return (
    <article
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
      }}
    >
      <Thumbnail highlight={highlight} />
      <div
        style={{
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 6,
          minWidth: 0,
        }}
      >
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {highlight.tag && <TagChip text={highlight.tag} small />}
          {highlight.visibility === "members_only" && (
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#64748b",
                background: "#f1f5f9",
                padding: "2px 6px",
                borderRadius: 999,
              }}
            >
              {t("仅成员", "Members")}
            </span>
          )}
        </div>
        <h4
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 800,
            color: "#0f172a",
            lineHeight: 1.25,
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {highlight.title}
        </h4>
        <MetaRow highlight={highlight} small />
        {highlight.description && (
          <p
            style={{
              margin: 0,
              color: "#64748b",
              fontSize: 12.5,
              lineHeight: 1.45,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {highlight.description}
          </p>
        )}
        <div
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            marginTop: 4,
          }}
        >
          <ViewButton highlight={highlight} />
          {canMutate && (
            <>
              <button
                type="button"
                onClick={onEdit}
                style={ghostButtonStyle(true)}
              >
                {t("编辑", "Edit")}
              </button>
              <DeleteButton highlight={highlight} onDeleted={onChanged} small />
            </>
          )}
          {perms?.canFeature && !highlight.is_featured && (
            <FeatureButton highlight={highlight} onChanged={onChanged} />
          )}
        </div>
      </div>
    </article>
  );
}

function Thumbnail({
  highlight,
  large = false,
}: {
  highlight: Highlight;
  large?: boolean;
}) {
  const aspect = "16 / 10";
  const isImage = highlight.media_type === "image";
  const isVideoFile = highlight.media_type === "video_file";
  // Prefer thumbnail_url when set; fall back to the image itself for image
  // highlights. Video files render an inline <video> with controls so the
  // viewer can preview without leaving the page.
  const showImage = isImage || highlight.thumbnail_url;
  return (
    <div
      style={{
        position: "relative",
        background:
          "linear-gradient(135deg, #1e3a8a 0%, #312e81 60%, #4c1d95 100%)",
        aspectRatio: aspect,
        overflow: "hidden",
      }}
    >
      {isVideoFile && !highlight.thumbnail_url ? (
        <video
          src={highlight.media_url ?? undefined}
          controls
          preload="metadata"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
            background: "#000",
          }}
        />
      ) : showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            (isImage ? highlight.media_url : highlight.thumbnail_url) ??
            undefined
          }
          alt={highlight.title}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
          }}
        >
          <PlayIcon size={large ? 56 : 40} />
        </div>
      )}
    </div>
  );
}

function PlayIcon({ size }: { size: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(255,255,255,0.18)",
        border: "2px solid rgba(255,255,255,0.85)",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        style={{
          width: 0,
          height: 0,
          borderLeft: `${size * 0.28}px solid #fff`,
          borderTop: `${size * 0.2}px solid transparent`,
          borderBottom: `${size * 0.2}px solid transparent`,
          marginLeft: size * 0.08,
        }}
      />
    </span>
  );
}

function MetaRow({
  highlight,
  small = false,
}: {
  highlight: Highlight;
  small?: boolean;
}) {
  const { t } = useLang();
  const parts: string[] = [];
  if (highlight.game_opponent) {
    parts.push(t(`对阵 ${highlight.game_opponent}`, `vs ${highlight.game_opponent}`));
  }
  if (highlight.highlight_date) {
    parts.push(highlight.highlight_date);
  }
  if (parts.length === 0) return null;
  return (
    <div
      style={{
        color: "#64748b",
        fontSize: small ? 11.5 : 13,
        fontWeight: 600,
      }}
    >
      {parts.join(" · ")}
    </div>
  );
}

function TagChip({ text, small = false }: { text: string; small?: boolean }) {
  return (
    <span
      style={{
        background: "#eff6ff",
        color: "#1e3a8a",
        fontSize: small ? 10 : 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        padding: small ? "2px 6px" : "3px 8px",
        borderRadius: 999,
      }}
    >
      #{text}
    </span>
  );
}

function ViewButton({
  highlight,
  primary = false,
}: {
  highlight: Highlight;
  primary?: boolean;
}) {
  const { t } = useLang();
  const label =
    highlight.media_type === "image"
      ? t("查看", "View")
      : t("观看", "Watch");
  return (
    <a
      href={playableUrl(highlight)}
      target="_blank"
      rel="noopener noreferrer"
      style={
        primary
          ? {
              padding: "8px 14px",
              background: "#1e3a8a",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }
          : {
              padding: "6px 12px",
              background: "#fff",
              color: "#1e3a8a",
              border: "1px solid #bfdbfe",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 800,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }
      }
    >
      {label} →
    </a>
  );
}

function DeleteButton({
  highlight,
  onDeleted,
  small = false,
}: {
  highlight: Highlight;
  onDeleted: () => void;
  small?: boolean;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const click = async () => {
    if (
      !window.confirm(
        t("确认删除该精彩瞬间吗？", "Delete this highlight?"),
      )
    )
      return;
    setBusy(true);
    const res = await basketballFetch(
      `/api/basketball-players/${highlight.player_id}/highlights/${highlight.id}`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    onDeleted();
  };
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      style={{
        padding: small ? "6px 10px" : "8px 12px",
        background: "#fff",
        color: "#991b1b",
        border: "1px solid #fecaca",
        borderRadius: 999,
        fontSize: small ? 12 : 13,
        fontWeight: 800,
        cursor: busy ? "default" : "pointer",
      }}
    >
      {busy ? t("删除中…", "Deleting…") : t("删除", "Delete")}
    </button>
  );
}

function FeatureButton({
  highlight,
  onChanged,
}: {
  highlight: Highlight;
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const click = async () => {
    setBusy(true);
    const res = await basketballFetch(
      `/api/basketball-players/${highlight.player_id}/highlights/${highlight.id}`,
      {
        method: "PATCH",
        body: JSON.stringify({ is_featured: true }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      window.alert((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    onChanged();
  };
  return (
    <button
      type="button"
      onClick={click}
      disabled={busy}
      style={{
        padding: "6px 10px",
        background: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 800,
        cursor: busy ? "default" : "pointer",
      }}
    >
      ★ {busy ? t("设置中…", "Setting…") : t("设为精选", "Feature")}
    </button>
  );
}

function ghostButtonStyle(small = false): React.CSSProperties {
  return {
    padding: small ? "6px 10px" : "8px 12px",
    background: "#fff",
    color: "#0f172a",
    border: "1px solid #cbd5e1",
    borderRadius: 999,
    fontSize: small ? 12 : 13,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function HighlightForm({
  playerId,
  existing,
  canFeature,
  onCancel,
  onSaved,
}: {
  playerId: string;
  existing: Highlight | null;
  canFeature: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [mediaType, setMediaType] = useState<MediaType>(
    existing?.media_type ?? "video_link",
  );
  const [videoUrl, setVideoUrl] = useState(
    existing?.media_type === "video_link"
      ? (existing.external_url ?? "")
      : "",
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    existing?.media_type === "image" ? existing.media_url : null,
  );
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoFilePreview, setVideoFilePreview] = useState<string | null>(
    existing?.media_type === "video_file" ? existing.media_url : null,
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [gameOpponent, setGameOpponent] = useState(
    existing?.game_opponent ?? "",
  );
  const [highlightDate, setHighlightDate] = useState(
    existing?.highlight_date ?? "",
  );
  const [tag, setTag] = useState(existing?.tag ?? "");
  const [isFeatured, setIsFeatured] = useState(existing?.is_featured ?? false);
  const [visibility, setVisibility] = useState<Visibility>(
    existing?.visibility ?? "public",
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onImageChange = (file: File | null) => {
    setImageFile(file);
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setImagePreview(String(e.target?.result ?? ""));
      reader.readAsDataURL(file);
    } else if (existing?.media_type === "image") {
      setImagePreview(existing.media_url);
    } else {
      setImagePreview(null);
    }
  };

  const onVideoChange = (file: File | null) => {
    setVideoFile(file);
    if (file) {
      const objectUrl = URL.createObjectURL(file);
      setVideoFilePreview(objectUrl);
    } else if (existing?.media_type === "video_file") {
      setVideoFilePreview(existing.media_url);
    } else {
      setVideoFilePreview(null);
    }
  };

  const submit = async () => {
    setErr(null);
    if (!title.trim()) {
      setErr(t("请填写标题。", "Title is required."));
      return;
    }
    if (mediaType === "video_link") {
      if (!videoUrl.trim() || !/^https?:\/\//i.test(videoUrl.trim())) {
        setErr(t("请填写有效的视频链接。", "Enter a valid video URL."));
        return;
      }
    }
    if (mediaType === "image" && !imageFile && !existing) {
      setErr(t("请选择一张图片。", "Please choose an image."));
      return;
    }
    if (mediaType === "video_file" && !videoFile && !existing) {
      setErr(t("请选择一个视频文件。", "Please choose a video file."));
      return;
    }

    setBusy(true);
    try {
      let mediaUrl: string | null = null;
      let externalUrl: string | null = null;
      let storagePath: string | null = null;

      if (mediaType === "image") {
        if (imageFile) {
          try {
            const uploaded = await uploadBasketballPlayerHighlightImage(
              playerId,
              imageFile,
            );
            mediaUrl = uploaded.url;
            storagePath = uploaded.storage_path;
          } catch (e) {
            setErr(
              e instanceof Error ? e.message : t("上传失败", "Upload failed"),
            );
            return;
          }
        } else if (existing?.media_type === "image") {
          mediaUrl = existing.media_url;
          storagePath = existing.storage_path;
        }
      } else if (mediaType === "video_file") {
        if (videoFile) {
          try {
            const uploaded = await uploadBasketballPlayerHighlightVideo(
              playerId,
              videoFile,
            );
            mediaUrl = uploaded.url;
            storagePath = uploaded.storage_path;
          } catch (e) {
            setErr(
              e instanceof Error ? e.message : t("上传失败", "Upload failed"),
            );
            return;
          }
        } else if (existing?.media_type === "video_file") {
          mediaUrl = existing.media_url;
          storagePath = existing.storage_path;
        }
      } else {
        // video_link
        externalUrl = videoUrl.trim();
      }

      const payload: Record<string, unknown> = {
        title: title.trim(),
        media_type: mediaType,
        media_url: mediaUrl,
        external_url: externalUrl,
        description: description.trim() || null,
        game_opponent: gameOpponent.trim() || null,
        highlight_date: highlightDate || null,
        tag: tag.trim() || null,
        visibility,
      };
      if (storagePath !== null) payload.storage_path = storagePath;
      if (canFeature) payload.is_featured = isFeatured;

      const url = existing
        ? `/api/basketball-players/${playerId}/highlights/${existing.id}`
        : `/api/basketball-players/${playerId}/highlights`;
      const method = existing ? "PATCH" : "POST";
      const res = await basketballFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          fontWeight: 800,
          color: "#0f172a",
          fontSize: 15,
        }}
      >
        {existing
          ? t("编辑精彩瞬间", "Edit Highlight")
          : t("上传精彩瞬间", "Add Highlight")}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t("标题 (必填)", "Title (required)")}
        style={inputStyle()}
        maxLength={160}
      />

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <label style={radioLabel()}>
          <input
            type="radio"
            name="media-type"
            checked={mediaType === "image"}
            onChange={() => setMediaType("image")}
          />
          {t("图片上传", "Image upload")}
        </label>
        <label style={radioLabel()}>
          <input
            type="radio"
            name="media-type"
            checked={mediaType === "video_file"}
            onChange={() => setMediaType("video_file")}
          />
          {t("视频文件上传", "Video file upload")}
        </label>
        <label style={radioLabel()}>
          <input
            type="radio"
            name="media-type"
            checked={mediaType === "video_link"}
            onChange={() => setMediaType("video_link")}
          />
          {t("外部视频链接", "External video link")}
        </label>
      </div>

      {mediaType === "video_link" && (
        <input
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder={t(
            "https://… (YouTube / Bilibili / 直接链接)",
            "https://… (YouTube / Bilibili / direct URL)",
          )}
          style={inputStyle()}
          maxLength={2000}
        />
      )}

      {mediaType === "image" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => onImageChange(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          {imagePreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePreview}
              alt=""
              style={{
                maxHeight: 180,
                borderRadius: 10,
                objectFit: "cover",
                border: "1px solid #e2e8f0",
                alignSelf: "flex-start",
              }}
            />
          )}
        </div>
      )}

      {mediaType === "video_file" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/x-m4v"
            onChange={(e) => onVideoChange(e.target.files?.[0] ?? null)}
            style={{ fontSize: 13 }}
          />
          <div style={{ fontSize: 11, color: "#94a3b8" }}>
            {t(
              "最大 100MB · 支持 MP4 / WebM / MOV",
              "Max 100 MB · MP4 / WebM / MOV supported",
            )}
          </div>
          {videoFilePreview && (
            <video
              src={videoFilePreview}
              controls
              preload="metadata"
              style={{
                maxHeight: 220,
                borderRadius: 10,
                background: "#000",
                border: "1px solid #e2e8f0",
                alignSelf: "flex-start",
                width: "100%",
                maxWidth: 360,
              }}
            />
          )}
        </div>
      )}

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("描述 (可选)", "Description (optional)")}
        rows={3}
        style={{
          ...inputStyle(),
          minHeight: 70,
          padding: "8px 12px",
          fontFamily: "inherit",
          resize: "vertical",
        }}
        maxLength={2000}
      />

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={gameOpponent}
          onChange={(e) => setGameOpponent(e.target.value)}
          placeholder={t("对阵 / 比赛 (可选)", "Game / opponent (optional)")}
          style={{ ...inputStyle(), flex: "2 1 200px" }}
          maxLength={160}
        />
        <input
          value={highlightDate}
          onChange={(e) => setHighlightDate(e.target.value)}
          type="date"
          style={{ ...inputStyle(), flex: "1 1 150px" }}
        />
        <input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder={t("标签 (例如: 绝杀)", "Tag (e.g. game-winner)")}
          style={{ ...inputStyle(), flex: "1 1 140px" }}
          maxLength={60}
        />
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
          fontSize: 13,
          color: "#475569",
        }}
      >
        <label style={toggleLabel()}>
          <input
            type="checkbox"
            checked={visibility === "public"}
            onChange={(e) =>
              setVisibility(e.target.checked ? "public" : "members_only")
            }
          />
          {t("公开可见", "Public visibility")}
        </label>
        {canFeature && (
          <label style={toggleLabel()}>
            <input
              type="checkbox"
              checked={isFeatured}
              onChange={(e) => setIsFeatured(e.target.checked)}
            />
            ★ {t("设为精选", "Featured highlight")}
          </label>
        )}
      </div>

      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          style={{
            padding: "8px 16px",
            background: busy ? "#94a3b8" : "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy
            ? t("保存中…", "Saving…")
            : existing
              ? t("保存", "Save")
              : t("发布", "Publish")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            color: "#0f172a",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {t("取消", "Cancel")}
        </button>
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
    color: "#0f172a",
  };
}
function radioLabel(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    fontWeight: 700,
    color: "#0f172a",
  };
}
function toggleLabel(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  };
}
