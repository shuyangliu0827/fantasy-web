"use client";

import { useState, useEffect, useCallback } from "react";
import { HERO_PLAYERS, type HeroPlayer } from "@/lib/players/hero-players";
import PlayerRevealVisual from "./PlayerRevealVisual";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

function pickRandom(exclude?: string): HeroPlayer {
  const pool = exclude
    ? HERO_PLAYERS.filter((p) => p.id !== exclude)
    : HERO_PLAYERS;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function HomeHeroShowcase() {
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 768 : false);
  const [mounted, setMounted] = useState(false);
  const [player, setPlayer] = useState<HeroPlayer>(() => pickRandom());

  useEffect(() => {
    // Delay mounted to allow entrance animation
    requestAnimationFrame(() => setMounted(true));
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleImageError = useCallback(() => {
    setPlayer((prev) => pickRandom(prev?.id));
  }, []);

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        height: isMobile ? "85vh" : "100vh",
        minHeight: isMobile ? 560 : 680,
        overflow: "hidden",
        fontFamily: FONT,
        background: `linear-gradient(180deg, #f0f2f7 0%, #e4e8f0 100%)`,
      }}
    >
      {/* === Multi-layered player visual === */}
      <PlayerRevealVisual
        player={player}
        isMobile={isMobile}
        mounted={mounted}
        onImageError={handleImageError}
      />

      {/* === Player identity — bottom left === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? 32 : 48,
          left: isMobile ? 16 : 48,
          zIndex: 20,
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(16px)",
          transition: "opacity 0.6s ease 0.8s, transform 0.6s ease 0.8s",
        }}
      >
        {/* Team + position tag */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              width: 3,
              height: 16,
              borderRadius: 2,
              background: player.accent,
            }}
          />
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#64748b",
              letterSpacing: "2px",
              textTransform: "uppercase",
            }}
          >
            {player.team} · {player.position}
          </span>
        </div>

        {/* Player name */}
        <div
          style={{
            fontSize: isMobile ? 28 : 40,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            textShadow: "0 2px 20px rgba(255,255,255,0.5)",
          }}
        >
          {player.name}
        </div>

        {/* Number badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            padding: "6px 14px",
            background: "rgba(255,255,255,0.7)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.5)",
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: player.accent,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 800,
              color: "#fff",
            }}
          >
            #{player.number}
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b" }}>
            {player.teamZh}
          </span>
        </div>
      </div>

      {/* === Corner decorative marks === */}
      <svg
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          zIndex: 15,
          opacity: mounted ? 0.15 : 0,
          transition: "opacity 0.6s ease 1s",
          pointerEvents: "none",
        }}
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M0 12V0H12" stroke={player.accent} strokeWidth="1.5" />
      </svg>
      <svg
        style={{
          position: "absolute",
          bottom: 20,
          right: 20,
          zIndex: 15,
          opacity: mounted ? 0.15 : 0,
          transition: "opacity 0.6s ease 1s",
          pointerEvents: "none",
          transform: "rotate(180deg)",
        }}
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
      >
        <path d="M0 12V0H12" stroke={player.accent} strokeWidth="1.5" />
      </svg>

      {/* === Bottom fade to next section === */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 120,
          background: "linear-gradient(to bottom, transparent, #ffffff)",
          pointerEvents: "none",
          zIndex: 18,
        }}
      />

      {/* === Scroll indicator === */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 28,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 20,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            opacity: mounted ? 0.3 : 0,
            transition: "opacity 0.6s ease 1.2s",
            animation: mounted
              ? "heroScrollBounce 2s ease-in-out infinite"
              : "none",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 500,
              color: "#64748b",
              letterSpacing: "1.5px",
            }}
          >
            SCROLL
          </span>
          <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
            <path
              d="M1 1L7 7L13 1"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}

      <style>{`
        @keyframes heroScrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </section>
  );
}
