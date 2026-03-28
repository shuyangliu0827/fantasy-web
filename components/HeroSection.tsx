"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import type { HeroPlayer } from "@/lib/heroPlayers";

interface Props {
  player: HeroPlayer;
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export default function HeroSection({ player }: Props) {
  const { t } = useLang();
  const [mounted, setMounted] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [ctaHover, setCtaHover] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setMounted(true));
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const entered = mounted && imgLoaded;
  const firstName = player.name.split(" ")[0].toUpperCase();
  const lastName = player.name.split(" ").slice(1).join(" ").toUpperCase();

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        minHeight: 680,
        overflow: "hidden",
        fontFamily: FONT,
        background: "#0a0e1a",
      }}
    >
      {/* === BG: team-tinted dark gradient === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 70% 60% at 50% 40%, ${player.accent}22 0%, transparent 70%),
            radial-gradient(ellipse 50% 40% at 60% 70%, ${player.accentLight}0a 0%, transparent 60%),
            linear-gradient(180deg, #0d1117 0%, #0a0e1a 50%, #080c16 100%)
          `,
          opacity: entered ? 1 : 0,
          transition: "opacity 1s ease",
        }}
      />

      {/* === BG: breathing glow === */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "50%",
          width: isMobile ? 400 : 700,
          height: isMobile ? 400 : 700,
          transform: "translateX(-50%)",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${player.accent}15 0%, transparent 70%)`,
          filter: "blur(60px)",
          animation: entered ? "heroGlowPulse 6s ease-in-out infinite" : "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 1.5s ease 0.3s",
          pointerEvents: "none",
        }}
      />

      {/* === BG: faint grid === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
          opacity: entered ? 1 : 0,
          transition: "opacity 1s ease 0.2s",
          pointerEvents: "none",
        }}
      />

      {/* === BG: vignette === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse 80% 70% at 50% 45%, transparent 30%, #0a0e1a 100%)`,
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* === Corner micro label === */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? 16 : 24,
          left: isMobile ? 16 : 32,
          zIndex: 20,
          opacity: entered ? 0.3 : 0,
          transition: "opacity 0.6s ease 1s",
          pointerEvents: "none",
        }}
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <line x1="0" y1="6" x2="12" y2="6" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
          <line x1="6" y1="0" x2="6" y2="12" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
        </svg>
      </div>
      <div
        style={{
          position: "absolute",
          top: isMobile ? 16 : 24,
          right: isMobile ? 16 : 32,
          zIndex: 20,
          fontSize: 9,
          fontWeight: 500,
          color: "rgba(255,255,255,0.25)",
          letterSpacing: "2px",
          opacity: entered ? 1 : 0,
          transition: "opacity 0.6s ease 1s",
          pointerEvents: "none",
        }}
      >
        PLATE · {player.number.padStart(2, "0")}
      </div>

      {/* === Player image (centered) === */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? "8%" : "5%",
          left: "50%",
          transform: "translateX(-50%)",
          width: isMobile ? "90%" : "42%",
          maxWidth: 600,
          height: isMobile ? "65%" : "78%",
          zIndex: 3,
          opacity: entered ? 1 : 0,
          filter: entered ? "none" : "blur(8px)",
          transition: "opacity 0.8s ease 0.15s, filter 0.9s ease 0.15s",
          animation: entered && !isMobile ? "heroPlayerFloat 7s ease-in-out infinite" : "none",
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
            maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)",
          }}
        />
      </div>

      {/* === Player name (editorial overlay) === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? "28%" : "24%",
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: "center",
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s",
          pointerEvents: "none",
        }}
      >
        {firstName !== lastName && (
          <div
            style={{
              fontSize: isMobile ? 14 : 16,
              fontWeight: 500,
              color: "rgba(255,255,255,0.35)",
              letterSpacing: isMobile ? "6px" : "12px",
              marginBottom: isMobile ? 4 : 8,
              textTransform: "uppercase",
            }}
          >
            {firstName}
          </div>
        )}
        <div
          style={{
            fontSize: isMobile ? 42 : 72,
            fontWeight: 800,
            color: "#fff",
            letterSpacing: isMobile ? "2px" : "6px",
            textTransform: "uppercase",
            textShadow: `0 0 80px ${player.accent}40, 0 2px 30px rgba(0,0,0,0.5)`,
            lineHeight: 1,
          }}
        >
          {lastName || firstName}
        </div>
      </div>

      {/* === Team / Position subtle label === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? "24%" : "20%",
          left: 0,
          right: 0,
          zIndex: 10,
          textAlign: "center",
          opacity: entered ? 0.35 : 0,
          transition: "opacity 0.6s ease 0.7s",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#fff",
            letterSpacing: "3px",
          }}
        >
          {player.team} · {player.teamZh} · {player.position}
        </span>
      </div>

      {/* === Stats row === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? "16%" : "13%",
          left: 0,
          right: 0,
          zIndex: 10,
          display: "flex",
          justifyContent: "center",
          gap: isMobile ? 28 : 48,
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(12px)",
          transition: "opacity 0.6s ease 0.8s, transform 0.6s ease 0.8s",
          pointerEvents: "none",
        }}
      >
        {[
          { label: "PTS", value: player.pts },
          { label: "REB", value: player.reb },
          { label: "AST", value: player.ast },
        ].map((s) => (
          <div key={s.label} style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "2px",
                marginBottom: 4,
              }}
            >
              {s.label}
            </div>
            <div
              style={{
                fontSize: isMobile ? 20 : 26,
                fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "-0.5px",
              }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* === Brand mark + CTA === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? 24 : 36,
          left: 0,
          right: 0,
          zIndex: 20,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: isMobile ? 12 : 16,
          opacity: entered ? 1 : 0,
          transform: entered ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.6s ease 1s, transform 0.6s ease 1s",
        }}
      >
        {/* Brand */}
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 2 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.5px" }}>
              蓝本
            </span>
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: "50%",
                background: "#f59e0b",
                marginBottom: 8,
              }}
            />
          </div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 500,
              color: "rgba(255,255,255,0.2)",
              letterSpacing: "3px",
              marginTop: 2,
            }}
          >
            DRAFT INTELLIGENCE
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/auth/signup"
          onMouseEnter={() => setCtaHover(true)}
          onMouseLeave={() => setCtaHover(false)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: isMobile ? "11px 28px" : "12px 32px",
            background: ctaHover
              ? "rgba(255,255,255,0.15)"
              : "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            color: "#fff",
            textDecoration: "none",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            transition: "all 0.25s ease",
          }}
        >
          {t("免费开始", "Get Started")}
          <span style={{ opacity: 0.6 }}>→</span>
        </Link>

        {/* Progress bar accent */}
        <div
          style={{
            width: isMobile ? 40 : 56,
            height: 2,
            borderRadius: 1,
            background: `linear-gradient(90deg, ${player.accent}, ${player.accentLight})`,
            opacity: 0.5,
          }}
        />
      </div>

      {/* Keyframes */}
      <style>{`
        @keyframes heroGlowPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.7; }
          50% { transform: translateX(-50%) scale(1.08); opacity: 1; }
        }
        @keyframes heroPlayerFloat {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </section>
  );
}
