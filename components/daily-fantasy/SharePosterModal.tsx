"use client";
// components/daily-fantasy/SharePosterModal.tsx
//
// Modal that previews a lineup or result poster and lets the user:
//   1. Download as PNG (html-to-image toPng, pixelRatio:3 → 1080px)
//   2. Share to Moments — copies a fixed share text + page URL to clipboard
//
// Usage:
//   <SharePosterModal
//     open={open}
//     onClose={() => setOpen(false)}
//     posterType="lineup"          // or "result"
//     posterProps={...}
//     lang="zh"
//   />

import React, { useRef, useState, useCallback } from "react";
import { toPng } from "html-to-image";
import LineupPoster, { LineupPosterProps } from "./posters/LineupPoster";
import ResultPoster, { ResultPosterProps } from "./posters/ResultPoster";

type ModalProps =
  | { posterType: "lineup"; posterProps: LineupPosterProps; lang: "zh" | "en"; open: boolean; onClose: () => void }
  | { posterType: "result"; posterProps: ResultPosterProps; lang: "zh" | "en"; open: boolean; onClose: () => void };

type ExportState = "idle" | "exporting" | "done" | "error";
type ShareState  = "idle" | "sharing" | "shared" | "error";

function buildShareText(posterType: "lineup" | "result", shareUrl: string, lang: "zh" | "en"): string {
  if (lang === "en") {
    if (posterType === "result") {
      return `I just shared my Daily Fantasy results on Blueprint Fantasy.\nBasketball is more than watching — it's about knowing who to pick.\nCan your lineup beat mine?\n\n${shareUrl}`;
    }
    return `I just built my Daily Fantasy lineup on Blueprint Fantasy.\nBasketball is more than watching — it's about knowing who to pick.\nCome challenge my basketball GM instincts:\n\n${shareUrl}`;
  }
  if (posterType === "result") {
    return `我在 Blueprint Fantasy 晒出了我的今日 Daily Fantasy 战绩。\n篮球不只是看比赛，更要看谁更懂选人。\n来看看你的阵容能不能超过我：\n\n${shareUrl}`;
  }
  return `我在 Blueprint Fantasy 组了一套今日 Daily Fantasy 阵容。\n篮球不只是看比赛，更要看谁更懂选人。\n来挑战一下你的篮球经理眼光：\n\n${shareUrl}`;
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // execCommand fallback
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

export default function SharePosterModal(props: ModalProps) {
  const { open, onClose, posterType, posterProps, lang } = props;
  const posterRef = useRef<HTMLDivElement>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [shareState,  setShareState]  = useState<ShareState>("idle");
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const t = (zh: string, en: string) => lang === "zh" ? zh : en;

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  }

  const getDataUrl = useCallback(async (): Promise<string> => {
    if (!posterRef.current) throw new Error("poster ref missing");
    return toPng(posterRef.current, { pixelRatio: 3, cacheBust: true });
  }, []);

  const handleDownload = useCallback(async () => {
    setExportState("exporting");
    try {
      const dataUrl = await getDataUrl();
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `blueprint-fantasy-${posterType}-${Date.now()}.png`;
      a.click();
      setExportState("done");
    } catch {
      setExportState("error");
    }
  }, [getDataUrl, posterType]);

  const handleShareToMoments = useCallback(async () => {
    setShareState("sharing");
    const shareUrl = typeof window !== "undefined"
      ? `${window.location.origin}/contest/nba`
      : "/contest/nba";
    const shareText = buildShareText(posterType, shareUrl, lang);
    try {
      await copyTextToClipboard(shareText);
      setShareState("shared");
      showToast(
        t("分享文案已复制，请保存海报后粘贴到微信 / 朋友圈", "Share text copied — save the poster then paste to Moments"),
        true,
      );
      setTimeout(() => setShareState("idle"), 2500);
    } catch {
      setShareState("error");
      showToast(
        t("复制失败，请手动复制分享文案", "Copy failed — please copy the share text manually"),
        false,
      );
      setTimeout(() => setShareState("idle"), 2500);
    }
  }, [posterType, lang, t]);

  if (!open) return null;

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 8, fontWeight: 700, fontSize: 14,
    cursor: "pointer", border: "none", transition: "opacity 0.15s",
  };

  const posterLabel = posterType === "result"
    ? t("分享战绩", "Share Results")
    : t("分享阵容", "Share Lineup");

  return (
    <>
      <div
        style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.72)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "16px",
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div style={{
          background: "#0f172a",
          border: "1px solid rgba(59,130,246,0.25)",
          borderRadius: 16,
          overflow: "hidden",
          width: "min(400px, 100%)",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,130,246,0.15)",
        }}>
          {/* Modal header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px 12px",
            borderBottom: "1px solid rgba(59,130,246,0.15)",
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#f1f5f9" }}>
                {posterLabel}
              </div>
              <div style={{ fontSize: 11, color: "rgba(148,163,184,0.65)", marginTop: 2 }}>
                {t("保存海报，再复制文案分享到朋友圈", "Save poster, then copy text to share")}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.6)",
                fontSize: 16, cursor: "pointer", lineHeight: 1,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >×</button>
          </div>

          {/* Poster preview — scrollable if tall */}
          <div style={{
            padding: "16px 20px",
            maxHeight: "60vh",
            overflowY: "auto",
            display: "flex",
            justifyContent: "center",
          }}>
            <div style={{
              transform: "scale(0.88)",
              transformOrigin: "top center",
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {posterType === "lineup" ? (
                <LineupPoster ref={posterRef} {...(posterProps as LineupPosterProps)} />
              ) : (
                <ResultPoster ref={posterRef} {...(posterProps as ResultPosterProps)} />
              )}
            </div>
          </div>

          {/* Hint */}
          <div style={{
            margin: "0 20px 12px",
            padding: "8px 12px",
            background: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.18)",
            borderRadius: 8,
            fontSize: 11,
            color: "rgba(147,197,253,0.8)",
            lineHeight: 1.5,
          }}>
            💡 {t(
              "朋友圈分享建议：先点「保存图片」，再点「分享到朋友圈」复制文案，粘贴即可。",
              "Tip: tap “Save Image” first, then “Share to Moments” to copy the text — paste both into your post.",
            )}
          </div>

          {/* Action buttons */}
          <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
            {/* Save image */}
            <button
              onClick={handleDownload}
              disabled={exportState === "exporting"}
              style={{
                ...btnBase,
                flex: 1,
                background: exportState === "error"
                  ? "rgba(239,68,68,0.2)"
                  : exportState === "done"
                  ? "rgba(34,197,94,0.2)"
                  : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                color: exportState === "error"
                  ? "#f87171"
                  : exportState === "done"
                  ? "#4ade80"
                  : "#fff",
                opacity: exportState === "exporting" ? 0.65 : 1,
              }}
            >
              {exportState === "exporting"
                ? t("生成中…", "Generating…")
                : exportState === "done"
                ? t("✓ 已保存", "✓ Saved")
                : exportState === "error"
                ? t("失败，重试", "Failed, retry")
                : t("⬇ 保存图片", "⬇ Save Image")}
            </button>

            {/* Share to Moments */}
            <button
              onClick={handleShareToMoments}
              disabled={shareState === "sharing"}
              style={{
                ...btnBase,
                flex: 1,
                background: shareState === "error"
                  ? "rgba(239,68,68,0.15)"
                  : shareState === "shared"
                  ? "rgba(34,197,94,0.15)"
                  : "rgba(255,255,255,0.07)",
                border: `1px solid ${shareState === "shared" ? "rgba(74,222,128,0.4)" : shareState === "error" ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.12)"}`,
                color: shareState === "shared"
                  ? "#4ade80"
                  : shareState === "error"
                  ? "#f87171"
                  : "#e2e8f0",
                opacity: shareState === "sharing" ? 0.65 : 1,
              }}
            >
              {shareState === "sharing"
                ? t("复制中…", "Copying…")
                : shareState === "shared"
                ? t("✓ 文案已复制", "✓ Text Copied")
                : shareState === "error"
                ? t("复制失败", "Failed")
                : t("分享到朋友圈", "Share to Moments")}
            </button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          aria-live="polite"
          style={{
            position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
            zIndex: 10000, padding: "11px 20px",
            background: toast.ok ? "#0f172a" : "#7f1d1d",
            color: "#fff",
            borderRadius: 20, fontSize: 13, fontWeight: 600,
            boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
            whiteSpace: "nowrap", maxWidth: "calc(100vw - 32px)",
            textAlign: "center", pointerEvents: "none",
          }}
        >
          {toast.msg}
        </div>
      )}
    </>
  );
}

