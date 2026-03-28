"use client";
// components/compare/QuickDecisionSummary.tsx
// Hero recommendation card — the most prominent output on the page.

import PlayerAvatar from "@/components/PlayerAvatar";
import { useLang } from "@/lib/lang";
import { FONT, COLORS, PLAYER_COLORS } from "./constants";
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
  const recIndex = players.findIndex(p => p.playerId === quickDecision.recommendedPlayerId);
  const recColor = PLAYER_COLORS[recIndex] ?? PLAYER_COLORS[0];

  const conf = CONFIDENCE_LABELS[quickDecision.confidence];

  return (
    <div style={{
      background: `linear-gradient(135deg, ${COLORS.navy} 0%, #1e40af 100%)`,
      borderRadius: 16,
      padding: isMobile ? "20px 18px" : "24px 28px",
      marginBottom: 20,
      color: "#fff",
      boxShadow: "0 4px 16px rgba(30,58,138,0.25)",
    }}>
      <div style={{ display: "flex", alignItems: isMobile ? "flex-start" : "center", gap: 20, flexDirection: isMobile ? "column" : "row" }}>
        {/* Recommended player avatar + name */}
        {recommended && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.5)", overflow: "hidden" }}>
              <PlayerAvatar name={recommended.playerName} size={56} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.65)", letterSpacing: "0.5px", marginBottom: 2 }}>
                {t("推荐选择", "RECOMMENDED")}
              </div>
              <div style={{ fontSize: isMobile ? 20 : 22, fontWeight: 800 }}>{recommended.playerName}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 1 }}>
                {recommended.team} · {recommended.fptsPerGame.toFixed(1)} {t("奇幻分/场", "FPTS/G")}
              </div>
            </div>
          </div>
        )}

        {/* Divider */}
        {!isMobile && <div style={{ width: 1, alignSelf: "stretch", background: "rgba(255,255,255,0.15)" }} />}

        {/* Reason */}
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: conf.bg, color: conf.color,
              padding: "3px 10px", borderRadius: 999,
              letterSpacing: "0.5px",
            }}>
              {t(conf.zh, conf.en)}
            </span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
              · {quickDecision.scenario}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: isMobile ? 13 : 14, lineHeight: 1.6, color: "rgba(255,255,255,0.9)" }}>
            {t(quickDecision.reasonZh, quickDecision.reason)}
          </p>
        </div>

        {/* Score diff pill */}
        {recommended && other && (
          <div style={{
            background: "rgba(255,255,255,0.12)",
            borderRadius: 12,
            padding: "12px 18px",
            textAlign: "center",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>{t("差值", "Edge")}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
              +{Math.abs(recommended.fptsPerGame - other.fptsPerGame).toFixed(1)}
            </div>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.6)" }}>FPTS/G</div>
          </div>
        )}
      </div>
    </div>
  );
}
