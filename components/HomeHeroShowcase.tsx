"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import PlayerRevealVisual, { type HeroPlayer } from "./PlayerRevealVisual";

const HERO_PLAYERS: HeroPlayer[] = [
  {
    id: "lebron",
    name: "LeBron James",
    nameZh: "勒布朗·詹姆斯",
    team: "LAL",
    teamZh: "湖人",
    number: "23",
    position: "SF",
    portraitImage: "/players/lebron-portrait.png",
    jerseyImage: "/players/lebron-jersey.png",
    accent: "#552583",
  },
  {
    id: "jokic",
    name: "Nikola Jokić",
    nameZh: "尼古拉·约基奇",
    team: "DEN",
    teamZh: "掘金",
    number: "15",
    position: "C",
    portraitImage: "/players/jokic-portrait.png",
    jerseyImage: "/players/jokic-jersey.png",
    accent: "#0E2240",
  },
  {
    id: "curry",
    name: "Stephen Curry",
    nameZh: "斯蒂芬·库里",
    team: "GSW",
    teamZh: "勇士",
    number: "30",
    position: "PG",
    portraitImage: "/players/curry-portrait.png",
    jerseyImage: "/players/curry-jersey.png",
    accent: "#1D428A",
  },
  {
    id: "giannis",
    name: "Giannis Antetokounmpo",
    nameZh: "扬尼斯·安特托昆博",
    team: "MIL",
    teamZh: "雄鹿",
    number: "34",
    position: "PF",
    portraitImage: "/players/giannis-portrait.png",
    jerseyImage: "/players/giannis-jersey.png",
    accent: "#00471B",
  },
  {
    id: "luka",
    name: "Luka Dončić",
    nameZh: "卢卡·东契奇",
    team: "DAL",
    teamZh: "独行侠",
    number: "77",
    position: "PG",
    portraitImage: "/players/luka-portrait.png",
    jerseyImage: "/players/luka-jersey.png",
    accent: "#00538C",
  },
  {
    id: "shai",
    name: "Shai Gilgeous-Alexander",
    nameZh: "谢·吉尔杰斯-亚历山大",
    team: "OKC",
    teamZh: "雷霆",
    number: "2",
    position: "SG",
    portraitImage: "/players/sga-portrait.png",
    jerseyImage: "/players/sga-jersey.png",
    accent: "#007AC1",
  },
];

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', 'Microsoft YaHei', sans-serif";

export default function HomeHeroShowcase() {
  const { t } = useLang();
  const [isMobile, setIsMobile] = useState(false);
  const [cta1Hovered, setCta1Hovered] = useState(false);
  const [cta2Hovered, setCta2Hovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  const player = useMemo(() => {
    return HERO_PLAYERS[Math.floor(Math.random() * HERO_PLAYERS.length)];
  }, []);

  useEffect(() => {
    setMounted(true);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        minHeight: isMobile ? "auto" : "100vh",
        background: "#fafbfd",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* Background decorative elements */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Soft blob top-right */}
        <div
          style={{
            position: "absolute",
            top: "-15%",
            right: "-10%",
            width: "55%",
            height: "70%",
            background:
              "radial-gradient(ellipse at center, rgba(37, 99, 235, 0.045) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Soft blob bottom-left */}
        <div
          style={{
            position: "absolute",
            bottom: "-20%",
            left: "-15%",
            width: "50%",
            height: "60%",
            background:
              "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.035) 0%, transparent 70%)",
            borderRadius: "50%",
          }}
        />
        {/* Light contour rings */}
        <svg
          style={{
            position: "absolute",
            top: "10%",
            right: "5%",
            opacity: 0.04,
          }}
          width="500"
          height="500"
          viewBox="0 0 500 500"
          fill="none"
        >
          <circle cx="250" cy="250" r="200" stroke="#1e3a8a" strokeWidth="1" />
          <circle cx="250" cy="250" r="160" stroke="#1e3a8a" strokeWidth="0.7" />
          <circle cx="250" cy="250" r="120" stroke="#1e3a8a" strokeWidth="0.5" />
        </svg>
        {/* Horizontal fine lines */}
        <svg
          style={{
            position: "absolute",
            bottom: "15%",
            left: "3%",
            opacity: 0.03,
          }}
          width="300"
          height="200"
          viewBox="0 0 300 200"
          fill="none"
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              y1={i * 28}
              x2="300"
              y2={i * 28}
              stroke="#1e3a8a"
              strokeWidth="0.5"
            />
          ))}
        </svg>
        {/* Small accent dots */}
        <div
          style={{
            position: "absolute",
            top: "22%",
            left: "8%",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#f59e0b",
            opacity: 0.3,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "70%",
            right: "12%",
            width: 4,
            height: 4,
            borderRadius: "50%",
            background: "#2563eb",
            opacity: 0.2,
          }}
        />
        {/* Subtle grid pattern overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(30, 58, 138, 0.015) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30, 58, 138, 0.015) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />
      </div>

      {/* Main content */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 1200,
          margin: "0 auto",
          padding: isMobile ? "48px 16px 56px" : "0 24px",
          minHeight: isMobile ? "auto" : "100vh",
          display: "flex",
          flexDirection: isMobile ? "column" : "row",
          alignItems: "center",
          gap: isMobile ? 40 : 64,
        }}
      >
        {/* Left: Copy */}
        <div
          style={{
            flex: isMobile ? "none" : "0 0 46%",
            width: isMobile ? "100%" : undefined,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(20px)",
            transition: "opacity 0.7s ease, transform 0.7s ease",
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "5px 14px",
              background: "rgba(37, 99, 235, 0.06)",
              border: "1px solid rgba(37, 99, 235, 0.1)",
              borderRadius: 999,
              marginBottom: 28,
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
            <span style={{ fontSize: 12, fontWeight: 600, color: "#2563eb", letterSpacing: "0.5px" }}>
              {t("智能范特西篮球平台", "INTELLIGENT FANTASY BASKETBALL")}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ margin: 0, lineHeight: 1.1 }}>
            <span
              style={{
                display: "block",
                fontSize: isMobile ? 34 : 52,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: isMobile ? "-1px" : "-2px",
                marginBottom: 4,
              }}
            >
              {t("不只是看比赛", "Beyond Watching")}
            </span>
            <span
              style={{
                display: "block",
                fontSize: isMobile ? 34 : 52,
                fontWeight: 800,
                letterSpacing: isMobile ? "-1px" : "-2px",
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
              margin: "24px 0 36px",
              fontSize: isMobile ? 15 : 16,
              lineHeight: 1.8,
              color: "#64748b",
              maxWidth: 400,
            }}
          >
            {t(
              "选秀、对比、判断、策略 —— 都在同一个入口完成。用数据驱动每一次决策，让你的阵容不再靠运气。",
              "Draft, compare, evaluate, strategize — all in one place. Make every decision data-driven, so your roster doesn't rely on luck."
            )}
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center" }}>
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
                border: `1.5px solid ${cta2Hovered ? "#cbd5e1" : "#e2e8f0"}`,
                color: "#374151",
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 600,
                textDecoration: "none",
                background: cta2Hovered ? "#f8fafc" : "rgba(255,255,255,0.7)",
                transition: "all 0.2s ease",
              }}
            >
              {t("了解玩法", "How It Works")}
            </Link>
          </div>

          {/* Subtle trust indicators */}
          <div
            style={{
              marginTop: 44,
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
                    color: "#94a3b8",
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

        {/* Right: Player Visual */}
        <div
          style={{
            flex: 1,
            width: "100%",
            minWidth: 0,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0) scale(1)" : "translateY(30px) scale(0.97)",
            transition: "opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              maxWidth: isMobile ? 380 : 520,
              margin: "0 auto",
              aspectRatio: "3 / 4",
            }}
          >
            {/* Decorative ring behind the frame */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "115%",
                height: "115%",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "1px solid rgba(37, 99, 235, 0.06)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "130%",
                height: "130%",
                transform: "translate(-50%, -50%)",
                borderRadius: "50%",
                border: "1px solid rgba(37, 99, 235, 0.03)",
                pointerEvents: "none",
              }}
            />

            {/* Shadow under the frame */}
            <div
              style={{
                position: "absolute",
                bottom: -12,
                left: "10%",
                right: "10%",
                height: 40,
                background:
                  "radial-gradient(ellipse at center, rgba(30, 58, 138, 0.08) 0%, transparent 70%)",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            />

            {/* The reveal component */}
            <div
              style={{
                position: "relative",
                width: "100%",
                height: "100%",
                borderRadius: 28,
                boxShadow: "0 24px 80px rgba(30, 58, 138, 0.12), 0 8px 32px rgba(0, 0, 0, 0.06)",
              }}
            >
              <PlayerRevealVisual player={player} isMobile={isMobile} />
            </div>

            {/* Floating stat chip */}
            {!isMobile && (
              <div
                style={{
                  position: "absolute",
                  top: 32,
                  right: -48,
                  background: "rgba(255, 255, 255, 0.92)",
                  backdropFilter: "blur(16px)",
                  WebkitBackdropFilter: "blur(16px)",
                  borderRadius: 14,
                  padding: "12px 16px",
                  boxShadow: "0 4px 24px rgba(0, 0, 0, 0.06)",
                  border: "1px solid rgba(226, 232, 240, 0.6)",
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateX(0)" : "translateX(-10px)",
                  transition: "opacity 0.6s ease 0.5s, transform 0.6s ease 0.5s",
                }}
              >
                <div style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", marginBottom: 4, letterSpacing: "0.5px" }}>
                  FANTASY VALUE
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", lineHeight: 1 }}>
                  68.4
                </div>
              </div>
            )}

            {/* Floating position badge */}
            {!isMobile && (
              <div
                style={{
                  position: "absolute",
                  bottom: 80,
                  left: -36,
                  background: player.accent,
                  borderRadius: 12,
                  padding: "8px 14px",
                  boxShadow: `0 4px 20px ${player.accent}44`,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "translateX(0)" : "translateX(10px)",
                  transition: "opacity 0.6s ease 0.6s, transform 0.6s ease 0.6s",
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
                  {player.position}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 80,
          background: "linear-gradient(to bottom, transparent, #ffffff)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Scroll indicator */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 3,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            opacity: 0.4,
            animation: "heroScrollBounce 2s ease-in-out infinite",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b", letterSpacing: "1px" }}>
            SCROLL
          </span>
          <svg width="16" height="10" viewBox="0 0 16 10" fill="none">
            <path d="M1 1L8 8L15 1" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
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
