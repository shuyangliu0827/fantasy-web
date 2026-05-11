"use client";
// components/compare/TimeframeSelector.tsx
// Season / L7 / L15 / Last Season pill selector

import { useLang } from "@/lib/lang";
import { FONT, COLORS } from "./constants";
import type { Timeframe } from "@/lib/compare/types";

interface TimeframeSelectorProps {
  timeframe: Timeframe;
  onChange: (t: Timeframe) => void;
  isLoading: boolean;
}

const OPTIONS: Array<{ key: Timeframe; zh: string; en: string }> = [
  { key: "season",     zh: "本赛季",  en: "Season"      },
  { key: "last7",      zh: "近7天",   en: "Last 7"      },
  { key: "last15",     zh: "近15天",  en: "Last 15"     },
  { key: "lastSeason", zh: "上赛季",  en: "Last Season" },
];

export default function TimeframeSelector({ timeframe, onChange, isLoading }: TimeframeSelectorProps) {
  const { t } = useLang();

  return (
    <div style={{
      display: "flex",
      gap: 8,
      marginBottom: 24,
      overflowX: "auto",
      paddingBottom: 4,
      WebkitOverflowScrolling: "touch",
    }}>
      {OPTIONS.map(opt => {
        const active = timeframe === opt.key;
        return (
          <button
            key={opt.key}
            disabled={isLoading}
            onClick={() => onChange(opt.key)}
            style={{
              padding: "7px 18px",
              borderRadius: 999,
              background: active ? COLORS.navy : COLORS.card,
              color: active ? "#fff" : COLORS.textSecondary,
              border: active ? `2px solid ${COLORS.navy}` : `2px solid ${COLORS.border}`,
              cursor: isLoading ? "not-allowed" : "pointer",
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: "nowrap",
              flexShrink: 0,
              opacity: isLoading ? 0.7 : 1,
              transition: "all 0.15s",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t(opt.zh, opt.en)}
            {active && isLoading && (
              <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin 0.6s linear infinite" }} />
            )}
          </button>
        );
      })}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
