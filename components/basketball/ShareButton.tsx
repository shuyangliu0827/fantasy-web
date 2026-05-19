"use client";

// components/basketball/ShareButton.tsx
//
// Reusable share button for community basketball league public pages
// (league, team, player, game). Prefers navigator.share when available
// (mobile native sheet); falls back to clipboard copy with a small toast.
// All visible copy goes through useLang()'s t(zh, en).

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { copyText } from "@/lib/shared/copy-text";

type Props = {
  /** Visible label override. Defaults to "分享 / Share". */
  label?: string;
  /** Optional title hint passed to navigator.share. */
  shareTitle?: string;
  /** Optional short text passed to navigator.share. */
  shareText?: string;
  /**
   * Canonical URL to share. If omitted, falls back to window.location.href
   * at click time. Pass an absolute URL when you have one available so the
   * native share sheet shows the right link.
   */
  url?: string;
  /** Visual style. "primary" = filled navy, "ghost" = white w/ border. */
  variant?: "primary" | "ghost";
  /** Pill (default) or rounded rectangle. */
  shape?: "pill" | "rounded";
  /** Tighter padding for crowded action rows. */
  compact?: boolean;
};

const ShareIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

export default function ShareButton({
  label,
  shareTitle,
  shareText,
  url,
  variant = "ghost",
  shape = "pill",
  compact = false,
}: Props) {
  const { t } = useLang();
  const [toast, setToast] = useState<string | null>(null);

  const handleShare = async () => {
    const resolvedUrl =
      url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!resolvedUrl) return;
    // Prefer native share sheet on mobile. If the user cancels we silently
    // bail — the AbortError is normal user behavior, not a copy fallback
    // trigger.
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: resolvedUrl,
        });
        return;
      } catch (e) {
        const name = (e as { name?: string } | null)?.name;
        if (name === "AbortError") return;
        // Otherwise fall through to clipboard copy.
      }
    }
    try {
      await copyText(resolvedUrl);
      showToast(t("链接已复制", "Link copied"));
    } catch {
      showToast(
        t("复制失败，请手动复制链接", "Copy failed. Please copy the link manually."),
      );
    }
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const isPrimary = variant === "primary";
  const radius = shape === "pill" ? 999 : 10;
  const padding = compact ? "6px 12px" : "8px 16px";
  const fontSize = compact ? 12 : 13;

  return (
    <>
      <button
        onClick={handleShare}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding,
          background: isPrimary ? "#1e3a8a" : "#fff",
          color: isPrimary ? "#fff" : "#1e3a8a",
          border: isPrimary ? "none" : "1px solid #bfdbfe",
          borderRadius: radius,
          fontSize,
          fontWeight: 800,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <ShareIcon />
        {label ?? t("分享", "Share")}
      </button>
      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 9999,
            padding: "10px 20px",
            background: "#0f172a",
            color: "#fff",
            borderRadius: 20,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
            maxWidth: "calc(100vw - 32px)",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
