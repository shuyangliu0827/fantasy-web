"use client";
// app/contest/weekly/page.tsx
//
// Weekly points leaderboard — aggregates points_awarded across all scored
// contests in the current Mon–Sun UTC calendar week.
//
// URL: /contest/weekly
// Data source: GET /api/contests/weekly-leaderboard
// (server aggregates from user_lineups, never a stale cache field)

import { useEffect, useState } from "react";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/shared/store";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/fantasy/daily/points";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type WeekEntry = {
  weekly_rank: number; user_id: string; username: string;
  weekly_points: number; participation_days: number; best_daily_rank: number | null;
};

type WeeklyData = {
  week_start: string; week_end: string;
  settled_contests: number; total_contests: number;
  entries: WeekEntry[];
};

function fmtDate(iso: string, lang: string) {
  // Parse YYYY-MM-DD as local date — avoids UTC midnight→local-tz shift (Apr 30 UTC → Apr 29 ET).
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
    month: "short", day: "numeric",
  });
}

export default function WeeklyPage() {
  const { t, lang } = useLang();
  const [user]    = useState(() => getSessionUser());
  const [data,    setData]    = useState<WeeklyData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/contests/weekly-leaderboard");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    setData(await res.json());
    setLoading(false);
  }

  const weekRange = data
    ? `${fmtDate(data.week_start, lang)} – ${fmtDate(data.week_end, lang)}`
    : (() => {
        const now = new Date();
        return `${fmtDate(toDateStr(getWeekStart(now)), lang)} – ${fmtDate(toDateStr(getWeekEnd(now)), lang)}`;
      })();

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav scope={{ kind: "nba" }} />

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {t("周积分排行榜", "Weekly Leaderboard")}
          </h2>
          {data && data.entries.length > 0 && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {data.entries.length} {t("人", "players")}
            </span>
          )}
        </div>

        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
          {weekRange}
          {data && (
            <span style={{ marginLeft: 8 }}>
              · {data.settled_contests}/{data.total_contests} {t("场已结算", "contests settled")}
              {data.settled_contests < data.total_contests && (
                <span style={{
                  marginLeft: 6, padding: "1px 6px", borderRadius: 4,
                  background: "#fef3c7", color: "#92400e", fontWeight: 600,
                }}>
                  {t("积分待更新", "points pending")}
                </span>
              )}
            </span>
          )}
        </div>

        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "20px 0" }}>{error}</div>
        )}

        {!loading && data && data.entries.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            border: "1px solid #e5e7eb", textAlign: "center",
            color: "#6b7280", fontSize: 14,
          }}>
            {t("本周暂无结算数据。提交阵容后在比赛结算时自动获得积分。", "No scored results this week yet. Submit a lineup to earn points after settlement.")}
          </div>
        )}

        {!loading && data && data.entries.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 70px",
              padding: "8px 16px", borderBottom: "1px solid #f3f4f6",
              fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            }}>
              <span>{t("名次", "Rank")}</span>
              <span>{t("用户", "User")}</span>
              <span style={{ textAlign: "right" }}>{t("周积分", "Pts")}</span>
              <span style={{ textAlign: "right" }}>{t("参赛天", "Days")}</span>
              <span style={{ textAlign: "right" }}>{t("最佳名次", "Best")}</span>
            </div>

            {data.entries.map((entry, i) => {
              const isMe = user && entry.user_id === user.id;
              return (
                <div
                  key={entry.user_id}
                  style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 70px",
                    alignItems: "center", padding: "10px 16px",
                    borderBottom: i < data.entries.length - 1 ? "1px solid #f9fafb" : "none",
                    background: isMe ? "#eff6ff" : "transparent",
                  }}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: entry.weekly_rank === 1 ? "#d97706"
                         : entry.weekly_rank <= 3  ? "#6b7280" : "#9ca3af",
                  }}>
                    {entry.weekly_rank === 1 ? "🥇"
                     : entry.weekly_rank === 2 ? "🥈"
                     : entry.weekly_rank === 3 ? "🥉"
                     : `#${entry.weekly_rank}`}
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

                  {/* Weekly points — grey when pending settlement */}
                  <span style={{
                    fontSize: 14, fontWeight: 800, textAlign: "right",
                    color: entry.weekly_points > 0 ? "#059669"
                         : (data.settled_contests < data.total_contests) ? "#d97706"
                         : "#9ca3af",
                  }}>
                    {entry.weekly_points > 0 ? entry.weekly_points
                      : (data.settled_contests < data.total_contests) ? "—"
                      : "0"}
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
