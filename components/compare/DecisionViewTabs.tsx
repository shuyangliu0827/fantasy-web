"use client";
// components/compare/DecisionViewTabs.tsx
// Overview / Draft / Trade / Short-Term / Stability decision context tabs

import { useLang } from "@/lib/lang";
import { FONT, COLORS } from "./constants";
import type { DecisionView, ScenarioRecommendation } from "@/lib/compare/types";

interface DecisionViewTabsProps {
  view: DecisionView;
  onChange: (v: DecisionView) => void;
  recommendations: Partial<Record<DecisionView, ScenarioRecommendation>>;
}

const TABS: Array<{ key: DecisionView; zh: string; en: string; icon: string }> = [
  { key: "overview",   zh: "总览",   en: "Overview",    icon: "📊" },
  { key: "draft",      zh: "选秀",   en: "Draft",       icon: "🏆" },
  { key: "trade",      zh: "交易",   en: "Trade",       icon: "🔄" },
  { key: "shortterm",  zh: "短期",   en: "Short-Term",  icon: "⚡" },
  { key: "stability",  zh: "稳定性", en: "Stability",   icon: "🛡" },
];

export default function DecisionViewTabs({ view, onChange, recommendations }: DecisionViewTabsProps) {
  const { t } = useLang();

  return (
    <div style={{
      display: "flex",
      gap: 6,
      marginBottom: 20,
      overflowX: "auto",
      paddingBottom: 4,
      WebkitOverflowScrolling: "touch",
    }}>
      {TABS.map(tab => {
        const active = view === tab.key;
        const rec = recommendations[tab.key];
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              padding: "10px 16px",
              borderRadius: 12,
              background: active ? COLORS.navy : COLORS.card,
              color: active ? "#fff" : COLORS.textSecondary,
              border: active ? `2px solid ${COLORS.navy}` : `2px solid ${COLORS.border}`,
              cursor: "pointer",
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              flexShrink: 0,
              textAlign: "center",
              transition: "all 0.15s",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
              minWidth: 80,
            }}
          >
            <span style={{ fontSize: 16 }}>{tab.icon}</span>
            <span>{t(tab.zh, tab.en)}</span>
            {rec && (
              <span style={{
                fontSize: 10,
                fontWeight: 500,
                color: active ? "rgba(255,255,255,0.75)" : COLORS.textMuted,
                maxWidth: 80,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
                {rec.winnerName.split(" ").pop()}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
