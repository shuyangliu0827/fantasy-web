"use client";
// components/daily-fantasy/posters/LineupPoster.tsx
//
// Dark-navy "blueprint" lineup share poster.
// Rules:
//   - No <img> tags (avoids CORS in html-to-image)
//   - All styles are inline (required for toPng capture)
//   - Fixed 360px wide — parent scales preview; toPng at pixelRatio:3 → 1080px

import React from "react";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const POS_STYLE: Record<string, { bg: string; fg: string }> = {
  PG: { bg: "#1e3a8a", fg: "#93c5fd" },
  SG: { bg: "#4c1d95", fg: "#c4b5fd" },
  SF: { bg: "#064e3b", fg: "#6ee7b7" },
  PF: { bg: "#78350f", fg: "#fcd34d" },
  C:  { bg: "#7f1d1d", fg: "#fca5a5" },
};
const AVATAR_COLORS = ["#1d4ed8","#7c3aed","#047857","#b45309","#b91c1c","#0369a1","#0e7490","#7e22ce"];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0] + p[p.length - 1][0]).toUpperCase() : (name[0] ?? "?").toUpperCase();
}
function fmtDate(d: string, lang: string): string {
  const [y, m, day] = d.split("-").map(Number);
  if (lang === "zh") return `${y}.${String(m).padStart(2,"0")}.${String(day).padStart(2,"0")}`;
  return new Date(y, m - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type LineupPosterPlayer = {
  slotLabel: string;
  name: string;
  team: string;
  position: string;
  salary: number;
  projectedPoints?: number | null;
};

export type LineupPosterProps = {
  username: string;
  contestDate: string;
  players: LineupPosterPlayer[];
  lang: "zh" | "en";
};

const DIVIDER = (
  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)", margin: "0 20px" }} />
);
const SOFT_DIVIDER = (
  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent)", margin: "0 20px" }} />
);

const LineupPoster = React.forwardRef<HTMLDivElement, LineupPosterProps>(
  ({ username, contestDate, players, lang }, ref) => {
    const t = (zh: string, en: string) => lang === "zh" ? zh : en;

    return (
      <div
        ref={ref}
        style={{
          width: 360,
          fontFamily: FONT,
          backgroundColor: "#0a1628",
          backgroundImage: [
            "radial-gradient(ellipse at 50% 8%, rgba(30,64,175,0.55) 0%, transparent 58%)",
            "linear-gradient(rgba(59,130,246,0.065) 1px, transparent 1px)",
            "linear-gradient(90deg, rgba(59,130,246,0.065) 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "100% 100%, 28px 28px, 28px 28px",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* Blueprint corner brackets */}
        {[["top","left"],["top","right"],["bottom","left"],["bottom","right"]].map(([v, h]) => (
          <div key={`${v}${h}`} style={{
            position: "absolute",
            [v]: 14, [h]: 14,
            width: 14, height: 14,
            borderTop:    v === "top"    ? "2px solid rgba(59,130,246,0.45)" : undefined,
            borderBottom: v === "bottom" ? "2px solid rgba(59,130,246,0.45)" : undefined,
            borderLeft:   h === "left"   ? "2px solid rgba(59,130,246,0.45)" : undefined,
            borderRight:  h === "right"  ? "2px solid rgba(59,130,246,0.45)" : undefined,
          }} />
        ))}

        {/* ── Header ── */}
        <div style={{ padding: "26px 20px 14px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 9, color: "rgba(147,197,253,0.75)", fontWeight: 800, letterSpacing: 2.5, textTransform: "uppercase" }}>
              Blueprint Fantasy
            </div>
            <div style={{ fontSize: 17, color: "#fff", fontWeight: 900, marginTop: 3, letterSpacing: -0.4 }}>
              蓝本 · Daily Fantasy
            </div>
            <div style={{ fontSize: 9.5, color: "rgba(147,197,253,0.5)", marginTop: 3, letterSpacing: 0.3 }}>
              {t("每日幻想篮球", "Daily Fantasy Basketball")}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{t("比赛日", "Game Day")}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#60a5fa", letterSpacing: 0.3 }}>
              {fmtDate(contestDate, lang)}
            </div>
          </div>
        </div>

        {DIVIDER}

        {/* ── Title ── */}
        <div style={{ padding: "15px 20px 12px" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#fff", letterSpacing: -0.6, lineHeight: 1.1 }}>
            {t("我的今日阵容", "My Lineup")}
          </div>
          <div style={{ fontSize: 11, color: "rgba(147,197,253,0.65)", marginTop: 5, fontStyle: "italic", letterSpacing: 0.2 }}>
            {t("今晚，看看谁才是真正懂球的人", "Tonight — who really knows their basketball?")}
          </div>
        </div>

        {/* ── Player cards ── */}
        <div style={{ padding: "0 14px", display: "flex", flexDirection: "column", gap: 7 }}>
          {players.map((p, i) => {
            const pos = POS_STYLE[p.slotLabel] ?? { bg: "#1e3a8a", fg: "#93c5fd" };
            const av  = AVATAR_COLORS[hashStr(p.name) % AVATAR_COLORS.length];
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(59,130,246,0.13)",
                borderLeft: `3px solid ${pos.fg}`,
                borderRadius: 9, padding: "10px 12px",
              }}>
                {/* Slot */}
                <div style={{
                  width: 30, height: 30, borderRadius: 6, flexShrink: 0,
                  background: pos.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 900, color: pos.fg, letterSpacing: 0.5,
                }}>{p.slotLabel}</div>
                {/* Avatar initials */}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                  background: av,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: "#fff",
                  border: "1.5px solid rgba(255,255,255,0.12)",
                }}>{initials(p.name)}</div>
                {/* Name + team */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(148,163,184,0.75)", marginTop: 2 }}>
                    {p.team} · {p.position}
                  </div>
                </div>
                {/* Salary + projection */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#fcd34d" }}>
                    ${(p.salary / 1000).toFixed(1)}K
                  </div>
                  {p.projectedPoints != null && p.projectedPoints > 0 && (
                    <div style={{ fontSize: 9.5, color: "rgba(134,239,172,0.75)", marginTop: 2 }}>
                      {p.projectedPoints.toFixed(1)} {t("预测", "proj")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Divider ── */}
        <div style={{ margin: "16px 0 0" }}>{SOFT_DIVIDER}</div>

        {/* ── User + CTA ── */}
        <div style={{ padding: "14px 20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <div style={{
              width: 30, height: 30, borderRadius: "50%",
              background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 800, color: "#fff",
              border: "1.5px solid rgba(59,130,246,0.5)",
            }}>{initials(username)}</div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#e2e8f0" }}>{username}</span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(147,197,253,0.85)", lineHeight: 1.55, marginBottom: 10 }}>
            {t(
              "来 Blueprint Fantasy 挑战我的选人眼光 →",
              "Challenge my picks on Blueprint Fantasy →",
            )}
          </div>
          <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.35)", letterSpacing: 1.2, textTransform: "uppercase" }}>
            blueprint-fantasy.com
          </div>
        </div>
      </div>
    );
  },
);

LineupPoster.displayName = "LineupPoster";
export default LineupPoster;
