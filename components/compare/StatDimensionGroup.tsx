"use client";
// components/compare/StatDimensionGroup.tsx
// Grouped stat comparison rows with bar charts and winner indicator.

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { FONT, COLORS, PLAYER_COLORS } from "./constants";
import type { CompareStats } from "@/lib/compare/types";

type StatFormat = "decimal1" | "decimal2" | "pct" | "integer" | "score";

export interface StatRow {
  key: string;
  label: string;
  labelZh: string;
  values: [number, number];        // [playerA, playerB]
  format: StatFormat;
  higherIsBetter: boolean;
  max?: number;                    // for bar normalization (defaults to max of both values * 1.3)
  isMocked?: boolean;              // shows "(est.)" if true
}

interface StatDimensionGroupProps {
  title: string;
  titleZh: string;
  icon: string;
  stats: StatRow[];
  players: [CompareStats, CompareStats];
  isMobile: boolean;
  defaultExpanded?: boolean;
}

function formatVal(v: number, format: StatFormat): string {
  if (format === "decimal1") return v.toFixed(1);
  if (format === "decimal2") return v.toFixed(2);
  if (format === "pct")      return v.toFixed(1) + "%";
  if (format === "score")    return v.toFixed(0);
  return v.toFixed(0);
}

function WinnerDot({ isWinner, color }: { isWinner: boolean; color: string }) {
  if (!isWinner) return null;
  return (
    <span style={{
      display: "inline-block", width: 6, height: 6, borderRadius: "50%",
      background: color, flexShrink: 0,
    }} />
  );
}

export default function StatDimensionGroup({
  title, titleZh, icon, stats, players, isMobile, defaultExpanded = true,
}: StatDimensionGroupProps) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${COLORS.border}`,
      borderRadius: 16,
      marginBottom: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      overflow: "hidden",
    }}>
      {/* Section header */}
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
          <span style={{ fontSize: 16 }}>{icon}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary }}>
            {t(titleZh, title)}
          </span>
        </div>
        <span style={{ color: COLORS.textMuted, fontSize: 14, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "4px 20px 18px" }}>
          {/* Player name header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "76px 1fr 32px 1fr 44px" : "130px 1fr 70px 1fr 70px",
            gap: isMobile ? 4 : 6,
            alignItems: "center",
            marginBottom: 8,
          }}>
            <div />
            <div style={{ fontSize: 11, fontWeight: 700, color: PLAYER_COLORS[0], textAlign: "right" }}>
              {players[0].playerName.split(" ").pop()}
            </div>
            <div />
            <div style={{ fontSize: 11, fontWeight: 700, color: PLAYER_COLORS[1] }}>
              {players[1].playerName.split(" ").pop()}
            </div>
            <div />
          </div>

          {stats.map((stat) => {
            const [vA, vB] = stat.values;
            const max = stat.max ?? (Math.max(vA, vB) * 1.4 || 1);
            const pctA = Math.min((vA / max) * 100, 100);
            const pctB = Math.min((vB / max) * 100, 100);

            const aWins = stat.higherIsBetter ? vA > vB : vA < vB;
            const bWins = stat.higherIsBetter ? vB > vA : vB < vA;

            return (
              <div key={stat.key} style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "76px 1fr 32px 1fr 44px" : "130px 1fr 70px 1fr 70px",
                gap: isMobile ? 4 : 6,
                alignItems: "center",
                marginBottom: isMobile ? 8 : 10,
              }}>
                {/* Label */}
                <div style={{ fontSize: isMobile ? 11 : 12, color: COLORS.textSecondary, fontFamily: FONT, display: "flex", alignItems: "center", gap: 2, overflow: "hidden" }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t(stat.labelZh, stat.label)}
                  </span>
                  {stat.isMocked && <span style={{ fontSize: 10, color: COLORS.textMuted, flexShrink: 0 }}>(est.)</span>}
                </div>

                {/* Player A: value + bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  {aWins && <WinnerDot isWinner color={PLAYER_COLORS[0]} />}
                  <div style={{ flex: 1, height: 6, background: COLORS.bg, borderRadius: 3, overflow: "hidden", display: "flex", justifyContent: "flex-end", minWidth: 0 }}>
                    <div style={{ width: `${pctA}%`, height: "100%", background: aWins ? PLAYER_COLORS[0] : COLORS.borderStrong, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                  <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: aWins ? 700 : 500, color: aWins ? PLAYER_COLORS[0] : COLORS.textSecondary, minWidth: isMobile ? 28 : 36, textAlign: "right", flexShrink: 0 }}>
                    {formatVal(vA, stat.format)}
                  </span>
                </div>

                {/* Center: direction indicator */}
                <div style={{ textAlign: "center", fontSize: 10, color: COLORS.textMuted }}>
                  {stat.higherIsBetter ? "↑" : "↓"}
                </div>

                {/* Player B: value + bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                  <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: bWins ? 700 : 500, color: bWins ? PLAYER_COLORS[1] : COLORS.textSecondary, minWidth: isMobile ? 28 : 36, flexShrink: 0 }}>
                    {formatVal(vB, stat.format)}
                  </span>
                  <div style={{ flex: 1, height: 6, background: COLORS.bg, borderRadius: 3, overflow: "hidden", minWidth: 0 }}>
                    <div style={{ width: `${pctB}%`, height: "100%", background: bWins ? PLAYER_COLORS[1] : COLORS.borderStrong, borderRadius: 3, transition: "width 0.4s" }} />
                  </div>
                  {bWins && <WinnerDot isWinner color={PLAYER_COLORS[1]} />}
                </div>

                {/* Diff */}
                <div style={{ fontSize: isMobile ? 10 : 11, color: COLORS.textMuted, textAlign: "right", flexShrink: 0 }}>
                  {Math.abs(vA - vB) > 0 ? (aWins ? "+" : "-") + Math.abs(vA - vB).toFixed(1) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
