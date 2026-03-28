"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { getCurrentSeasonLabel } from "@/lib/season";
import type { HeroPlayer } from "@/lib/heroPlayers";

interface Props {
  player: HeroPlayer;
  isMobile: boolean;
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

function PlayerCard({ player, isMobile }: { player: HeroPlayer; isMobile: boolean }) {
  const [imgLoaded, setImgLoaded] = useState(false);

  const cardW = isMobile ? "100%" : 420;
  const cardH = isMobile ? 480 : 540;

  return (
    <div
      style={{
        position: "relative",
        width: cardW,
        height: cardH,
        borderRadius: 20,
        overflow: "hidden",
        fontFamily: FONT,
        // Dark base with team color gradient
        background: `linear-gradient(160deg, #0d1117 0%, ${player.accent}30 50%, #0d1117 100%)`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.3), 0 0 60px ${player.accent}15`,
        border: `1px solid ${player.accent}25`,
      }}
    >
      {/* === Inner glow edges === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 20,
          boxShadow: `inset 0 1px 0 ${player.accentLight}18, inset 0 -1px 0 ${player.accent}15`,
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* === Subtle grid texture === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* === Team color bloom behind player === */}
      <div
        style={{
          position: "absolute",
          top: "20%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${player.accent}25 0%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      {/* === Top label === */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 22,
          zIndex: 10,
          fontSize: 10,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "2px",
        }}
      >
        BLUEPRINT SCOUT
      </div>

      {/* === Number badge (top right) === */}
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 18,
          zIndex: 10,
          padding: "5px 10px",
          borderRadius: 8,
          background: `${player.accent}40`,
          border: `1px solid ${player.accent}50`,
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(255,255,255,0.7)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        #{player.number}
      </div>

      {/* === Player image === */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? "6%" : "8%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "60%",
          zIndex: 3,
        }}
      >
        <img
          src={player.portraitImage}
          alt={player.name}
          onLoad={() => setImgLoaded(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 10%",
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.5s ease",
            maskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 65%, transparent 100%)",
          }}
        />
      </div>

      {/* === Stat capsules positioned around card === */}
      {/* PTS — left */}
      <StatCapsule
        label="PTS"
        value={player.pts}
        accent={player.accent}
        accentLight={player.accentLight}
        style={{
          position: "absolute",
          left: isMobile ? 12 : 16,
          bottom: isMobile ? 140 : 160,
          zIndex: 10,
        }}
      />
      {/* REB — right top */}
      <StatCapsule
        label="REB"
        value={player.reb}
        accent={player.accent}
        accentLight={player.accentLight}
        style={{
          position: "absolute",
          right: isMobile ? 12 : 16,
          bottom: isMobile ? 180 : 210,
          zIndex: 10,
        }}
      />
      {/* AST — right bottom */}
      <StatCapsule
        label="AST"
        value={player.ast}
        accent={player.accent}
        accentLight={player.accentLight}
        style={{
          position: "absolute",
          right: isMobile ? 12 : 16,
          bottom: isMobile ? 110 : 130,
          zIndex: 10,
        }}
      />

      {/* === Player name plate (bottom) === */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          padding: isMobile ? "20px 18px 22px" : "24px 24px 28px",
          background: `linear-gradient(to bottom, transparent 0%, ${player.accent}35 40%, ${player.accent}60 100%)`,
        }}
      >
        <div
          style={{
            background: "rgba(255,255,255,0.06)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 14,
            padding: isMobile ? "14px 16px" : "16px 20px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              fontSize: isMobile ? 18 : 20,
              fontWeight: 700,
              color: "#fff",
              lineHeight: 1.2,
            }}
          >
            {player.name}
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
            }}
          >
            {player.team} · {player.teamZh} · {player.position}
          </div>
        </div>
      </div>

      {/* === Accent edge light (left) === */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: 0,
          width: 2,
          height: "25%",
          borderRadius: 1,
          background: `linear-gradient(to bottom, transparent, ${player.accentLight}60, transparent)`,
          zIndex: 10,
          pointerEvents: "none",
        }}
      />
      {/* === Accent edge light (right) === */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: 0,
          width: 2,
          height: "20%",
          borderRadius: 1,
          background: `linear-gradient(to bottom, transparent, ${player.accent}50, transparent)`,
          zIndex: 10,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

function StatCapsule({
  label,
  value,
  accent,
  accentLight,
  style: wrapStyle,
}: {
  label: string;
  value: string;
  accent: string;
  accentLight: string;
  style: React.CSSProperties;
}) {
  return (
    <div
      style={{
        ...wrapStyle,
        background: "rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderRadius: 12,
        padding: "10px 14px",
        border: `1px solid ${accent}30`,
        minWidth: 56,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 800,
          color: "rgba(255,255,255,0.9)",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: "rgba(255,255,255,0.35)",
          letterSpacing: "1.5px",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export default function DraftWinsSection({ player, isMobile }: Props) {
  const { t } = useLang();
  const [cta2Hover, setCta2Hover] = useState(false);

  return (
    <section
      style={{
        background: "#fff",
        padding: isMobile ? "48px 16px 56px" : "96px 24px 100px",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? 40 : 64,
        }}
      >
        {/* === Left: copy === */}
        <div style={{ flex: isMobile ? "none" : "0 0 48%", width: isMobile ? "100%" : undefined, minWidth: 0 }}>
          {/* Badge */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              background: "#eff6ff",
              borderRadius: 999,
              marginBottom: 28,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: "#f59e0b",
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#2563eb" }}>
              {t(
                `${getCurrentSeasonLabel()} NBA赛季 · 数据实时更新`,
                `${getCurrentSeasonLabel()} NBA Season · Live Data`
              )}
            </span>
          </div>

          {/* Headline */}
          <h2 style={{ margin: 0, lineHeight: 1.12 }}>
            <div
              style={{
                fontSize: isMobile ? 36 : 54,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: isMobile ? "-1px" : "-2px",
              }}
            >
              {t("用数据赢得", "Win Your Draft")}
            </div>
            <div
              style={{
                fontSize: isMobile ? 36 : 54,
                fontWeight: 800,
                color: "#2563eb",
                letterSpacing: isMobile ? "-1px" : "-2px",
                fontStyle: "italic",
              }}
            >
              {t("每一场选秀", "With Data")}
            </div>
          </h2>

          {/* Description */}
          <p
            style={{
              margin: "22px 0 36px",
              fontSize: 16,
              lineHeight: 1.75,
              color: "#64748b",
              maxWidth: 430,
            }}
          >
            {t(
              "中国首个专业范特西篮球决策平台。AI排名、实时数据、深度分析，让你每一轮都不踩雷。",
              "China's first professional fantasy basketball platform. AI rankings, live data, deep analysis — so you nail every pick."
            )}
          </p>

          {/* CTAs */}
          <div style={{ display: "flex" }}>
            <Link
              href="/how-to-play"
              onMouseEnter={() => setCta2Hover(true)}
              onMouseLeave={() => setCta2Hover(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "14px 30px",
                border: `2px solid ${cta2Hover ? "#cbd5e1" : "#e2e8f0"}`,
                color: "#374151",
                borderRadius: 10,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                background: cta2Hover ? "#f8fafc" : "#fff",
                transition: "all 0.15s",
              }}
            >
              {t("查看选秀指南", "Draft Guide")}
            </Link>
          </div>
        </div>

        {/* === Right: premium player card === */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center", width: "100%", minWidth: 0 }}>
          <PlayerCard player={player} isMobile={isMobile} />
        </div>
      </div>
    </section>
  );
}
