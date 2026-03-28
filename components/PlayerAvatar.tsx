"use client";

import { useState } from "react";
import { getPlayerHeadshotUrl } from "@/lib/player-headshots";

// Deterministic color palette for fallback initials
const COLORS = [
  "#1e3a8a", "#7c3aed", "#059669", "#d97706",
  "#dc2626", "#0891b2", "#4f46e5", "#be185d",
  "#15803d", "#b45309",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return (name[0] || "?").toUpperCase();
}

type PlayerAvatarProps = {
  name: string;
  size?: number;
  style?: React.CSSProperties;
};

export default function PlayerAvatar({ name, size = 28, style }: PlayerAvatarProps) {
  const url = getPlayerHeadshotUrl(name);
  const [imgError, setImgError] = useState(false);

  const containerStyle: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: "50%",
    flexShrink: 0,
    overflow: "hidden",
    ...style,
  };

  if (url && !imgError) {
    return (
      <div style={{ ...containerStyle, background: "#f1f5f9" }}>
        <img
          src={url}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setImgError(true)}
          style={{ width: size, height: size, objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  // Fallback: initials on deterministic colored background
  const color = COLORS[hashName(name) % COLORS.length];
  const fontSize = Math.max(10, Math.round(size * 0.35));

  return (
    <div
      style={{
        ...containerStyle,
        background: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize,
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {getInitials(name)}
    </div>
  );
}
