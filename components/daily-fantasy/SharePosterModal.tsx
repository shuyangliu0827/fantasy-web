"use client";
// components/daily-fantasy/SharePosterModal.tsx
//
// Modal that previews a lineup or result poster and lets the user:
//   1. Download as PNG (html-to-image toPng, pixelRatio:3 → 1080px)
//   2. Copy image to clipboard (Clipboard API)
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

export default function SharePosterModal(props: ModalProps) {
  const { open, onClose, posterType, posterProps, lang } = props;
  const posterRef = useRef<HTMLDivElement>(null);
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [copyState, setCopyState] = useState<"idle" | "copying" | "copied" | "error">("idle");

  const t = (zh: string, en: string) => lang === "zh" ? zh : en;

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

  const handleCopy = useCallback(async () => {
    setCopyState("copying");
    try {
      const dataUrl = await getDataUrl();
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setTimeout(() => setCopyState("idle"), 2000);
    }
  }, [getDataUrl]);

  if (!open) return null;

  const btnBase: React.CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: 42, borderRadius: 8, fontWeight: 700, fontSize: 14,
    cursor: "pointer", border: "none", transition: "opacity 0.15s",
  };

  return (
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
              {t("分享阵容", "Share Lineup")}
            </div>
            <div style={{ fontSize: 11, color: "rgba(148,163,184,0.65)", marginTop: 2 }}>
              {t("保存或复制海报图片", "Save or copy poster image")}
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

        {/* Action buttons */}
        <div style={{ padding: "0 20px 20px", display: "flex", gap: 10 }}>
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

          <button
            onClick={handleCopy}
            disabled={copyState === "copying"}
            style={{
              ...btnBase,
              flex: 1,
              background: copyState === "error"
                ? "rgba(239,68,68,0.15)"
                : copyState === "copied"
                ? "rgba(34,197,94,0.15)"
                : "rgba(255,255,255,0.07)",
              border: `1px solid ${copyState === "copied" ? "rgba(74,222,128,0.4)" : copyState === "error" ? "rgba(248,113,113,0.4)" : "rgba(255,255,255,0.12)"}`,
              color: copyState === "copied"
                ? "#4ade80"
                : copyState === "error"
                ? "#f87171"
                : "#e2e8f0",
              opacity: copyState === "copying" ? 0.65 : 1,
            }}
          >
            {copyState === "copying"
              ? t("复制中…", "Copying…")
              : copyState === "copied"
              ? t("✓ 已复制", "✓ Copied")
              : copyState === "error"
              ? t("不支持", "Unsupported")
              : t("复制图片", "Copy Image")}
          </button>
        </div>
      </div>
    </div>
  );
}
