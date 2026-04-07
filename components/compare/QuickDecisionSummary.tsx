"use client";
// components/compare/QuickDecisionSummary.tsx
// Hero recommendation card — the most prominent output on the page.

import PlayerAvatar from "@/components/PlayerAvatar";
import { useLang } from "@/lib/lang";
import { COLORS } from "./constants";
import type { CompareResult } from "@/lib/compare-types";

interface QuickDecisionSummaryProps {
  result: CompareResult;
  isMobile: boolean;
}

const CONFIDENCE_LABELS = {
  high:   { en: "High Confidence",   zh: "高度推荐",  color: COLORS.green,  bg: COLORS.greenLight  },
  medium: { en: "Moderate Advantage", zh: "较优选择",  color: COLORS.amber,  bg: COLORS.amberLight  },
  low:    { en: "Slight Edge",        zh: "略微领先",  color: COLORS.orange, bg: COLORS.orangeLight },
};

export default function QuickDecisionSummary({ result, isMobile }: QuickDecisionSummaryProps) {
  const { t } = useLang();
  const { quickDecision, players } = result;
  const recommended = players.find(p => p.playerId === quickDecision.recommendedPlayerId);
  const other = players.find(p => p.playerId !== quickDecision.recommendedPlayerId);

  const conf = CONFIDENCE_LABELS[quickDecision.confidence];

  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.navy} 0%, #1e40af 100%)`,
      borderRadius: 16,
      padding: isMobile ? "16px 16px" : "24px 28px",
      marginBottom: 20,
      color: "#fff",
      boxShadow: "0 4px 16px rgba(30,58,138,0.25)",
    }}>
      {/* Top row: avatar block + edge pill (both on same row on mobile too) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: recommended ? 12 : 0 }}>
        {recommended && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
            <div style={{ width: isMobile ? 44 : 56, height: isMobile ? 44 : 56, borderRadius: "50%", border: "2.5px solid rgba(255,255,255,0.5)", overflow: "hidden", flexShrink: 0 }}>
              <PlayerAvatar name={recommended.playerName} size={isMobile ? 44 : 56} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.5px", marginBottom: 2 }}>
                {t("推荐选择", "RECOMMENDED")}
              </div>
              <div style={{ fontSize: isMobile ? 17 : 22, fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{recommended.playerName}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                {recommended.team} · {recommended.fptsPerGame.toFixed(1)} FPTS/G
              </div>
            </div>
          </div>
        )}

        {/* Score diff pill — always inline */}
        {recommended && other && (
          <div style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: 10,
            padding: isMobile ? "8px 12px" : "12px 18px",
            textAlign: "center",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", marginBottom: 2 }}>{t("差值", "Edge")}</div>
            <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
              +{Math.abs(recommended.fptsPerGame - other.fptsPerGame).toFixed(1)}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>FPTS/G</div>
          </div>
        )}
      </div>

      {/* Reason block */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <span style={{
            fontSize: 11, fontWeight: 700,
            background: conf.bg, color: conf.color,
            padding: "2px 9px", borderRadius: 999,
          }}>
            {t(conf.zh, conf.en)}
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
            · {quickDecision.scenario}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: isMobile ? 12 : 14, lineHeight: 1.6, color: "rgba(255,255,255,0.88)" }}>
          {t(quickDecision.reasonZh, quickDecision.reason)}
        </p>
      </div>
    </div>
  );
}
