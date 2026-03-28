"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import type { HeroPlayer } from "@/lib/heroPlayers";

interface PlayerRevealVisualProps {
  player: HeroPlayer;
  isMobile: boolean;
  onImageError?: () => void;
}

export default function PlayerRevealVisual({
  player,
  isMobile,
  onImageError,
}: PlayerRevealVisualProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const revealPos = useRef({ x: 0.5, y: 0.5 });
  const smoothPos = useRef({ x: 0.5, y: 0.5 });
  const rafRef = useRef<number>(0);
  const [isHovering, setIsHovering] = useState(false);
  const [mobileReveal, setMobileReveal] = useState(0);
  const mobileRafRef = useRef<number>(0);
  const mobileDirection = useRef(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  // Smooth animation loop for desktop
  const animate = useCallback(() => {
    const lerp = 0.08;
    smoothPos.current.x += (revealPos.current.x - smoothPos.current.x) * lerp;
    smoothPos.current.y += (revealPos.current.y - smoothPos.current.y) * lerp;

    const el = containerRef.current?.querySelector(
      "[data-reveal-layer]"
    ) as HTMLElement | null;
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

  const handleImgError = useCallback(() => {
    setImgError(true);
    onImageError?.();
  }, [onImageError]);

  const mobileOpacity = isMobile ? 0.15 + mobileReveal * 0.35 : undefined;

  const imgStyle: React.CSSProperties = {
    position: "absolute",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center 15%",
  };

  if (imgError) return null;

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
        position: "absolute",
        inset: 0,
        cursor: isMobile ? "default" : "crosshair",
        overflow: "hidden",
      }}
    >
      {/* Base layer: portrait (clean, neutral background) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          overflow: "hidden",
          transform: isHovering ? "scale(1.03)" : "scale(1)",
          transition: "transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <img
          src={player.portraitImage}
          alt={player.name}
          onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          style={{
            ...imgStyle,
            opacity: imgLoaded ? 1 : 0,
            transition: "opacity 0.6s ease",
          }}
        />
      </div>

      {/* Subtle vignette on portrait */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 30%, rgba(15, 23, 42, 0.06) 100%)`,
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Reveal layer: team identity with color treatment */}
      <div
        data-reveal-layer
        style={{
          position: "absolute",
          inset: 0,
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
        {/* Team-colored background */}
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
        {/* Team color overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(160deg, ${player.accent}66 0%, ${player.accentLight}33 40%, transparent 70%)`,
            mixBlendMode: "multiply",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            boxShadow: `inset 0 0 120px ${player.accent}33`,
          }}
        />
      </div>

      {/* Bottom gradient for text readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, transparent 40%, rgba(15, 23, 42, 0.25) 100%)`,
          zIndex: 4,
          pointerEvents: "none",
        }}
      />

      {/* Inner glow on hover */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          boxShadow: isHovering
            ? `inset 0 0 100px rgba(37, 99, 235, 0.06)`
            : "inset 0 0 60px rgba(37, 99, 235, 0.02)",
          transition: "box-shadow 0.6s ease",
          zIndex: 5,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
