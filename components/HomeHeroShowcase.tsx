"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
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
  const { t } = useLang();
  const [isMobile, setIsMobile] = useState(false);
  const [cta1Hovered, setCta1Hovered] = useState(false);
  const [cta2Hovered, setCta2Hovered] = useState(false);
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

      {/* === Left-side overlay gradient for text readability === */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 7,
          pointerEvents: "none",
          background: isMobile
            ? `linear-gradient(180deg, rgba(250,251,253,0.85) 0%, rgba(250,251,253,0.6) 40%, transparent 70%, rgba(15,23,42,0.3) 100%)`
            : `linear-gradient(90deg, rgba(250,251,253,0.92) 0%, rgba(250,251,253,0.75) 30%, rgba(250,251,253,0.3) 50%, transparent 65%)`,
        }}
      />
      {/* Additional bottom fade for text at bottom */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "30%",
            zIndex: 7,
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom, transparent, rgba(250,251,253,0.4) 60%, rgba(250,251,253,0.8) 100%)",
          }}
        />
      )}

      {/* === Content overlay === */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "0 20px" : "0 48px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: isMobile ? "flex-start" : "center",
          paddingTop: isMobile ? 40 : 0,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            maxWidth: isMobile ? "100%" : 480,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(24px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
            pointerEvents: "auto",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              background: "rgba(37, 99, 235, 0.08)",
              border: "1px solid rgba(37, 99, 235, 0.12)",
              borderRadius: 999,
              marginBottom: 24,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#2563eb",
                animation: "heroEyebrowPulse 2.5s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#2563eb",
                letterSpacing: "0.5px",
              }}
            >
              {t("智能范特西篮球平台", "INTELLIGENT FANTASY BASKETBALL")}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ margin: 0, lineHeight: 1.08 }}>
            <span
              style={{
                display: "block",
                fontSize: isMobile ? 36 : 56,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: isMobile ? "-1px" : "-2.5px",
                marginBottom: 4,
              }}
            >
              {t("不只是看比赛", "Beyond Watching")}
            </span>
            <span
              style={{
                display: "block",
                fontSize: isMobile ? 36 : 56,
                fontWeight: 800,
                letterSpacing: isMobile ? "-1px" : "-2.5px",
                background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {t("而是读懂比赛", "Understand the Game")}
            </span>
          </h1>

          {/* Supporting paragraph */}
          <p
            style={{
              margin: "20px 0 32px",
              fontSize: isMobile ? 15 : 16,
              lineHeight: 1.75,
              color: "#475569",
              maxWidth: 400,
            }}
          >
            {t(
              "选秀、对比、判断、策略 —— 都在同一个入口完成。用数据驱动每一次决策，让你的阵容不再靠运气。",
              "Draft, compare, evaluate, strategize — all in one place. Make every decision data-driven, so your roster doesn't rely on luck."
            )}
          </p>

          {/* CTAs */}
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Link
              href="/auth/signup"
              onMouseEnter={() => setCta1Hovered(true)}
              onMouseLeave={() => setCta1Hovered(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: isMobile ? "13px 26px" : "15px 32px",
                background: cta1Hovered
                  ? "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)"
                  : "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
                color: "#fff",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 700,
                textDecoration: "none",
                transition: "all 0.25s ease",
                boxShadow: cta1Hovered
                  ? "0 8px 32px rgba(30, 58, 138, 0.35)"
                  : "0 4px 20px rgba(30, 58, 138, 0.2)",
                transform: cta1Hovered ? "translateY(-1px)" : "none",
              }}
            >
              {t("免费开始", "Get Started")}
              <span style={{ fontSize: 18 }}>→</span>
            </Link>
            <Link
              href="/how-to-play"
              onMouseEnter={() => setCta2Hovered(true)}
              onMouseLeave={() => setCta2Hovered(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: isMobile ? "13px 26px" : "15px 32px",
                border: `1.5px solid ${cta2Hovered ? "rgba(203,213,225,0.8)" : "rgba(226,232,240,0.7)"}`,
                color: "#374151",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                background: cta2Hovered
                  ? "rgba(248,250,252,0.85)"
                  : "rgba(255,255,255,0.6)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
                transition: "all 0.2s ease",
              }}
            >
              {t("了解玩法", "How It Works")}
            </Link>
          </div>

          {/* Trust indicators */}
          <div
            style={{
              marginTop: isMobile ? 28 : 40,
              display: "flex",
              gap: isMobile ? 20 : 32,
              alignItems: "center",
            }}
          >
            {[
              { value: "480+", label: t("球员数据", "Players") },
              { value: "实时", label: t("数据更新", "Live Data") },
              { value: "AI", label: t("智能排名", "Rankings") },
            ].map((stat) => (
              <div key={stat.label}>
                <div
                  style={{
                    fontSize: isMobile ? 18 : 22,
                    fontWeight: 800,
                    color: "#1e3a8a",
                    letterSpacing: "-0.5px",
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    fontWeight: 500,
                    marginTop: 4,
                  }}
                >
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
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
          {t("移动鼠标探索球员", "Move cursor to explore")}
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
        @keyframes heroEyebrowPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes heroScrollBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(6px); }
        }
      `}</style>
    </section>
  );
}
