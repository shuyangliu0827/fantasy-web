"use client";
// components/daily-fantasy/posters/ResultPoster.tsx
//
// Dark-navy "blueprint" result/leaderboard share poster.
// Rules:
//   - No <img> tags (avoids CORS in html-to-image)
//   - All styles are inline (required for toPng capture)
//   - Fixed 360px wide — parent scales preview; toPng at pixelRatio:3 → 1080px

import React from "react";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const AVATAR_COLORS = ["#1d4ed8","#7c3aed","#047857","#b45309","#b91c1c","#0369a1","#0e7490","#7e22ce"];
const POS_COLORS: Record<string, string> = {
  PG: "#93c5fd", SG: "#c4b5fd", SF: "#6ee7b7", PF: "#fcd34d", C: "#fca5a5",
  G: "#93c5fd", F: "#6ee7b7", UTIL: "#e2e8f0",
};

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
function rankSuffix(rank: number): string {
  if (rank === 1) return "st";
  if (rank === 2) return "nd";
  if (rank === 3) return "rd";
  return "th";
}

export type ResultPosterPlayer = {
  slotLabel: string;
  name: string;
  team: string;
  position: string;
  actualPoints?: number | null;
};

export type ResultPosterProps = {
  posterType: "result" | "leaderboard";
  username: string;
  date: string;
  totalFpts: number;
  rank: number;
  totalEntries: number;
  pointsAwarded?: number | null;
  players?: ResultPosterPlayer[];
  leaderboardType?: string;
  lang: "zh" | "en";
};

const DIVIDER = (
  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #3b82f6, #60a5fa, #3b82f6, transparent)", margin: "0 20px" }} />
);
const SOFT_DIVIDER = (
  <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent)", margin: "0 20px" }} />
);

const ResultPoster = React.forwardRef<HTMLDivElement, ResultPosterProps>(
  ({ posterType, username, date, totalFpts, rank, totalEntries, pointsAwarded, players = [], lang }, ref) => {
    const t = (zh: string, en: string) => lang === "zh" ? zh : en;

    const beatPct = totalEntries > 1
      ? Math.round(((totalEntries - rank) / (totalEntries - 1)) * 100)
      : 100;

    const rankColor = rank === 1 ? "#fcd34d" : rank === 2 ? "#e2e8f0" : rank === 3 ? "#fb923c" : "#60a5fa";
    const rankGlow  = rank === 1 ? "0 0 20px rgba(252,211,77,0.45)" : rank <= 3 ? "0 0 16px rgba(96,165,250,0.35)" : "none";

    // Sort players by actualPoints desc, take top for MVP
    const sorted = [...players].sort((a, b) => (b.actualPoints ?? 0) - (a.actualPoints ?? 0));
    const mvp    = sorted[0];
    const rest   = sorted.slice(1, 6);

    const medalEmoji = (r: number) => r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : null;

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
        {(["top","bottom"] as const).flatMap(v =>
          (["left","right"] as const).map(h => (
            <div key={`${v}${h}`} style={{
              position: "absolute",
              [v]: 14, [h]: 14,
              width: 14, height: 14,
              borderTop:    v === "top"    ? "2px solid rgba(59,130,246,0.45)" : undefined,
              borderBottom: v === "bottom" ? "2px solid rgba(59,130,246,0.45)" : undefined,
              borderLeft:   h === "left"   ? "2px solid rgba(59,130,246,0.45)" : undefined,
              borderRight:  h === "right"  ? "2px solid rgba(59,130,246,0.45)" : undefined,
            }} />
          ))
        )}

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
              {t(
                posterType === "result" ? "赛事结果" : "排行榜",
                posterType === "result" ? "Contest Result" : "Leaderboard",
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 3 }}>{t("比赛日", "Game Day")}</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#60a5fa", letterSpacing: 0.3 }}>
              {fmtDate(date, lang)}
            </div>
          </div>
        </div>

        {DIVIDER}

        {/* ── Hero stat ── */}
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Rank badge */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0,
            background: "rgba(30,58,138,0.45)",
            border: `1.5px solid ${rankColor}`,
            borderRadius: 12, padding: "12px 14px",
            boxShadow: rankGlow,
            minWidth: 72,
          }}>
            {medalEmoji(rank) && (
              <div style={{ fontSize: 20, marginBottom: 2 }}>{medalEmoji(rank)}</div>
            )}
            <div style={{ fontSize: 26, fontWeight: 900, color: rankColor, lineHeight: 1, letterSpacing: -1 }}>
              {rank}
            </div>
            <div style={{ fontSize: 10, color: rankColor, opacity: 0.8, fontWeight: 700, letterSpacing: 0.3 }}>
              {rankSuffix(rank)}
            </div>
            <div style={{ fontSize: 8, color: "rgba(148,163,184,0.6)", marginTop: 4 }}>
              / {totalEntries}
            </div>
          </div>

          {/* Fpts + beat % */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: "rgba(147,197,253,0.65)", fontWeight: 600, letterSpacing: 0.3, marginBottom: 4 }}>
              {t("总幻想分", "Total Fantasy Pts")}
            </div>
            <div style={{ fontSize: 42, fontWeight: 900, color: "#f1f5f9", lineHeight: 1, letterSpacing: -2 }}>
              {totalFpts.toFixed(1)}
            </div>
            <div style={{ fontSize: 10, color: "rgba(134,239,172,0.8)", marginTop: 6, fontWeight: 600 }}>
              {t(`超过了 ${beatPct}% 的参与者`, `Beat ${beatPct}% of entries`)}
            </div>
            {pointsAwarded != null && pointsAwarded > 0 && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                marginTop: 8, padding: "3px 10px",
                background: "rgba(252,211,77,0.15)", border: "1px solid rgba(252,211,77,0.4)",
                borderRadius: 20, fontSize: 10, fontWeight: 700, color: "#fcd34d",
              }}>
                +{pointsAwarded} {t("积分", "pts")}
              </div>
            )}
          </div>
        </div>

        {/* ── MVP card ── */}
        {mvp && (
          <div style={{ margin: "18px 14px 0" }}>
            <div style={{ fontSize: 9, color: "rgba(147,197,253,0.55)", fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, paddingLeft: 4 }}>
              {t("最佳球员", "MVP")}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "linear-gradient(135deg, rgba(30,58,138,0.5), rgba(124,58,237,0.25))",
              border: "1px solid rgba(96,165,250,0.3)",
              borderRadius: 10, padding: "12px 14px",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: AVATAR_COLORS[hashStr(mvp.name) % AVATAR_COLORS.length],
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 800, color: "#fff",
                border: "2px solid rgba(252,211,77,0.5)",
              }}>{initials(mvp.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#f1f5f9", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {mvp.name}
                </div>
                <div style={{ fontSize: 9.5, color: "rgba(148,163,184,0.7)", marginTop: 2 }}>
                  {mvp.team} · <span style={{ color: POS_COLORS[mvp.slotLabel] ?? "#93c5fd" }}>{mvp.slotLabel}</span>
                </div>
              </div>
              {mvp.actualPoints != null && (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: "#fcd34d", lineHeight: 1, letterSpacing: -0.5 }}>
                    {mvp.actualPoints.toFixed(1)}
                  </div>
                  <div style={{ fontSize: 8.5, color: "rgba(148,163,184,0.55)", marginTop: 1 }}>
                    {t("幻想分", "fpts")}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Rest of lineup ── */}
        {rest.length > 0 && (
          <div style={{ margin: "12px 14px 0", display: "flex", flexDirection: "column", gap: 5 }}>
            {rest.map((p, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(59,130,246,0.1)",
                borderRadius: 7, padding: "7px 10px",
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                  background: AVATAR_COLORS[hashStr(p.name) % AVATAR_COLORS.length],
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 800, color: "#fff",
                }}>{initials(p.name)}</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#e2e8f0", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: 9, color: POS_COLORS[p.slotLabel] ?? "#93c5fd", fontWeight: 700, flexShrink: 0 }}>
                  {p.slotLabel}
                </div>
                {p.actualPoints != null && (
                  <div style={{ fontSize: 11, fontWeight: 800, color: "#f1f5f9", flexShrink: 0, minWidth: 32, textAlign: "right" }}>
                    {p.actualPoints.toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

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

ResultPoster.displayName = "ResultPoster";
export default ResultPoster;
