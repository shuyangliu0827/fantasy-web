"use client";
// components/discover/PostShareButton.tsx
//
// Reusable share button for Insight/Discover posts.
// Shows a bottom-sheet modal with:
//   - Copy link  → navigator.clipboard (+ execCommand fallback)
//   - Copy share text (title + link)
// No WeChat SDK — user pastes into WeChat/Moments manually.

import { useState } from "react";
import { useLang } from "@/lib/lang";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type Props = {
  postId: string;
  title?: string;
  body?: string;
  /** Optional extra className for the trigger button wrapper. */
  className?: string;
};

async function copyText(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // execCommand fallback for older/restricted browsers
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;left:-9999px;top:-9999px;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) resolve(); else reject(new Error("execCommand copy failed"));
    } catch (err) {
      document.body.removeChild(ta);
      reject(err);
    }
  });
}

// SVG icons — inline so no external dep
const IconShare = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);
const IconLink = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1e3a8a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);
const IconChat = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

export default function PostShareButton({ postId, title, body }: Props) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const postUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/discover/${postId}`
      : `/discover/${postId}`;

  const shareText = title
    ? `「${title}」\n\n我在 Blueprint Fantasy 看到一篇很有意思的篮球观点：\n${postUrl}`
    : `我在 Blueprint Fantasy 看到一篇很有意思的篮球观点：\n「${(body ?? "").slice(0, 50)}...」\n\n${postUrl}`;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  }

  async function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await copyText(postUrl);
      showToast(t("链接已复制，可以粘贴到微信分享 ✓", "Link copied — paste to share ✓"));
    } catch {
      showToast(t("复制失败，请手动复制链接", "Copy failed — please copy manually"));
    }
    setOpen(false);
  }

  async function handleCopyShareText(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await copyText(shareText);
      showToast(t("分享文案已复制，可以粘贴到朋友圈 ✓", "Share text copied — paste to Moments ✓"));
    } catch {
      showToast(t("复制失败，请手动复制", "Copy failed — please copy manually"));
    }
    setOpen(false);
  }

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title={t("分享", "Share")}
        aria-label={t("分享帖子", "Share post")}
        style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 5,
          minWidth: 36, minHeight: 36, padding: "7px 11px",
          background: "transparent", border: "1.5px solid #e2e8f0",
          borderRadius: 8, color: "#64748b",
          fontSize: 13, fontWeight: 600, fontFamily: FONT,
          cursor: "pointer", transition: "all 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.background = "#f1f5f9";
          el.style.borderColor = "#cbd5e1";
          el.style.color = "#374151";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.background = "transparent";
          el.style.borderColor = "#e2e8f0";
          el.style.color = "#64748b";
        }}
      >
        <IconShare />
        <span>{t("分享", "Share")}</span>
      </button>

      {/* ── Bottom-sheet overlay ── */}
      {open && (
        <div
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
          style={{
            position: "fixed", inset: 0, zIndex: 9000,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "flex-end", justifyContent: "center",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              padding: "18px 20px 36px",
              width: "100%", maxWidth: 520,
              boxShadow: "0 -8px 32px rgba(0,0,0,0.12)",
              fontFamily: FONT,
            }}
          >
            {/* Drag handle */}
            <div style={{ width: 40, height: 4, background: "#e2e8f0", borderRadius: 2, margin: "0 auto 18px" }} />

            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 16 }}>
              {t("分享帖子", "Share Post")}
            </div>

            {/* Copy link */}
            <button
              onClick={handleCopyLink}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "13px 16px", marginBottom: 10,
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 14, cursor: "pointer", textAlign: "left",
                fontFamily: FONT, transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#eff6ff"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: "#eff6ff",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <IconLink />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {t("复制链接", "Copy Link")}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {t("粘贴到微信私聊 / 群 / 微博等", "Paste to WeChat, DMs, Weibo, etc.")}
                </div>
              </div>
            </button>

            {/* Copy share text */}
            <button
              onClick={handleCopyShareText}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 14,
                padding: "13px 16px", marginBottom: 14,
                background: "#f8fafc", border: "1.5px solid #e2e8f0",
                borderRadius: 14, cursor: "pointer", textAlign: "left",
                fontFamily: FONT, transition: "background 0.12s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#fffbeb"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc"; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 11,
                background: "#fffbeb",
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <IconChat />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {t("复制分享文案", "Copy Share Text")}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {t("带标题和链接，适合发朋友圈", "Includes title + link — great for Moments")}
                </div>
              </div>
            </button>

            {/* Cancel */}
            <button
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              style={{
                width: "100%", padding: "12px",
                background: "#fff", border: "1.5px solid #e2e8f0",
                borderRadius: 12, fontSize: 14, fontWeight: 600,
                color: "#64748b", cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {t("取消", "Cancel")}
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)",
            zIndex: 9999, padding: "10px 20px",
            background: "#0f172a", color: "#fff",
            borderRadius: 20, fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap", maxWidth: "calc(100vw - 32px)",
            textAlign: "center", pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
