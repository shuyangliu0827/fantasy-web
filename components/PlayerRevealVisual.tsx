"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { HeroPlayer } from "@/lib/heroPlayers";

interface Props {
  player: HeroPlayer;
  isMobile: boolean;
  mounted: boolean;
  onImageError?: () => void;
}

export default function PlayerRevealVisual({
  player,
  isMobile,
  mounted,
  onImageError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mousePos = useRef({ x: 0.5, y: 0.5 });
  const smoothMouse = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);
  const loopRef = useRef<FrameRequestCallback>(() => {});
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Parallax animation loop
  const animate = useCallback(() => {
    const lerp = 0.04;
    smoothMouse.current.x +=
      (mousePos.current.x - smoothMouse.current.x) * lerp;
    smoothMouse.current.y +=
      (mousePos.current.y - smoothMouse.current.y) * lerp;

    const container = containerRef.current;
    if (!container) {
      rafRef.current = requestAnimationFrame(loopRef.current);
      return;
    }

    const mx = (smoothMouse.current.x - 0.5) * 2; // -1 to 1
    const my = (smoothMouse.current.y - 0.5) * 2;

    // Layer 1: main player — subtle shift
    const mainEl = container.querySelector(
      "[data-layer-main]"
    ) as HTMLElement | null;
    if (mainEl) {
      mainEl.style.transform = `translate(${mx * -12}px, ${my * -8}px)`;
    }

    // Layer 2: ghost/shadow — faster shift (parallax depth)
    const ghostEl = container.querySelector(
      "[data-layer-ghost]"
    ) as HTMLElement | null;
    if (ghostEl) {
      ghostEl.style.transform = `translate(${mx * -25}px, ${my * -18}px) scale(1.05)`;
    }

    // Layer 3: ambient geometry — opposite direction
    const ambientEl = container.querySelector(
      "[data-layer-ambient]"
    ) as HTMLElement | null;
    if (ambientEl) {
      ambientEl.style.transform = `translate(${mx * 15}px, ${my * 10}px)`;
    }

    // Layer 4: glow orb follows mouse loosely
    const glowEl = container.querySelector(
      "[data-layer-glow]"
    ) as HTMLElement | null;
    if (glowEl) {
      glowEl.style.transform = `translate(${mx * 40}px, ${my * 30}px)`;
    }

    rafRef.current = requestAnimationFrame(loopRef.current);
  }, []);
  loopRef.current = animate;

  useEffect(() => {
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      mousePos.current.x = (e.clientX - rect.left) / rect.width;
      mousePos.current.y = (e.clientY - rect.top) / rect.height;
    },
    [isMobile]
  );

  const handleImgError = useCallback(() => {
    setImgError(true);
    onImageError?.();
  }, [onImageError]);

  if (imgError) return null;

  // Entrance animation stages
  const entered = mounted && imgLoaded;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        cursor: isMobile ? "default" : "crosshair",
      }}
    >
      {/* ===== L0: Animated background gradient ===== */}
      <div
        style={{
          position: "absolute",
          inset: "-10%",
          background: `
            radial-gradient(ellipse 80% 60% at 65% 45%, ${player.accent}18 0%, transparent 70%),
            radial-gradient(ellipse 60% 50% at 30% 60%, ${player.accentLight}12 0%, transparent 60%),
            linear-gradient(180deg, #f0f2f7 0%, #e2e6ef 50%, #dde2ed 100%)
          `,
          animation: "heroBgDrift 12s ease-in-out infinite alternate",
          opacity: entered ? 1 : 0,
          transition: "opacity 0.8s ease",
        }}
      />

      {/* ===== L1: Grid + court geometry (ambient layer) ===== */}
      <div
        data-layer-ambient
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 1s ease 0.3s",
        }}
      >
        {/* Fine grid */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `
              linear-gradient(rgba(30,58,138,0.025) 1px, transparent 1px),
              linear-gradient(90deg, rgba(30,58,138,0.025) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
        {/* Court-inspired center circle */}
        <svg
          style={{
            position: "absolute",
            top: "50%",
            left: isMobile ? "50%" : "55%",
            transform: "translate(-50%, -50%)",
            opacity: 0.04,
          }}
          width="600"
          height="600"
          viewBox="0 0 600 600"
          fill="none"
        >
          <circle cx="300" cy="300" r="280" stroke={player.accent} strokeWidth="1" />
          <circle cx="300" cy="300" r="200" stroke={player.accent} strokeWidth="0.7" />
          <circle cx="300" cy="300" r="120" stroke={player.accent} strokeWidth="0.5" />
          <circle cx="300" cy="300" r="40" stroke={player.accent} strokeWidth="0.5" />
          {/* Cross lines */}
          <line x1="300" y1="20" x2="300" y2="580" stroke={player.accent} strokeWidth="0.3" />
          <line x1="20" y1="300" x2="580" y2="300" stroke={player.accent} strokeWidth="0.3" />
        </svg>
        {/* Tactical arc lines */}
        <svg
          style={{
            position: "absolute",
            bottom: "8%",
            left: isMobile ? "10%" : "20%",
            opacity: 0.035,
          }}
          width="400"
          height="200"
          viewBox="0 0 400 200"
          fill="none"
        >
          <path d="M0 200 Q200 -40 400 200" stroke={player.accent} strokeWidth="0.8" fill="none" />
          <path d="M40 200 Q200 0 360 200" stroke={player.accent} strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* ===== L2: Dynamic glow orb (follows mouse) ===== */}
      <div
        data-layer-glow
        style={{
          position: "absolute",
          top: "30%",
          left: isMobile ? "40%" : "50%",
          width: isMobile ? 300 : 500,
          height: isMobile ? 300 : 500,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${player.accent}20 0%, ${player.accentLight}10 40%, transparent 70%)`,
          filter: "blur(40px)",
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 1.2s ease 0.2s",
        }}
      />

      {/* ===== L3: Ghost / motion shadow layer ===== */}
      <div
        data-layer-ghost
        style={{
          position: "absolute",
          top: isMobile ? "8%" : "2%",
          left: isMobile ? "5%" : "18%",
          width: isMobile ? "90%" : "64%",
          height: "96%",
          pointerEvents: "none",
          opacity: entered ? 0.12 : 0,
          transition: "opacity 1s ease 0.4s",
        }}
      >
        <img
          src={player.portraitImage}
          alt=""
          aria-hidden="true"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 10%",
            filter: `blur(8px) saturate(0.3) brightness(0.9)`,
          }}
        />
        {/* Team color wash over ghost */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(160deg, ${player.accent}44 0%, transparent 60%)`,
            mixBlendMode: "color",
          }}
        />
      </div>

      {/* ===== L4: Speed / motion ribbons ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 1s ease 0.6s",
        }}
      >
        <svg
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
          viewBox="0 0 1920 1080"
          preserveAspectRatio="none"
          fill="none"
        >
          {/* Sweeping motion lines */}
          <path
            d="M800 1080 Q1100 600 1400 0"
            stroke={`${player.accent}15`}
            strokeWidth="2"
          />
          <path
            d="M850 1080 Q1150 550 1500 0"
            stroke={`${player.accent}10`}
            strokeWidth="1.5"
          />
          <path
            d="M750 1080 Q1050 650 1300 0"
            stroke={`${player.accentLight}12`}
            strokeWidth="1"
          />
          {/* Horizontal velocity streaks */}
          <line
            x1="900" y1="380" x2="1400" y2="360"
            stroke={`${player.accent}08`}
            strokeWidth="1"
          >
            <animate attributeName="x2" values="1400;1500;1400" dur="4s" repeatCount="indefinite" />
          </line>
          <line
            x1="950" y1="480" x2="1350" y2="470"
            stroke={`${player.accent}06`}
            strokeWidth="0.8"
          >
            <animate attributeName="x2" values="1350;1450;1350" dur="5s" repeatCount="indefinite" />
          </line>
        </svg>
      </div>

      {/* ===== L5: Main player image ===== */}
      <div
        data-layer-main
        style={{
          position: "absolute",
          top: isMobile ? "5%" : "0%",
          left: isMobile ? "0%" : "15%",
          width: isMobile ? "100%" : "70%",
          height: isMobile ? "95%" : "100%",
          animation: entered
            ? isMobile
              ? "none"
              : "heroFloat 6s ease-in-out infinite"
            : "none",
          opacity: entered ? 1 : 0,
          filter: entered ? "none" : "blur(12px)",
          transition: "opacity 0.7s ease 0.2s, filter 0.8s ease 0.2s",
        }}
      >
        <img
          src={player.portraitImage}
          alt={player.name}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: isMobile ? "center 10%" : "center 10%",
          }}
        />
        {/* Bottom fade on player image */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "35%",
            background: "linear-gradient(to bottom, transparent, rgba(228,232,240,0.9))",
          }}
        />
        {/* Side fade for blending */}
        {!isMobile && (
          <>
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                bottom: 0,
                width: "15%",
                background: "linear-gradient(to right, rgba(240,242,247,0.8), transparent)",
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: "15%",
                background: "linear-gradient(to left, rgba(240,242,247,0.6), transparent)",
              }}
            />
          </>
        )}
      </div>

      {/* ===== L6: Team-color edge accents ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: entered ? 1 : 0,
          transition: "opacity 1s ease 0.5s",
        }}
      >
        {/* Left accent strip */}
        <div
          style={{
            position: "absolute",
            top: "20%",
            left: 0,
            width: 3,
            height: "30%",
            background: `linear-gradient(to bottom, transparent, ${player.accent}55, transparent)`,
            borderRadius: 2,
          }}
        />
        {/* Right accent strip */}
        <div
          style={{
            position: "absolute",
            top: "35%",
            right: 0,
            width: 2,
            height: "25%",
            background: `linear-gradient(to bottom, transparent, ${player.accentLight}44, transparent)`,
            borderRadius: 2,
          }}
        />
      </div>

      {/* ===== L7: Top vignette + bottom gradient ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            linear-gradient(180deg, rgba(240,242,247,0.3) 0%, transparent 15%, transparent 65%, rgba(240,242,247,0.85) 100%),
            radial-gradient(ellipse 100% 80% at 50% 50%, transparent 40%, rgba(240,242,247,0.4) 100%)
          `,
          zIndex: 1,
        }}
      />

      {/* ===== L8: Player number watermark ===== */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? "12%" : "8%",
          right: isMobile ? "5%" : "8%",
          fontSize: isMobile ? 140 : 220,
          fontWeight: 900,
          color: player.accent,
          opacity: entered ? 0.04 : 0,
          transition: "opacity 1.2s ease 0.7s",
          lineHeight: 1,
          letterSpacing: "-10px",
          userSelect: "none",
          pointerEvents: "none",
          zIndex: 2,
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {player.number}
      </div>

      {/* ===== Keyframe animations ===== */}
      <style>{`
        @keyframes heroFloat {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes heroBgDrift {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-15px, -10px) scale(1.03); }
        }
      `}</style>
    </div>
  );
}
