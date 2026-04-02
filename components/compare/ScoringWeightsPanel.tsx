"use client";
// components/compare/ScoringWeightsPanel.tsx
// Compact inline scoring weights editor — mirrors the in-game league settings UI.
// Shows all 11 ESPN H2H Points terms so the displayed formula matches the actual calculation.

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { FONT, COLORS } from "./constants";
import { ESPN_DEFAULT_WEIGHTS, type PointsWeights } from "@/lib/compare-engine";

interface ScoringWeightsPanelProps {
  weights: PointsWeights;
  onChange: (w: PointsWeights) => void;
  isMobile: boolean;
  /** Optional contextual note shown below the formula (e.g. lastSeason approximation warning). */
  note?: string;
}

// All 11 ESPN H2H Points terms — matches calcFantasyPoints / ESPN_DEFAULT_WEIGHTS exactly.
const STAT_ROWS: { key: keyof PointsWeights; label: string; labelZh: string; min: number; max: number; step: number }[] = [
  { key: "pts",  label: "PTS",  labelZh: "得分",     min: 0,  max: 5, step: 0.5 },
  { key: "fgm",  label: "FGM",  labelZh: "投篮命中", min: 0,  max: 5, step: 0.5 },
  { key: "fga",  label: "FGA",  labelZh: "投篮出手", min: -3, max: 0, step: 0.5 },
  { key: "fg3m", label: "3PM",  labelZh: "三分命中", min: 0,  max: 5, step: 0.5 },
  { key: "ftm",  label: "FTM",  labelZh: "罚球命中", min: 0,  max: 5, step: 0.5 },
  { key: "fta",  label: "FTA",  labelZh: "罚球出手", min: -3, max: 0, step: 0.5 },
  { key: "reb",  label: "REB",  labelZh: "篮板",     min: 0,  max: 5, step: 0.5 },
  { key: "ast",  label: "AST",  labelZh: "助攻",     min: 0,  max: 5, step: 0.5 },
  { key: "stl",  label: "STL",  labelZh: "抢断",     min: 0,  max: 6, step: 0.5 },
  { key: "blk",  label: "BLK",  labelZh: "盖帽",     min: 0,  max: 6, step: 0.5 },
  { key: "tov",  label: "TOV",  labelZh: "失误",     min: -4, max: 0, step: 0.5 },
];

function isEspnDefault(w: PointsWeights): boolean {
  return (Object.keys(ESPN_DEFAULT_WEIGHTS) as (keyof PointsWeights)[]).every(
    k => w[k] === ESPN_DEFAULT_WEIGHTS[k]
  );
}

// Build full 11-term formula string matching calcFantasyPoints term order.
function formulaStr(w: PointsWeights): string {
  const parts: string[] = [];
  if (w.pts  !== 0) parts.push(`${w.pts}×PTS`);
  if (w.fgm  !== 0) parts.push(`${w.fgm}×FGM`);
  if (w.fga  !== 0) parts.push(`${w.fga}×FGA`);
  if (w.fg3m !== 0) parts.push(`${w.fg3m}×3PM`);
  if (w.ftm  !== 0) parts.push(`${w.ftm}×FTM`);
  if (w.fta  !== 0) parts.push(`${w.fta}×FTA`);
  if (w.reb  !== 0) parts.push(`${w.reb}×REB`);
  if (w.ast  !== 0) parts.push(`${w.ast}×AST`);
  if (w.stl  !== 0) parts.push(`${w.stl}×STL`);
  if (w.blk  !== 0) parts.push(`${w.blk}×BLK`);
  if (w.tov  !== 0) parts.push(`${w.tov}×TOV`);
  return parts.join("  +  ").replace(/\+\s+−/g, "−");
}

export default function ScoringWeightsPanel({ weights, onChange, isMobile, note }: ScoringWeightsPanelProps) {
  const { t } = useLang();
  const [expanded, setExpanded] = useState(false);
  const isDefault = isEspnDefault(weights);

  function setWeight(key: keyof PointsWeights, val: number) {
    onChange({ ...weights, [key]: val });
  }

  return (
    <div style={{
      background: COLORS.card,
      border: `1px solid ${isDefault ? COLORS.border : COLORS.navy}`,
      borderRadius: 12,
      marginBottom: 16,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "11px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: FONT,
          gap: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 14 }}>⚙️</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.textPrimary, flexShrink: 0 }}>
            {t("计分权重 (ESPN H2H 积分制)", "Scoring Weights (ESPN H2H Points)")}
          </span>
          {!isDefault && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "#dbeafe", color: COLORS.navy,
              padding: "1px 6px", borderRadius: 999, flexShrink: 0,
            }}>
              {t("自定义", "Custom")}
            </span>
          )}
          {!expanded && (
            <span style={{
              fontSize: 11, color: COLORS.textMuted,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              minWidth: 0,
            }}>
              {formulaStr(weights)}
            </span>
          )}
        </div>
        <span style={{
          color: COLORS.textMuted, fontSize: 13, flexShrink: 0,
          transform: expanded ? "rotate(180deg)" : "none",
          transition: "transform 0.2s",
        }}>▾</span>
      </button>

      {expanded && (
        <div style={{ padding: "4px 16px 16px" }}>
          {/* Stat grid — 6 columns on desktop to accommodate all 11 terms cleanly */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(6, 1fr)",
            gap: isMobile ? "12px 16px" : 12,
            marginBottom: 14,
          }}>
            {STAT_ROWS.map(({ key, label, labelZh, min, max, step }) => {
              const val = weights[key];
              const changed = val !== ESPN_DEFAULT_WEIGHTS[key];
              return (
                <div key={key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: changed ? COLORS.navy : COLORS.textSecondary }}>
                      {t(labelZh, label)}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 800,
                      color: val === 0 ? COLORS.textMuted : val < 0 ? COLORS.red : changed ? COLORS.navy : COLORS.textPrimary,
                      minWidth: 28, textAlign: "right",
                    }}>
                      {val > 0 ? `+${val}` : val}
                    </span>
                  </div>
                  {/* +/− stepper */}
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button
                      onClick={() => setWeight(key, Math.max(min, Math.round((val - step) * 10) / 10))}
                      disabled={val <= min}
                      style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: `1px solid ${COLORS.border}`,
                        background: val <= min ? COLORS.bg : COLORS.card,
                        color: val <= min ? COLORS.textMuted : COLORS.textPrimary,
                        cursor: val <= min ? "not-allowed" : "pointer",
                        fontSize: 14, fontWeight: 700, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >−</button>
                    <div style={{
                      flex: 1,
                      height: 4,
                      background: COLORS.bg,
                      borderRadius: 2,
                      overflow: "hidden",
                      position: "relative",
                    }}>
                      <div style={{
                        position: "absolute",
                        left: 0, top: 0, bottom: 0,
                        width: `${((val - min) / (max - min)) * 100}%`,
                        background: val < 0 ? COLORS.red : changed ? COLORS.navy : COLORS.borderStrong,
                        borderRadius: 2,
                        transition: "width 0.15s",
                      }} />
                    </div>
                    <button
                      onClick={() => setWeight(key, Math.min(max, Math.round((val + step) * 10) / 10))}
                      disabled={val >= max}
                      style={{
                        width: 26, height: 26, borderRadius: 6,
                        border: `1px solid ${COLORS.border}`,
                        background: val >= max ? COLORS.bg : COLORS.card,
                        color: val >= max ? COLORS.textMuted : COLORS.textPrimary,
                        cursor: val >= max ? "not-allowed" : "pointer",
                        fontSize: 14, fontWeight: 700, lineHeight: 1,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Formula preview — all 11 terms */}
          <div style={{
            background: COLORS.bg,
            borderRadius: 8,
            padding: "8px 12px",
            marginBottom: 10,
            fontSize: 11,
            color: COLORS.textSecondary,
            fontFamily: "monospace",
            lineHeight: 1.5,
          }}>
            <span style={{ color: COLORS.textMuted, fontFamily: FONT }}>{t("当前公式", "Formula")}: </span>
            {t("FPTS = ", "FPTS = ")}
            {formulaStr(weights)}
          </div>

          {/* Contextual note (e.g. lastSeason approximation) */}
          {note && (
            <div style={{
              fontSize: 11, color: "#92400e",
              background: "#fef3c7",
              borderRadius: 6,
              padding: "6px 10px",
              marginBottom: 10,
              lineHeight: 1.5,
            }}>
              {note}
            </div>
          )}

          {/* Reset button */}
          {!isDefault && (
            <button
              onClick={() => onChange({ ...ESPN_DEFAULT_WEIGHTS })}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: COLORS.bg,
                color: COLORS.textSecondary,
                fontSize: 12, fontWeight: 600,
                cursor: "pointer",
                fontFamily: FONT,
              }}
            >
              {t("恢复 ESPN 默认值", "Reset to ESPN Default")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
