"use client";

import { useRef, useState, useEffect, useCallback } from "react";

export type HeroPlayer = {
  id: string;
  name: string;
  nameZh: string;
  team: string;
  teamZh: string;
  number: string;
  position: string;
  portraitImage: string;
  jerseyImage: string;
  accent: string;
  accentLight: string;
};

interface PlayerRevealVisualProps {
  player: HeroPlayer;
  isMobile: boolean;
}

export default function PlayerRevealVisual({ player, isMobile }: PlayerRevealVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealPos = useRef({ x: 0.5, y: 0.5 });
  const smoothPos = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const [mobileReveal, setMobileReveal] = useState(0);
  const mobileRafRef = useRef<number>(0);
  const mobileDirection = useRef(1);
  const [imgLoaded, setImgLoaded] = useState(false);

  // Smooth animation loop for desktop
  const animate = useCallback(() => {
    const lerp = 0.08;
    smoothPos.current.x += (revealPos.current.x - smoothPos.current.x) * lerp;
    smoothPos.current.y += (revealPos.current.y - smoothPos.current.y) * lerp;

    const el = containerRef.current?.querySelector("[data-reveal-layer]") as HTMLElement | null;
    if (el) {
      const px = smoothPos.current.x * 100;
      const py = smoothPos.current.y * 100;
      const size = isHovering ? 38 : 0;
      el.style.maskImage = `radial-gradient(circle ${size}% at ${px}% ${py}%, black 0%, black 60%, transparent 100%)`;
      el.style.webkitMaskImage = el.style.maskImage;
    }

    rafRef.current = requestAnimationFrame(animate);
  }, [isHovering]);

  useEffect(() => {
    if (isMobile) return;
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animate, isMobile]);

  // Mobile shimmer animation
  useEffect(() => {
    if (!isMobile) return;

    const animateMobile = () => {
      setMobileReveal((prev) => {
        let next = prev + mobileDirection.current * 0.003;
        if (next >= 1) {
          next = 1;
          mobileDirection.current = -1;
        } else if (next <= 0) {
          next = 0;
          mobileDirection.current = 1;
        }
        return next;
      });
      mobileRafRef.current = requestAnimationFrame(animateMobile);
    };
    mobileRafRef.current = requestAnimationFrame(animateMobile);
    return () => cancelAnimationFrame(mobileRafRef.current);
  }, [isMobile]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isMobile) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      revealPos.current.x = (e.clientX - rect.left) / rect.width;
      revealPos.current.y = (e.clientY - rect.top) / rect.height;
    },
    [isMobile]
  );

  const mobileOpacity = isMobile ? 0.15 + mobileReveal * 0.35 : undefined;

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    borderRadius: 28,
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => !isMobile && setIsHovering(true)}
      onMouseLeave={() => {
        if (isMobile) return;
        setIsHovering(false);
        revealPos.current = { x: 0.5, y: 0.5 };
      }}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        cursor: isMobile ? "default" : "crosshair",
        overflow: "hidden",
        borderRadius: 28,
        background: `linear-gradient(145deg, #e8ecf4 0%, #f0f2f7 50%, #e4e8f0 100%)`,
      }}
    >
      {/* Premium frame border */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          border: `1.5px solid rgba(30, 58, 138, 0.12)`,
          zIndex: 10,
          pointerEvents: "none",
        }}
      />

      {/* Inner glow on hover */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          boxShadow: isHovering
            ? `inset 0 0 60px rgba(37, 99, 235, 0.08)`
            : "inset 0 0 40px rgba(37, 99, 235, 0.03)",
          transition: "box-shadow 0.6s ease",
          zIndex: 9,
          pointerEvents: "none",
        }}
      />

      {/* Base layer: portrait (clean, neutral) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          overflow: "hidden",
          transform: isHovering ? "scale(1.03)" : "scale(1)",
          transition: "transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        {/* Neutral light background for portrait */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, #f5f7fb 0%, #e8ecf4 60%, #dde2ed 100%)`,
          }}
        />
        <img
          src={player.portraitImage}
          alt={player.name}
          onLoad={() => setImgLoaded(true)}
          style={{
            ...imgStyle,
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.5s ease",
          }}
        />
      </div>

      {/* Subtle gradient overlay on portrait */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background: `linear-gradient(180deg, transparent 40%, rgba(15, 23, 42, 0.08) 100%)`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Reveal layer: jersey/team identity image with team color treatment */}
      <div
        data-reveal-layer
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          overflow: "hidden",
          zIndex: 3,
          maskImage: isMobile
            ? undefined
            : "radial-gradient(circle 0% at 50% 50%, black 0%, black 60%, transparent 100%)",
          WebkitMaskImage: isMobile
            ? undefined
            : "radial-gradient(circle 0% at 50% 50%, black 0%, black 60%, transparent 100%)",
          opacity: isMobile ? mobileOpacity : 1,
          transition: isMobile ? "opacity 0.05s linear" : undefined,
          transform: isHovering ? "scale(1.02)" : "scale(1)",
        }}
      >
        {/* Team-colored background behind jersey image */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(160deg, ${player.accent} 0%, ${player.accentLight} 50%, ${player.accent} 100%)`,
          }}
        />
        <img
          src={player.jerseyImage}
          alt={`${player.name} jersey`}
          style={{
            ...imgStyle,
            opacity: imgLoaded ? 1 : 0,
            filter: "contrast(1.08) brightness(1.05)",
          }}
        />
        {/* Team color overlay for visual distinction */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            background: `linear-gradient(160deg, ${player.accent}55 0%, ${player.accentLight}33 40%, transparent 70%)`,
            mixBlendMode: "multiply",
          }}
        />
        {/* Edge glow on reveal layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 28,
            boxShadow: `inset 0 0 80px ${player.accent}22`,
          }}
        />
      </div>

      {/* Bottom gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background: `linear-gradient(180deg, transparent 55%, rgba(15, 23, 42, 0.15) 100%)`,
          zIndex: 4,
          pointerEvents: "none",
        }}
      />

      {/* Player info chip - bottom left */}
      <div
        style={{
          position: "absolute",
          bottom: isMobile ? 16 : 24,
          left: isMobile ? 16 : 24,
          zIndex: 8,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(255, 255, 255, 0.88)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderRadius: 14,
          padding: isMobile ? "10px 14px" : "12px 18px",
          boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: player.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 800,
            color: "#fff",
          }}
        >
          {player.number}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", lineHeight: 1.2 }}>
            {player.name}
          </div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500, marginTop: 1 }}>
            {player.team} · {player.position}
          </div>
        </div>
      </div>

      {/* Hover hint - top right */}
      {!isMobile && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 8,
            background: "rgba(255,255,255,0.75)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: 10,
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 600,
            color: "#64748b",
            opacity: isHovering ? 0 : 0.8,
            transition: "opacity 0.4s ease",
            pointerEvents: "none",
          }}
        >
          移动鼠标探索
        </div>
      )}

      {/* Decorative corner accents */}
      <svg
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 8,
          opacity: 0.25,
          pointerEvents: "none",
        }}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M0 8V0H8" stroke={player.accent} strokeWidth="1.5" />
      </svg>
      <svg
        style={{
          position: "absolute",
          bottom: 12,
          right: 12,
          zIndex: 8,
          opacity: 0.25,
          pointerEvents: "none",
          transform: "rotate(180deg)",
        }}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
      >
        <path d="M0 8V0H8" stroke={player.accent} strokeWidth="1.5" />
      </svg>
    </div>
  );
}
