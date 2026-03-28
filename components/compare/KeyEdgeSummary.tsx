"use client";
// components/compare/KeyEdgeSummary.tsx
// Compact key-edge comparison table — faster to read than the radar chart.

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { FONT, COLORS, PLAYER_COLORS } from "./constants";
import type { KeyEdge } from "@/lib/compare-types";

interface KeyEdgeSummaryProps {
  edges: KeyEdge[];
  playerAId: string;
  isMobile: boolean;
}

const SIG_COLORS = {
  major:    { bg: "#fee2e2", text: "#991b1b" },
  moderate: { bg: "#fef3c7", text: "#92400e" },
  minor:    { bg: "#f3f4f6", text: "#6b7280" },
};

export default function KeyEdgeSummary({ edges, playerAId, isMobile }: KeyEdgeSummaryProps) {
  const { t } = useLang();
  const [showAll, setShowAll] = useState(false);

  if (edges.length === 0) return null;

  const visibleEdges = isMobile && !showAll ? edges.slice(0, 3) : edges;

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      padding: "18px 20px",
      marginBottom: 20,
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, margin: "0 0 14px 0", fontFamily: FONT }}>
        {t("关键优势", "Key Edges")}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {visibleEdges.map((edge, i) => {
          const isAWinner = edge.winnerId === playerAId;
          const winnerColor = isAWinner ? PLAYER_COLORS[0] : PLAYER_COLORS[1];
          const sig = SIG_COLORS[edge.significance];

          return (
            <div key={i} style={{
              display: "flex",
              alignItems: "center",
              gap: isMobile ? 8 : 12,
              padding: "8px 10px",
              borderRadius: 8,
              background: COLORS.bg,
            }}>
              {/* Category */}
              <div style={{ width: isMobile ? 72 : 90, flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.textSecondary }}>
                  {t(edge.categoryZh, edge.category)}
                </div>
              </div>

              {/* Winner bar */}
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{
                  flex: 1, height: 6, background: COLORS.border, borderRadius: 3, overflow: "hidden",
                  position: "relative",
                }}>
                  <div style={{
                    position: "absolute",
                    [isAWinner ? "left" : "right"]: 0,
                    top: 0, bottom: 0,
                    width: `${Math.min(100, edge.pctDiff * 100 + 50)}%`,
                    background: winnerColor,
                    borderRadius: 3,
                    minWidth: "20%",
                  }} />
                </div>
              </div>

              {/* Winner name + value */}
              <div style={{ flexShrink: 0, textAlign: "right" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: winnerColor }}>
                  {edge.winnerName.split(" ").pop()}
                </span>
                <span style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  background: sig.bg,
                  color: sig.text,
                  padding: "2px 7px",
                  borderRadius: 999,
                }}>
                  {edge.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {isMobile && edges.length > 3 && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            marginTop: 10, width: "100%", background: "none", border: `1px solid ${COLORS.border}`,
            borderRadius: 8, padding: "7px 0", cursor: "pointer", fontSize: 12,
            color: COLORS.textSecondary, fontFamily: FONT, fontWeight: 600,
          }}
        >
          {showAll ? t("收起", "Show less") : t(`显示全部 ${edges.length} 项`, `Show all ${edges.length}`)}
        </button>
      )}
    </div>
  );
}
