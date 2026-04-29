"use client";
// app/contest/my-lineup/page.tsx
//
// "My Results" — shows the authenticated user's lineup for a given contest,
// including per-player scores, total fpts, rank, and points earned.
//
// URL: /contest/my-lineup?id=<contest_id>
// If `id` is missing, falls back to today's contest via /api/contests/today.
//
// ── States ────────────────────────────────────────────────────
//   No lineup yet          → "You haven't submitted a lineup for this contest"
//   Draft (not submitted)  → "You have an unsubmitted draft"
//   Submitted / locked     → Show players, "Awaiting results"
//   Scored                 → Show players with actual fpts, rank, points_awarded

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";
import { contestFetch } from "@/lib/contest-fetch";
import { SLOT_LABEL } from "@/lib/contest-positions";
import { calcPointsAwarded } from "@/lib/contest-points";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }
function fmtFpts(n: number | null) { return n != null ? n.toFixed(1) : "—"; }

type LineupData = {
  lineup_id: string;
  contest_id: string;
  contest_date: string | null;
  contest_status: string | null;
  status: string;
  total_fpts: number | null;
  rank: number | null;
  points_awarded: number;
  submitted_at: string | null;
  players: {
    slot: number;
    slot_label: string;
    player_id: string;
    name: string;
    team: string;
    position: string;
    salary: number;
    actual_fantasy_points: number | null;
  }[];
};

function MyLineupContent() {
  const { t, lang } = useLang();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contestId = searchParams.get("id");

  const [user]        = useState(() => getSessionUser());
  const [data,  setData]  = useState<LineupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(contestId);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    resolveAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  async function resolveAndLoad() {
    setLoading(true);
    setError(null);
    let cid = contestId;
    if (!cid) {
      const res = await fetch("/api/contests/today");
      const json = await res.json().catch(() => null);
      cid = json?.id ?? null;
    }
    if (!cid) {
      setError(t("今日暂无赛事。", "No contest found for today."));
      setLoading(false);
      return;
    }
    setResolvedId(cid);
    const res = await contestFetch(`/api/contests/${cid}/lineup`);
    if (res.status === 404) {
      setData(null);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  const statusLabel = (s: string | undefined) => {
    switch (s) {
      case "draft":     return t("草稿（未提交）", "Draft — not submitted");
      case "submitted": return t("已提交，等待比赛结束", "Submitted — awaiting results");
      case "locked":    return t("已锁定，比赛进行中", "Locked — games in progress");
      case "scored":    return t("已结算", "Scored");
      default:          return s ?? "";
    }
  };

  const contestStatusLabel = (s: string | null) => {
    switch (s) {
      case "pending":  return t("尚未开放", "Pending");
      case "open":     return t("开放选人", "Open");
      case "locked":   return t("已锁定", "Locked");
      case "scored":   return t("已结算", "Scored");
      default:         return s ?? "";
    }
  };

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={resolvedId} />

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "20px 16px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
          {t("我的今日成绩", "My Results")}
        </h2>
        {data?.contest_date && (
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
            {new Date(data.contest_date + "T00:00:00Z").toLocaleDateString(lang === "zh" ? "zh-CN" : "en-US", {
              weekday: "short", month: "short", day: "numeric",
            })}
            {" · "}
            {contestStatusLabel(data.contest_status)}
          </div>
        )}

        {!user && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("请先登录查看成绩。", "Please log in to view your results.")}
          </div>
        )}

        {user && loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {user && !loading && error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "20px 0" }}>{error}</div>
        )}

        {user && !loading && !error && !data && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 24,
            border: "1px solid #e5e7eb", textAlign: "center",
          }}>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              {t("你还没有提交今日阵容。", "You haven't submitted a lineup for this contest.")}
            </div>
            <button
              onClick={() => router.push(resolvedId ? `/contest?id=${resolvedId}` : "/contest")}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#1e3a8a", color: "#fff", cursor: "pointer",
                fontSize: 14, fontWeight: 600,
              }}
            >
              {t("去选阵容", "Build Lineup")}
            </button>
          </div>
        )}

        {user && !loading && data && (
          <>
            {/* Status banner */}
            <div style={{
              background: data.status === "scored" ? "#d1fae5" : "#fef3c7",
              border: `1px solid ${data.status === "scored" ? "#6ee7b7" : "#fcd34d"}`,
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              fontSize: 13, color: data.status === "scored" ? "#065f46" : "#92400e",
              fontWeight: 600,
            }}>
              {statusLabel(data.status)}
              {data.status !== "scored" && (
                <span style={{ fontWeight: 400, marginLeft: 8 }}>
                  {t("比赛结束后自动更新排名和积分。", "Rank and points will update after games complete.")}
                </span>
              )}
            </div>

            {/* Scores summary (only when scored) */}
            {data.status === "scored" && (
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                gap: 10, marginBottom: 16,
              }}>
                {[
                  { label: t("总分", "Total Fpts"), value: fmtFpts(data.total_fpts) },
                  { label: t("排名", "Rank"),        value: data.rank != null ? `#${data.rank}` : "—" },
                  { label: t("今日积分", "Points"),  value: `+${data.points_awarded}` },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    background: "#fff", borderRadius: 10, padding: "12px 10px",
                    border: "1px solid #e5e7eb", textAlign: "center",
                  }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>{value}</div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Player list */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {data.players.sort((a, b) => a.slot - b.slot).map((p, i) => (
                <div key={p.player_id} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
                  borderBottom: i < data.players.length - 1 ? "1px solid #f3f4f6" : "none",
                }}>
                  {/* Slot badge */}
                  <span style={{
                    width: 30, height: 22, borderRadius: 4, flexShrink: 0,
                    background: "#1e3a8a", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700,
                  }}>
                    {p.slot_label}
                  </span>

                  <PlayerAvatar name={p.name} size={28} />

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.name || p.player_id}
                    </div>
                    <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                      {p.position} · {fmtMoney(p.salary)}
                    </div>
                  </div>

                  {/* Fpts column */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    {data.status === "scored" ? (
                      <span style={{
                        fontSize: 14, fontWeight: 700,
                        color: (p.actual_fantasy_points ?? 0) > 30 ? "#059669" : "#374151",
                      }}>
                        {fmtFpts(p.actual_fantasy_points)}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#9ca3af" }}>
                        {t("等待", "Pending")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Total salary footer */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              padding: "12px 4px", fontSize: 13, color: "#6b7280",
            }}>
              <span>{t("总工资", "Total Salary")}</span>
              <span style={{ fontWeight: 600, color: "#374151" }}>
                {fmtMoney(data.players.reduce((s, p) => s + p.salary, 0))}
              </span>
            </div>

            {/* Leaderboard link */}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <button
                onClick={() => router.push(resolvedId ? `/contest/leaderboard?id=${resolvedId}` : "/contest/leaderboard")}
                style={{
                  padding: "9px 20px", borderRadius: 8, border: "1px solid #e5e7eb",
                  background: "#fff", color: "#374151", cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {t("查看全服排行榜", "View Leaderboard")}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function MyLineupPage() {
  return (
    <Suspense>
      <MyLineupContent />
    </Suspense>
  );
}
