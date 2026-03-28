"use client";
// components/compare/RadarChart.tsx
// SVG radar chart — secondary visual in the compare page.
// Extracted and cleaned up from original page.tsx.

import { useLang } from "@/lib/lang";

interface RadarPlayer {
  id: string;
  name: string;
  color: string;
  stats: Record<string, number>;
}

interface RadarChartProps {
  players: RadarPlayer[];
  axes: string[];
  maxValues: Record<string, number>;
  axisLabels: Record<string, { zh: string; en: string }>;
  highlightedAxes?: string[];
  size?: number;
}

export default function RadarChart({
  players,
  axes,
  maxValues,
  axisLabels,
  highlightedAxes = [],
  size = 320,
}: RadarChartProps) {
  const { t } = useLang();
  const center = size / 2;
  const radius = size * 0.40;
  const levels = 5;
  const angleStep = (2 * Math.PI) / axes.length;

  const getPoint = (value: number, maxValue: number, index: number, statKey: string) => {
    let norm = statKey === "tov" ? 1 - (value / maxValue) : value / maxValue;
    norm = Math.min(Math.max(norm, 0), 1);
    const angle = index * angleStep - Math.PI / 2;
    const r = norm * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  };

  // Grid
  const gridLines = [];
  for (let level = 1; level <= levels; level++) {
    const r = (radius / levels) * level;
    const points = axes.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    gridLines.push(<polygon key={level} points={points} fill="none" stroke="#e5e7eb" strokeWidth="1" opacity={0.7} />);
  }

  // Axes
  const axisLines = axes.map((stat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const highlighted = highlightedAxes.includes(stat);
    return (
      <line key={i}
        x1={center} y1={center}
        x2={center + radius * Math.cos(angle)} y2={center + radius * Math.sin(angle)}
        stroke={highlighted ? "#1e3a8a" : "#d1d5db"}
        strokeWidth={highlighted ? 2 : 1}
        opacity={highlighted ? 0.8 : 0.5}
      />
    );
  });

  // Labels
  const labels = axes.map((stat, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const lr = radius + 26;
    const highlighted = highlightedAxes.includes(stat);
    const lbl = axisLabels[stat];
    return (
      <text key={stat}
        x={center + lr * Math.cos(angle)} y={center + lr * Math.sin(angle)}
        textAnchor="middle" dominantBaseline="middle"
        fill={highlighted ? "#1e3a8a" : "#6b7280"}
        fontSize="11" fontWeight={highlighted ? 700 : 500}
      >
        {t(lbl?.zh || stat, lbl?.en || stat)}
      </text>
    );
  });

  // Player polygons
  const polygons = players.map((player) => {
    const points = axes.map((stat, i) => {
      const value = player.stats[stat] ?? 0;
      const pt = getPoint(value, maxValues[stat] ?? 1, i, stat);
      return `${pt.x},${pt.y}`;
    }).join(" ");
    return (
      <g key={player.id}>
        <polygon points={points} fill={player.color} fillOpacity={0.15} stroke={player.color} strokeWidth="2.5" />
        {axes.map((stat, i) => {
          const value = player.stats[stat] ?? 0;
          const pt = getPoint(value, maxValues[stat] ?? 1, i, stat);
          return <circle key={`${player.id}-${stat}`} cx={pt.x} cy={pt.y} r="4.5" fill={player.color} />;
        })}
      </g>
    );
  });

  return (
    <svg width="100%" height="auto" viewBox={`0 0 ${size} ${size}`} style={{ maxWidth: size, display: "block" }}>
      {gridLines}
      {axisLines}
      {polygons}
      {labels}
    </svg>
  );
}
