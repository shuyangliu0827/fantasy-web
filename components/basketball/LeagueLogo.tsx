"use client";

// Shared league-logo renderer. Shows the uploaded logo when present;
// otherwise falls back to a deterministic gradient tile with the
// league's first character. Keeps every surface that lists / shows a
// basketball league visually consistent.
//
// `size` is the rendered pixel size (square). Use ~40 in list rows,
// 56–64 in card heroes, and 96–112 in the league-detail hero.

import type { CSSProperties } from "react";

type Props = {
  name: string;
  logoUrl?: string | null;
  size?: number;
  rounded?: number;
  /** Visual treatment around the tile. "ring" adds a soft gold ring used by the hero. */
  emphasis?: "flat" | "ring";
  style?: CSSProperties;
};

const GRADIENTS = [
  "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
  "linear-gradient(135deg, #0f172a 0%, #475569 100%)",
  "linear-gradient(135deg, #7c2d12 0%, #f59e0b 100%)",
  "linear-gradient(135deg, #064e3b 0%, #10b981 100%)",
  "linear-gradient(135deg, #581c87 0%, #a855f7 100%)",
  "linear-gradient(135deg, #831843 0%, #ec4899 100%)",
];

function pickGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export default function LeagueLogo({
  name,
  logoUrl,
  size = 48,
  rounded,
  emphasis = "flat",
  style,
}: Props) {
  const radius = rounded ?? Math.round(size * 0.22);
  const ring =
    emphasis === "ring"
      ? {
          boxShadow:
            "0 12px 32px -8px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.06), 0 0 0 6px rgba(245, 158, 11, 0.08)",
        }
      : {
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        };

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: "cover",
          background: "#f8fafc",
          border: "1px solid rgba(15, 23, 42, 0.06)",
          flexShrink: 0,
          ...ring,
          ...style,
        }}
      />
    );
  }

  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: pickGradient(name || "league"),
        color: "#fff",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: Math.round(size * 0.42),
        fontWeight: 900,
        letterSpacing: "-0.02em",
        flexShrink: 0,
        ...ring,
        ...style,
      }}
    >
      {initial}
    </span>
  );
}
