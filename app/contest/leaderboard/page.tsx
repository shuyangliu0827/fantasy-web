"use client";
// app/contest/leaderboard/page.tsx
//
// Daily Fantasy leaderboard for a given contest.
//
// URL: /contest/leaderboard?id=<contest_id>
// Defaults to today's contest when `id` is omitted.
//
// ── Visibility rules ──────────────────────────────────────────
//   Before lock: shows entry count + usernames, NO player details.
//   After lock:  shows full lineups (click row → detail modal).
//
// Data source: GET /api/contests/[id]/leaderboard
// (backend enforces the visibility rules via the `locked` flag).

import { useEffect, useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";
function fmtFpts(n: number | null) { return n != null ? n.toFixed(1) : "—"; }

type Player = {
  slot: number; slot_label: string; player_id: string;
  name: string; position: string; salary: number;
  actual_fantasy_points: number | null;
};

type Entry = {
  rank: number | null; user_id: string; username: string;
  total_fpts: number | null; points_awarded: number;
  status: string; submitted_at: string | null;
  players: Player[] | null;
};

type LeaderboardData = {
  contest_id: string; status: string; locked: boolean;
  total: number; entries: Entry[];
};

function LeaderboardContent() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const contestId = searchParams.get("id");

  const [user]    = useState(() => getSessionUser());
  const [data,    setData]    = useState<LeaderboardData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(contestId);
  const [modal,   setModal]   = useState<Entry | null>(null);
  const [page,    setPage]    = useState(0);

  const PAGE_SIZE = 50;

  useEffect(() => {
    resolveAndLoad(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contestId]);

  async function resolveAndLoad(offset: number) {
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
    const res = await fetch(`/api/contests/${cid}/leaderboard?limit=${PAGE_SIZE}&offset=${offset}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    const json: LeaderboardData = await res.json();
    setData((prev) =>
      offset === 0
        ? json
        : prev
          ? { ...json, entries: [...prev.entries, ...json.entries] }
          : json,
    );
    setLoading(false);
  }

  function loadMore() {
    const nextPage = page + 1;
    setPage(nextPage);
    resolveAndLoad(nextPage * PAGE_SIZE);
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case "pending": return t("尚未开放", "Pending");
      case "open":    return t("开放选人", "Open — results after lock");
      case "locked":  return t("已锁定，比赛进行中", "Locked — in progress");
      case "scored":  return t("已结算", "Final results");
      default:        return s;
    }
  };

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={resolvedId} />

      <main style={{ maxWidth: 600, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
            {t("每日排行榜", "Daily Leaderboard")}
          </h2>
          {data && (
            <span style={{ fontSize: 12, color: "#6b7280" }}>
              {data.total} {t("人", "entries")}
            </span>
          )}
        </div>

        {data && (
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
            {statusLabel(data.status)}
            {!data.locked && (
              <span style={{ marginLeft: 6, color: "#f59e0b", fontWeight: 600 }}>
                · {t("锁定后可查看他人阵容", "Player details visible after lineup lock")}
              </span>
            )}
          </div>
        )}

        {loading && !data && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "20px 0" }}>{error}</div>
        )}

        {data && data.entries.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            border: "1px solid #e5e7eb", textAlign: "center",
            color: "#6b7280", fontSize: 14,
          }}>
            {t("暂无提交记录。", "No entries submitted yet.")}
          </div>
        )}

        {data && data.entries.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              display: "grid", gridTemplateColumns: "40px 1fr 70px 70px",
              padding: "8px 16px", borderBottom: "1px solid #f3f4f6",
              fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase",
            }}>
              <span>{t("名次", "Rank")}</span>
              <span>{t("用户", "User")}</span>
              <span style={{ textAlign: "right" }}>{t("总分", "Fpts")}</span>
              <span style={{ textAlign: "right" }}>{t("积分", "Pts")}</span>
            </div>

            {data.entries.map((entry, i) => {
              const isMe = user && entry.user_id === user.id;
              const canOpen = data.locked && entry.players && entry.players.length > 0;
              return (
                <div
                  key={`${entry.user_id}-${i}`}
                  onClick={() => canOpen && setModal(entry)}
                  style={{
                    display: "grid", gridTemplateColumns: "40px 1fr 70px 70px",
                    alignItems: "center", padding: "10px 16px",
                    borderBottom: i < data.entries.length - 1 ? "1px solid #f9fafb" : "none",
                    background: isMe ? "#eff6ff" : "transparent",
                    cursor: canOpen ? "pointer" : "default",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => { if (canOpen) (e.currentTarget as HTMLElement).style.background = isMe ? "#dbeafe" : "#f9fafb"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isMe ? "#eff6ff" : "transparent"; }}
                >
                  {/* Rank */}
                  <span style={{
                    fontSize: 13, fontWeight: 700,
                    color: entry.rank === 1 ? "#d97706" : entry.rank != null && entry.rank <= 3 ? "#6b7280" : "#9ca3af",
                  }}>
                    {entry.rank != null ? `#${entry.rank}` : "—"}
                  </span>

                  {/* User */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <PlayerAvatar name={entry.username} size={24} />
                    <span style={{
                      fontSize: 13, fontWeight: isMe ? 700 : 500, color: "#111827",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {entry.username}
                      {isMe && <span style={{ color: "#2563eb", fontSize: 11, marginLeft: 4 }}>({t("我", "me")})</span>}
                    </span>
                  </div>

                  {/* Fpts */}
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", textAlign: "right" }}>
                    {fmtFpts(entry.total_fpts)}
                  </span>

                  {/* Points */}
                  <span style={{
                    fontSize: 13, fontWeight: 700, textAlign: "right",
                    color: entry.points_awarded > 0 ? "#059669" : "#9ca3af",
                  }}>
                    {entry.points_awarded > 0 ? `+${entry.points_awarded}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {data && data.entries.length < data.total && (
          <div style={{ textAlign: "center", marginTop: 16 }}>
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                padding: "9px 24px", borderRadius: 8, border: "1px solid #e5e7eb",
                background: "#fff", color: "#374151", cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 600, opacity: loading ? 0.6 : 1,
              }}
            >
              {t("加载更多", "Load more")}
            </button>
          </div>
        )}
      </main>

      {/* ── Lineup detail modal ─────────────────────────────── */}
      {modal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000, padding: 16,
          }}
          onClick={() => setModal(null)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, width: "100%", maxWidth: 400,
              boxShadow: "0 8px 32px rgba(0,0,0,0.18)", overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div style={{
              padding: "16px 20px", borderBottom: "1px solid #f3f4f6",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                  {modal.username}
                  {modal.rank != null && (
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280", fontWeight: 400 }}>
                      #{modal.rank}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                  {fmtFpts(modal.total_fpts)} fpts
                  {modal.points_awarded > 0 && (
                    <span style={{ color: "#059669", marginLeft: 8, fontWeight: 600 }}>
                      +{modal.points_awarded} pts
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "#f3f4f6", border: "none", cursor: "pointer",
                  fontSize: 16, color: "#6b7280", display: "flex",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                ×
              </button>
            </div>

            {/* Players */}
            {(modal.players ?? []).sort((a, b) => a.slot - b.slot).map((p, i, arr) => (
              <div key={p.player_id} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 20px",
                borderBottom: i < arr.length - 1 ? "1px solid #f9fafb" : "none",
              }}>
                <span style={{
                  width: 30, height: 22, borderRadius: 4, flexShrink: 0,
                  background: "#1e3a8a", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700,
                }}>
                  {p.slot_label}
                </span>
                <PlayerAvatar name={p.name} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b7280" }}>
                    {p.position} · ${p.salary.toLocaleString()}
                  </div>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: p.actual_fantasy_points != null && p.actual_fantasy_points > 30 ? "#059669" : "#374151", flexShrink: 0 }}>
                  {fmtFpts(p.actual_fantasy_points)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LeaderboardPage() {
  return (
    <Suspense>
      <LeaderboardContent />
    </Suspense>
  );
}
