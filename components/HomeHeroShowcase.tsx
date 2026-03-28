"use client";

import { useState, useEffect, useCallback } from "react";
import { HERO_PLAYERS, type HeroPlayer } from "@/lib/heroPlayers";
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
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch: render nothing on server, pick player on client
  const [player, setPlayer] = useState<HeroPlayer | null>(null);

  useEffect(() => {
    setPlayer(pickRandom());
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fallback: if image fails, swap to another player
  const handleImageError = useCallback(() => {
    setPlayer((prev) => pickRandom(prev?.id));
  }, []);

  // Before client mount, render a placeholder matching the layout
  if (!player) {
    return (
      <section
        style={{
          position: "relative",
          width: "100%",
          height: "100vh",
          background: "linear-gradient(180deg, #f0f2f7 0%, #e4e8f0 100%)",
        }}
      />
    );
  }

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
      {/* === Full-screen player image layer === */}
      <PlayerRevealVisual
        player={player}
        isMobile={isMobile}
        onImageError={handleImageError}
      />

      {/* === Background decorative elements (on top of image) === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 6,
          overflow: "hidden",
        }}
      >
        {/* Subtle grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
        {/* Soft contour rings */}
        <svg
          style={{
            position: "absolute",
            top: "5%",
            right: "3%",
            opacity: 0.05,
          }}
          width="400"
          height="400"
          viewBox="0 0 400 400"
          fill="none"
        >
          <circle cx="200" cy="200" r="180" stroke="#fff" strokeWidth="0.8" />
          <circle cx="200" cy="200" r="140" stroke="#fff" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="100" stroke="#fff" strokeWidth="0.3" />
        </svg>
        {/* Accent dots */}
        <div
          style={{
            position: "absolute",
            top: "18%",
            left: "6%",
            width: 5,
            height: 5,
            borderRadius: "50%",
            background: "#f59e0b",
            opacity: 0.4,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "65%",
            right: "8%",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#2563eb",
            opacity: 0.3,
          }}
        />
      </div>

      {/* === Player info chip — bottom right === */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? 24 : 40,
          right: isMobile ? 16 : 48,
          zIndex: 12,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255, 255, 255, 0.82)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: 16,
          padding: isMobile ? "10px 14px" : "14px 20px",
          boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
          border: "1px solid rgba(255,255,255,0.5)",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(10px)",
          transition: "opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: player.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          {player.number}
        </div>
        <div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "#0f172a",
              lineHeight: 1.2,
            }}
          >
            {player.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "#64748b",
              fontWeight: 500,
              marginTop: 2,
            }}
          >
            {player.team} · {player.position}
          </div>
        </div>
      </div>

      {/* === Hover hint === */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 24,
            right: 48,
            zIndex: 12,
            background: "rgba(255,255,255,0.6)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 10,
            padding: "6px 14px",
            fontSize: 12,
            fontWeight: 600,
            color: "#64748b",
            opacity: mounted ? 0.7 : 0,
            transition: "opacity 0.6s ease 0.5s",
            pointerEvents: "none",
          }}
        >
          移动鼠标探索球员
        </div>
      )}

      {/* === Bottom fade to next section === */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 100,
          background: "linear-gradient(to bottom, transparent, #ffffff)",
          pointerEvents: "none",
          zIndex: 11,
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
            zIndex: 12,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            opacity: 0.35,
            animation: "heroScrollBounce 2s ease-in-out infinite",
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

      {/* Keyframe animations */}
      <style>{`
        @keyframes heroScrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </section>
  );
}
