"use client";
// components/compare/PlayerSelectCard.tsx
// Decision-oriented player card shown at the top of the compare page.

import PlayerAvatar from "@/components/PlayerAvatar";
import { useLang } from "@/lib/lang";
import { FONT, COLORS } from "./constants";
import type { CompareStats } from "@/lib/compare-types";

interface PlayerSelectCardProps {
  player: CompareStats | null;
  color: string;
  onRemove: () => void;
  onAddClick: () => void;
  isMobile: boolean;
  isLoading: boolean;
}

function TrendArrow({ trend }: { trend: "up" | "flat" | "down" }) {
  if (trend === "up") return <span style={{ color: COLORS.green, fontWeight: 700, fontSize: 14 }}>↑</span>;
  if (trend === "down") return <span style={{ color: COLORS.red, fontWeight: 700, fontSize: 14 }}>↓</span>;
  return <span style={{ color: COLORS.textMuted, fontSize: 14 }}>→</span>;
}

function DataSourceBadge({ source }: { source: CompareStats["dataSource"] }) {
  if (source === "live") return null;
  const label = source === "static" ? "Last Season" : "Cached";
  const bg = source === "static" ? COLORS.amberLight : COLORS.navyLight;
  const fg = source === "static" ? "#92400e" : COLORS.navy;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, background: bg, color: fg, padding: "1px 6px", borderRadius: 4 }}>
      {label}
    </span>
  );
}

export default function PlayerSelectCard({
  player, color, onRemove, onAddClick, isMobile, isLoading,
}: PlayerSelectCardProps) {
  const { t } = useLang();

  if (!player) {
    return (
      <div
        onClick={onAddClick}
        style={{
          background: COLORS.card,
          border: `2px dashed ${COLORS.borderStrong}`,
          borderRadius: 16,
          padding: 20,
          width: "100%",
          minHeight: isMobile ? 140 : 180,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: COLORS.textMuted,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = color)}
        onMouseLeave={e => (e.currentTarget.style.borderColor = COLORS.borderStrong)}
      >
        <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 10 }}>+</div>
        <span style={{ fontSize: 14, fontWeight: 500, fontFamily: FONT }}>{t("添加球员", "Add Player")}</span>
      </div>
    );
  }

  return (
    <div style={{
      background: COLORS.card,
      border: `2.5px solid ${color}`,
      borderRadius: 16,
      padding: isMobile ? "14px 14px" : "20px",
      width: "100%",
      position: "relative",
      boxShadow: "0 2px 8px rgba(0,0,0,0.07)",
      opacity: isLoading ? 0.75 : 1,
      transition: "opacity 0.2s",
    }}>
      {/* Remove button */}
      <button onClick={onRemove} style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", color: COLORS.textMuted, cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 4 }}>✕</button>

      {/* Header: avatar + fpts score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <PlayerAvatar name={player.playerName} size={44} />
        <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>
            {player.fptsPerGame.toFixed(1)}
          </div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, marginTop: 2, display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
            <TrendArrow trend={player.recentTrend} />
            <span>FPTS/G</span>
          </div>
        </div>
      </div>

      {/* Name / team */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: COLORS.textPrimary, margin: "0 0 2px 0", fontFamily: FONT, paddingRight: 16, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{player.playerName}</h3>
      <p style={{ fontSize: 12, color: COLORS.textSecondary, margin: "0 0 8px 0", fontFamily: FONT }}>
        {player.team} · {player.position}
      </p>

      {/* Injury + data source badges */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10, minHeight: 20 }}>
        {player.injuryStatus && (
          <span style={{ fontSize: 10, fontWeight: 600, background: COLORS.redLight, color: COLORS.red, padding: "2px 7px", borderRadius: 4 }}>
            {player.injuryStatus}
          </span>
        )}
        <DataSourceBadge source={player.dataSource} />
      </div>

      {/* Quick stat row */}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: `1px solid ${COLORS.border}`, paddingTop: 8, gap: 4 }}>
        {[
          { val: player.ppg, lbl: "PTS" },
          { val: player.rpg, lbl: "REB" },
          { val: player.apg, lbl: "AST" },
        ].map(({ val, lbl }) => (
          <div key={lbl} style={{ textAlign: "center", flex: 1 }}>
            <div style={{ fontSize: isMobile ? 13 : 15, fontWeight: 700, color: COLORS.textPrimary, fontFamily: FONT }}>{val}</div>
            <div style={{ fontSize: 10, color: COLORS.textMuted }}>{lbl}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
