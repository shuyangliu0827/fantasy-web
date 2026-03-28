"use client";
// components/compare/RiskNotes.tsx
// Risk and context notes — collapsible, grouped by player.

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { FONT, COLORS, PLAYER_COLORS } from "./constants";
import type { RiskNote } from "@/lib/compare-types";

interface RiskNotesProps {
  notes: RiskNote[];
  playerAId: string;
}

const TYPE_META: Record<RiskNote["type"], { icon: string; label: string; labelZh: string }> = {
  hot_streak:           { icon: "🔥", label: "Hot Streak",         labelZh: "近期状态上升" },
  cold_streak:          { icon: "❄️", label: "Cold Streak",        labelZh: "近期状态下滑" },
  consistency_warning:  { icon: "⚠️", label: "High Variance",      labelZh: "高波动球员" },
  availability_risk:    { icon: "🏥", label: "Availability Risk",  labelZh: "出场风险" },
  small_sample:         { icon: "📊", label: "Small Sample",       labelZh: "样本量不足" },
};

export default function RiskNotes({ notes, playerAId }: RiskNotesProps) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(true);

  if (notes.length === 0) return null;

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      marginBottom: 12,
      overflow: "hidden",
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>
            {t("风险与背景说明", "Risk & Context Notes")}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: COLORS.amberLight, color: "#92400e",
            padding: "1px 8px", borderRadius: 999,
          }}>
            {notes.length}
          </span>
        </div>
        <span style={{ color: COLORS.textMuted, fontSize: 14, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
          {notes.map((note, i) => {
            const meta = TYPE_META[note.type];
            const isPlayerA = note.playerId === playerAId;
            const playerColor = isPlayerA ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
            const isWarning = note.severity === "warning";

            return (
              <div key={i} style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                background: isWarning ? "#fff7ed" : COLORS.bg,
                border: `1px solid ${isWarning ? "#fed7aa" : COLORS.border}`,
              }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{meta.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: playerColor }}>
                      {note.playerName.split(" ").pop()}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      background: isWarning ? "#fef3c7" : COLORS.bg,
                      color: isWarning ? "#92400e" : COLORS.textMuted,
                      padding: "1px 6px", borderRadius: 4,
                    }}>
                      {t(meta.labelZh, meta.label)}
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.5, fontFamily: FONT }}>
                    {t(note.messageZh, note.message)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
