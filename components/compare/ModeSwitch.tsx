"use client";
// components/compare/ModeSwitch.tsx
// Top-level mode selector: Points (default) | Categories (Beta) | Custom (disabled)

import { useLang } from "@/lib/lang";
import { FONT, COLORS } from "./constants";
import type { CompareMode } from "@/lib/compare/types";

interface ModeSwitchProps {
  mode: CompareMode;
  onChange: (mode: CompareMode) => void;
}

export default function ModeSwitch({ mode, onChange }: ModeSwitchProps) {
  const { t } = useLang();

  return (
    <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
      {/* Points — primary active mode */}
      <button
        onClick={() => onChange("points")}
        style={{
          padding: "8px 20px",
          borderRadius: 999,
          background: mode === "points" ? COLORS.navy : COLORS.card,
          color: mode === "points" ? "#fff" : COLORS.textSecondary,
          border: mode === "points" ? `2px solid ${COLORS.navy}` : `2px solid ${COLORS.border}`,
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          transition: "all 0.15s",
        }}
      >
        {t("积分制", "Points")}
      </button>

      {/* Categories — beta */}
      <button
        onClick={() => onChange("categories")}
        style={{
          padding: "8px 20px",
          borderRadius: 999,
          background: mode === "categories" ? "#7c3aed" : COLORS.card,
          color: mode === "categories" ? "#fff" : COLORS.textSecondary,
          border: mode === "categories" ? "2px solid #7c3aed" : `2px solid ${COLORS.border}`,
          cursor: "pointer",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
          transition: "all 0.15s",
        }}
      >
        {t("分类制", "Categories")}
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          background: mode === "categories" ? "rgba(255,255,255,0.25)" : COLORS.purpleLight,
          color: mode === "categories" ? "#fff" : "#7c3aed",
          padding: "1px 6px",
          borderRadius: 4,
          letterSpacing: "0.5px",
        }}>β</span>
      </button>

      {/* Custom — disabled */}
      <button
        disabled
        title={t("即将推出", "Coming Soon")}
        style={{
          padding: "8px 20px",
          borderRadius: 999,
          background: COLORS.bg,
          color: COLORS.textMuted,
          border: `2px solid ${COLORS.border}`,
          cursor: "not-allowed",
          fontFamily: FONT,
          fontSize: 14,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          gap: 6,
          opacity: 0.6,
        }}
      >
        {t("自定义", "Custom")}
        <span style={{ fontSize: 11 }}>🔒</span>
      </button>
    </div>
  );
}
