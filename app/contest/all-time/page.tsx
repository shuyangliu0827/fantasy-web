"use client";
// app/contest/all-time/page.tsx
//
// All-time Daily Fantasy points leaderboard.
// Aggregates historical total_points per user from points_transactions
// (server-side, bypasses RLS), with fallback to user_lineups.points_awarded.
//
// URL: /contest/all-time

import { useEffect, useState } from "react";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/shared/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type AllTimeEntry = {
  overall_rank:       number;
  user_id:            string;
  username:           string;
  total_points:       number;
  participation_days: number;
  best_daily_rank:    number | null;
  contests_played:    number;
};

export default function AllTimePage() {
  const { t }     = useLang();
  const [user]    = useState(() => getSessionUser());
  const [entries, setEntries] = useState<AllTimeEntry[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/contests/all-time-leaderboard");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setEntries(json.entries ?? []);
    setLoading(false);
  }

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav />

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {t("总积分榜", "All-Time Leaderboard")}
          </h2>
          {entries.length > 0 && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {entries.length} {t("人", "players")}
            </span>
          )}
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {t("历史累计 Daily Fantasy 积分排名", "All-time accumulated Daily Fantasy points")}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "20px 0" }}>{error}</div>
        )}

        {!loading && !error && entries.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            border: "1px solid #e5e7eb", textAlign: "center",
            color: "#6b7280", fontSize: 14,
          }}>
            {t("暂无数据。参与 Daily Fantasy 并等待比赛结算后积分将出现在这里。",
               "No data yet. Submit a lineup and points will appear here after settlement.")}
          </div>
        )}

        {!loading && !error && entries.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 70px",
              padding: "8px 16px", borderBottom: "1px solid #f3f4f6",
              fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            }}>
              <span>{t("名次", "Rank")}</span>
              <span>{t("用户", "User")}</span>
              <span style={{ textAlign: "right" }}>{t("总积分", "Total")}</span>
              <span style={{ textAlign: "right" }}>{t("参赛天", "Days")}</span>
              <span style={{ textAlign: "right" }}>{t("最佳名次", "Best")}</span>
            </div>

            {entries.map((entry, i) => {
              const isMe = user && entry.user_id === user.id;
              const rank = entry.overall_rank;
              return (
                <div
                  key={entry.user_id}
                  style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 70px",
                    alignItems: "center", padding: "10px 16px",
                    borderBottom: i < entries.length - 1 ? "1px solid #f9fafb" : "none",
                    background: isMe ? "#eff6ff" : "transparent",
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: rank === 1 ? "#d97706" : rank <= 3 ? "#6b7280" : "#9ca3af",
                  }}>
                    {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`}
                  </span>

                  {/* User */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <PlayerAvatar name={entry.username} size={24} />
                    <span style={{
                      fontSize: 13, fontWeight: isMe ? 700 : 500, color: "#111827",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {entry.username}
                      {isMe && (
                        <span style={{ color: "#2563eb", fontSize: 11, marginLeft: 4 }}>
                          ({t("我", "me")})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Total points */}
                  <span style={{
                    fontSize: 14, fontWeight: 800, textAlign: "right",
                    color: entry.total_points > 0 ? "#059669" : "#9ca3af",
                  }}>
                    {entry.total_points.toLocaleString()}
                  </span>

                  {/* Participation days */}
                  <span style={{ fontSize: 13, color: "#374151", textAlign: "right" }}>
                    {entry.participation_days}
                  </span>

                  {/* Best daily rank */}
                  <span style={{
                    fontSize: 13, fontWeight: 600, textAlign: "right",
                    color: entry.best_daily_rank === 1 ? "#d97706" : "#374151",
                  }}>
                    {entry.best_daily_rank != null ? `#${entry.best_daily_rank}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Points rules reference */}
        <div style={{
          marginTop: 20, padding: "14px 16px",
          background: "#fff", borderRadius: 10, border: "1px solid #e5e7eb",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            {t("每日积分规则", "Daily Points Rules")}
          </div>
          {[
            [t("第 1 名",     "1st place"),    "500"],
            [t("第 2–3 名",   "2nd–3rd"),      "400"],
            [t("第 4–10 名",  "4th–10th"),     "300"],
            [t("前 10%",      "Top 10%"),       "200"],
            [t("前 25%",      "Top 25%"),       "100"],
            [t("参与完赛",    "Participation"), "20"],
          ].map(([label, pts]) => (
            <div key={label as string} style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 12, color: "#6b7280", marginBottom: 4,
            }}>
              <span>{label}</span>
              <span style={{ fontWeight: 700, color: "#059669" }}>+{pts} pts</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
