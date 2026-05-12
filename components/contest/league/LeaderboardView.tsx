"use client";

// Standalone leaderboard view for an authorized basketball league contest.
// Reusable across /contest/[leagueSlug]/leaderboard and any embedded view.

import { useLang } from "@/lib/lang";
import type { LeaderEntry } from "./types";

export default function LeaderboardView({ entries }: { entries: LeaderEntry[] }) {
  const { t } = useLang();
  if (entries.length === 0) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 14 }}>
        {t("尚无提交。", "No submissions yet.")}
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
      }}
    >
      {entries.map((e, i) => (
        <div
          key={e.id}
          style={{
            padding: "10px 16px",
            display: "flex",
            justifyContent: "space-between",
            borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            fontSize: 13,
          }}
        >
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span
              style={{
                width: 24,
                textAlign: "center",
                fontWeight: 900,
                color: e.rank === 1 ? "#f59e0b" : "#475569",
              }}
            >
              {e.rank ?? "—"}
            </span>
            <code
              style={{
                fontSize: 12,
                color: "#64748b",
                maxWidth: 220,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={e.user_id}
            >
              {e.user_id.slice(0, 8)}…
            </code>
            <span
              style={{
                padding: "2px 8px",
                background: e.status === "scored" ? "#e0e7ff" : "#fef3c7",
                color: e.status === "scored" ? "#3730a3" : "#92400e",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {e.status}
            </span>
          </div>
          <div style={{ fontWeight: 900, color: "#1e3a8a" }}>
            {e.total_fpts != null ? e.total_fpts.toFixed(1) : "—"}
          </div>
        </div>
      ))}
    </div>
  );
}
