"use client";

import { useState, useEffect } from "react";
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
        minHeight: 600,
        overflow: "hidden",
        fontFamily: FONT,
        background: "#0a0e1a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* ============================================= */}
      {/* BG LAYERS — these fill the full viewport      */}
      {/* ============================================= */}

      {/* BG: team-tinted dark gradient */}
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

      {/* BG: breathing glow */}
      <div
        style={{
          position: "absolute",
          top: "25%",
          left: "50%",
          width: "clamp(300px, 45vw, 700px)",
          height: "clamp(300px, 45vw, 700px)",
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

      {/* BG: faint grid */}
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

      {/* BG: vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 80% 70% at 50% 45%, transparent 30%, #0a0e1a 100%)",
          pointerEvents: "none",
          zIndex: 2,
        }}
      />

      {/* Corner micro labels — pinned to viewport */}
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

      {/* ============================================= */}
      {/* COMPOSITION CANVAS — bounded, uniformly scaled */}
      {/* ============================================= */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 900,
          height: "90vh",
          maxHeight: 860,
          minHeight: 520,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* === Player image — positioned within canvas === */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: isMobile ? "88%" : "clamp(280px, 50%, 480px)",
            height: "75%",
            zIndex: 1,
            opacity: entered ? 1 : 0,
            filter: entered ? "none" : "blur(8px)",
            transition: "opacity 0.8s ease 0.15s, filter 0.9s ease 0.15s",
            animation: entered && !isMobile ? "heroPlayerFloat 7s ease-in-out infinite" : "none",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={player.portraitImage}
            alt={player.name}
            onLoad={() => setImgLoaded(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center 10%",
              maskImage: "linear-gradient(to bottom, black 55%, transparent 95%)",
              WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 95%)",
            }}
          />
        </div>

        {/* === Content stack — all text in one flex column === */}
        <div
          style={{
            position: "relative",
            zIndex: 10,
            width: "100%",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            paddingBottom: isMobile ? 16 : 24,
            gap: 0,
          }}
        >
          {/* -- Player name block -- */}
          <div
            style={{
              textAlign: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(16px)",
              transition: "opacity 0.7s ease 0.5s, transform 0.7s ease 0.5s",
              pointerEvents: "none",
              marginBottom: "clamp(4px, 0.8vh, 10px)",
            }}
          >
            {firstName !== lastName && (
              <div
                style={{
                  fontSize: "clamp(11px, 1.2vw, 16px)",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.3)",
                  letterSpacing: "clamp(4px, 1vw, 12px)",
                  marginBottom: "clamp(2px, 0.5vh, 8px)",
                  textTransform: "uppercase",
                }}
              >
                {firstName}
              </div>
            )}
            <div
              style={{
                fontSize: "clamp(32px, 5.5vw, 68px)",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "clamp(1px, 0.5vw, 6px)",
                textTransform: "uppercase",
                textShadow: `0 0 60px ${player.accent}40, 0 2px 20px rgba(0,0,0,0.5)`,
                lineHeight: 1,
              }}
            >
              {lastName || firstName}
            </div>
          </div>

          {/* -- Team / Position -- */}
          <div
            style={{
              textAlign: "center",
              opacity: entered ? 0.35 : 0,
              transition: "opacity 0.6s ease 0.65s",
              pointerEvents: "none",
              marginBottom: "clamp(10px, 1.8vh, 22px)",
            }}
          >
            <span
              style={{
                fontSize: "clamp(9px, 0.9vw, 12px)",
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "3px",
              }}
            >
              {player.team} · {player.teamZh} · {player.position}
            </span>
          </div>

          {/* -- Stats row -- */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "clamp(20px, 4vw, 48px)",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 0.6s ease 0.75s, transform 0.6s ease 0.75s",
              pointerEvents: "none",
              marginBottom: "clamp(14px, 2.5vh, 32px)",
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
                    fontSize: "clamp(8px, 0.8vw, 10px)",
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.3)",
                    letterSpacing: "2px",
                    marginBottom: "clamp(2px, 0.4vh, 5px)",
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: "clamp(16px, 2vw, 24px)",
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

          {/* -- Brand mark -- */}
          <div
            style={{
              textAlign: "center",
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.6s ease 0.9s, transform 0.6s ease 0.9s",
              marginBottom: "clamp(10px, 1.5vh, 18px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
              }}
            >
              <span
                style={{
                  fontSize: "clamp(14px, 1.4vw, 18px)",
                  fontWeight: 800,
                  color: "#fff",
                  letterSpacing: "-0.5px",
                }}
              >
                蓝本
              </span>
              <span
                style={{
                  width: "clamp(4px, 0.4vw, 5px)",
                  height: "clamp(4px, 0.4vw, 5px)",
                  borderRadius: "50%",
                  background: "#f59e0b",
                  marginBottom: "clamp(5px, 0.7vw, 8px)",
                }}
              />
            </div>
            <div
              style={{
                fontSize: "clamp(7px, 0.7vw, 9px)",
                fontWeight: 500,
                color: "rgba(255,255,255,0.2)",
                letterSpacing: "3px",
                marginTop: 2,
              }}
            >
              DRAFT INTELLIGENCE
            </div>
          </div>

          {/* -- CTA button -- */}
          <div
            style={{
              opacity: entered ? 1 : 0,
              transform: entered ? "translateY(0)" : "translateY(8px)",
              transition: "opacity 0.6s ease 1s, transform 0.6s ease 1s",
              marginBottom: "clamp(8px, 1.2vh, 14px)",
            }}
          >
            <Link
              href="/auth/signup"
              onMouseEnter={() => setCtaHover(true)}
              onMouseLeave={() => setCtaHover(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "clamp(9px, 1vh, 12px) clamp(22px, 2.5vw, 32px)",
                background: ctaHover
                  ? "rgba(255,255,255,0.15)"
                  : "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                fontSize: "clamp(12px, 1.1vw, 14px)",
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
          </div>

          {/* -- Accent bar -- */}
          <div
            style={{
              width: "clamp(32px, 4vw, 56px)",
              height: 2,
              borderRadius: 1,
              background: `linear-gradient(90deg, ${player.accent}, ${player.accentLight})`,
              opacity: entered ? 0.5 : 0,
              transition: "opacity 0.6s ease 1.1s",
            }}
          />
        </div>
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
