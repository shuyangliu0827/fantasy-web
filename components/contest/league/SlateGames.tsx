"use client";

// Compact summary of the games powering a contest slate.
//   "Team A @ Team B — 8:00 PM"
// Driven by GET /api/basketball-contests/[id]/games.

import { useLang } from "@/lib/lang";

export type SlateGame = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_team: { id: string; name: string; abbreviation: string | null } | null;
  away_team: { id: string; name: string; abbreviation: string | null } | null;
  home_score: number | null;
  away_score: number | null;
};

export default function SlateGames({
  games,
  timezone,
}: {
  games: SlateGame[];
  timezone: string;
}) {
  const { t, lang } = useLang();
  if (games.length === 0) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
        {t("没有可用比赛。", "No games for this slate.")}
      </div>
    );
  }
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid #f1f5f9",
          fontSize: 11,
          fontWeight: 900,
          color: "#94a3b8",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {t("今日比赛", "Today's slate")}
      </div>
      {games.map((g, i) => {
        const time = g.scheduled_at
          ? new Date(g.scheduled_at).toLocaleTimeString(
              lang === "zh" ? "zh-CN" : "en-US",
              { hour: "numeric", minute: "2-digit", timeZone: timezone },
            )
          : t("时间待定", "TBD");
        const final =
          g.status === "final" && g.home_score != null && g.away_score != null;
        return (
          <div
            key={g.id}
            style={{
              padding: "10px 14px",
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
              fontSize: 13,
              color: "#0f172a",
            }}
          >
            <span style={{ fontWeight: 700 }}>
              {g.away_team?.name ?? "—"} @ {g.home_team?.name ?? "—"}
            </span>
            <span style={{ color: "#64748b", fontSize: 12 }}>
              {final
                ? `${g.away_score} – ${g.home_score} · ${t("已结束", "Final")}`
                : time}
            </span>
          </div>
        );
      })}
    </div>
  );
}
