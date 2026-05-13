"use client";

// Horizontal date-card strip for authorized-league contest pages.
// Conceptually mirrors the NBA DFS "ContestSection" calendar strip:
//   • each card represents one slate date
//   • shows the date, bucket (past/today/upcoming), and #games
//   • clicking a card calls onSelect(entry); page handles loading
//
// Entry shape comes from /api/basketball-contests/nearby. Placeholder
// entries (id=null) are rendered the same way; the page lazily resolves
// them via /api/basketball-contests/by-date when clicked.

import { useLang } from "@/lib/lang";

export type DateStripEntry = {
  id: string | null;
  date: string;
  status: "scheduled" | "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  placeholder: boolean;
  scheduled_game_count: number;
};

export type DateBucket = "past" | "today" | "upcoming";

export function bucketFor(date: string, today: string): DateBucket {
  if (date === today) return "today";
  return date < today ? "past" : "upcoming";
}

function formatLocalDate(date: string, lang: "zh" | "en"): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
}

export default function DateStrip({
  entries,
  today,
  selectedDate,
  onSelect,
}: {
  entries: DateStripEntry[];
  today: string;
  selectedDate: string | null;
  onSelect: (entry: DateStripEntry) => void;
}) {
  const { t, lang } = useLang();
  if (entries.length === 0) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
        {t("近期没有可玩的比赛。", "No nearby playable dates.")}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        overflowX: "auto",
        padding: "10px 0",
        scrollbarWidth: "thin",
      }}
    >
      {entries.map((e) => {
        const bucket = bucketFor(e.date, today);
        const active = e.date === selectedDate;
        return (
          <button
            key={e.date}
            onClick={() => onSelect(e)}
            style={{
              minWidth: 110,
              padding: "10px 12px",
              borderRadius: 12,
              border: active ? "2px solid #1e3a8a" : "1px solid #e2e8f0",
              background: active ? "#eef2ff" : "#fff",
              cursor: "pointer",
              flexShrink: 0,
              textAlign: "left",
              fontFamily: "inherit",
              transition: "all 0.15s",
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color:
                  bucket === "today"
                    ? "#1e3a8a"
                    : bucket === "upcoming"
                      ? "#0f766e"
                      : "#94a3b8",
              }}
            >
              {bucket === "today"
                ? t("今日", "Today")
                : bucket === "upcoming"
                  ? t("即将", "Upcoming")
                  : t("已结束", "Past")}
            </div>
            <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
              {formatLocalDate(e.date, lang)}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>
              {e.scheduled_game_count > 0
                ? t(`${e.scheduled_game_count} 场`, `${e.scheduled_game_count} game${e.scheduled_game_count === 1 ? "" : "s"}`)
                : t("无比赛", "No games")}
              {e.placeholder && (
                <span style={{ marginLeft: 4, color: "#94a3b8" }}>
                  · {t("待开", "open later")}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
