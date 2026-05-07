"use client";
// components/LineupShareCard.tsx
//
// Off-screen card rendered solely for html-to-image snapshot.
// Rules:
//   - No <img> tags (avoids CORS from NBA CDN headshots)
//   - No interactive elements (no buttons, no inputs)
//   - All styles are inline (required for html-to-image to capture them)
//   - Fixed 360 px width so the snapshot is always consistent
//
// The parent mounts this element in a fixed off-screen div and captures
// it via toPng(ref).

import React from "react";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const TIER_COLOR: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(245,158,11,0.12)", color: "#d97706", border: "rgba(245,158,11,0.3)" },
  2: { bg: "rgba(59,130,246,0.10)", color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  3: { bg: "rgba(16,185,129,0.10)", color: "#059669", border: "rgba(16,185,129,0.25)" },
  4: { bg: "rgba(100,116,139,0.10)", color: "#64748b", border: "rgba(100,116,139,0.2)" },
};

const AVATAR_COLORS = [
  "#1e3a8a", "#7c3aed", "#059669", "#d97706",
  "#dc2626", "#0891b2", "#4f46e5", "#be185d",
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : (name[0] || "?").toUpperCase();
}
function fmtMoney(n: number): string {
  return `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}
function formatContestDate(dateStr: string, lang: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (lang === "zh") {
    return new Date(y, m - 1, d).toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
  }
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type SharePlayer = {
  slotLabel: string;
  name: string;
  team: string;
  position: string;
  tier: 1 | 2 | 3 | 4;
  salary: number;
};

interface Props {
  contestDate: string;
  players: (SharePlayer | null)[];
  totalSalary: number;
  remaining: number;
  lang: string;
}

const LineupShareCard = React.forwardRef<HTMLDivElement, Props>(
  ({ contestDate, players, totalSalary, remaining, lang }, ref) => {
    const t = (zh: string, en: string) => lang === "zh" ? zh : en;

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          background: "#ffffff",
          borderRadius: 16,
          overflow: "hidden",
          fontFamily: FONT,
          boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
        }}
      >
        {/* ── Header ── */}
        <div style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
              Blueprint Fantasy
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#ffffff", marginTop: 2 }}>
              {t("我的阵容", "My Lineup")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontWeight: 500 }}>
              {t("比赛日", "Contest")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#ffffff", marginTop: 2 }}>
              {formatContestDate(contestDate, lang)}
            </div>
          </div>
        </div>

        {/* ── Player rows ── */}
        <div style={{ padding: "0 4px" }}>
          {players.map((p, i) => {
            if (!p) return null;
            const tc = TIER_COLOR[p.tier];
            const avatarColor = AVATAR_COLORS[hashName(p.name) % AVATAR_COLORS.length];
            const initials = getInitials(p.name);
            const isLast = i === players.filter(Boolean).length - 1;

            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "11px 16px",
                  borderBottom: isLast ? "none" : "1px solid #f3f4f6",
                  background: "#fafafa",
                }}
              >
                {/* Slot badge */}
                <div style={{
                  width: 30, height: 22, borderRadius: 4,
                  background: "#1e3a8a", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {p.slotLabel}
                </div>

                {/* Initials avatar */}
                <div style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: avatarColor,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontSize: 11, fontWeight: 700,
                }}>
                  {initials}
                </div>

                {/* Name + team */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: "#111827",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                    {p.team} · {p.position}
                  </div>
                </div>

                {/* Tier badge */}
                <div style={{
                  padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                  background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                  flexShrink: 0,
                }}>
                  T{p.tier}
                </div>

                {/* Salary */}
                <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", flexShrink: 0 }}>
                  {fmtMoney(p.salary)}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Salary footer ── */}
        <div style={{
          padding: "12px 20px",
          background: "#f8fafc",
          borderTop: "1px solid #e5e7eb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ fontSize: 12, color: "#374151" }}>
            <span style={{ color: "#6b7280" }}>{t("总工资", "Total Salary")} </span>
            <span style={{ fontWeight: 700 }}>{fmtMoney(totalSalary)}</span>
            <span style={{ color: "#9ca3af", margin: "0 4px" }}>/</span>
            <span style={{ color: "#6b7280" }}>$50,000</span>
          </div>
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: remaining < 0 ? "#dc2626" : "#059669",
          }}>
            {t("剩余", "Remaining")} {fmtMoney(remaining)}
          </div>
        </div>

        {/* ── Branding footer ── */}
        <div style={{
          padding: "8px 20px",
          background: "#1e3a8a",
          textAlign: "center",
        }}>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.6)", letterSpacing: 0.5 }}>
            blueprint-fantasy.com · Daily Fantasy
          </span>
        </div>
      </div>
    );
  }
);

LineupShareCard.displayName = "LineupShareCard";
export default LineupShareCard;
