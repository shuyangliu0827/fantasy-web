"use client";
// app/contest/my-lineup/page.tsx
//
// "My Results" — shows the current week's submitted/locked/scored lineups,
// sorted Mon → Sun (oldest first). Each card is expandable to show players
// and, when scored, the total_fpts / rank / points_awarded summary.

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";
import { contestFetch } from "@/lib/contest-fetch";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }
function fmtFpts(n: number | null) { return n != null ? n.toFixed(1) : "—"; }

type Player = {
  slot: number;
  slot_label: string;
  player_id: string;
  name: string;
  position: string;
  salary: number;
  actual_fantasy_points: number | null;
};

type LineupEntry = {
  lineup_id: string;
  contest_id: string;
  contest_date: string | null;
  contest_status: string | null;
  status: string;
  total_fpts: number | null;
  rank: number | null;
  points_awarded: number;
  submitted_at: string | null;
  players: Player[];
};

function MyLineupContent() {
  const { t, lang } = useLang();
  const router = useRouter();

  const [user]    = useState(() => getSessionUser());
  const [lineups, setLineups] = useState<LineupEntry[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError(null);
    const res = await contestFetch("/api/contests/my-lineups");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const entries: LineupEntry[] = json.lineups ?? [];
    setLineups(entries);
    // Auto-expand all current-week entries so scores are immediately visible
    setExpanded(new Set<string>(entries.map((e) => e.lineup_id)));
    setLoading(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      submitted: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
      locked:    { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
      scored:    { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
    };
    const s = styles[status] ?? { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
    const label: Record<string, string> = {
      submitted: t("已提交", "Submitted"),
      locked:    t("锁定中", "Locked"),
      scored:    t("已结算", "Scored"),
    };
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}>
        {label[status] ?? status}
      </span>
    );
  };

  const contestStatusLabel = (s: string | null) => {
    switch (s) {
      case "pending": return t("尚未开放", "Pending");
      case "open":    return t("开放中", "Open");
      case "locked":  return t("已锁定", "Locked");
      case "scored":  return t("已结算", "Scored");
      default:        return s ?? "";
    }
  };

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00Z").toLocaleDateString(
      lang === "zh" ? "zh-CN" : "en-US",
      { month: "short", day: "numeric", weekday: "short" },
    );
  }

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={null} />

      <main style={{ maxWidth: 560, margin: "0 auto", padding: "20px 16px" }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
          {t("我的成绩", "My Results")}
        </h2>

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

        {user && !loading && !error && lineups.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            border: "1px solid #e5e7eb", textAlign: "center",
          }}>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              {t("你还没有提交过阵容。", "You haven't submitted any lineups yet.")}
            </div>
            <button
              onClick={() => router.push("/contest")}
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

        {user && !loading && !error && lineups.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lineups.map((entry) => {
              const isExpanded = expanded.has(entry.lineup_id);
              const totalSalary = entry.players.reduce((s, p) => s + p.salary, 0);
              const isScored = entry.status === "scored";

              return (
                <div key={entry.lineup_id} style={{
                  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}>
                  {/* Card header — always visible */}
                  <div
                    onClick={() => toggleExpand(entry.lineup_id)}
                    style={{
                      padding: "14px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {formatDate(entry.contest_date)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                        {contestStatusLabel(entry.contest_status)}
                      </div>
                    </div>

                    {/* Header right: scored summary or status badge */}
                    {isScored ? (
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {fmtFpts(entry.total_fpts)}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("总分", "Fpts")}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {entry.rank != null ? `#${entry.rank}` : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("排名", "Rank")}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>
                            +{entry.points_awarded}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("积分", "Pts")}</div>
                        </div>
                      </div>
                    ) : (
                      statusBadge(entry.status)
                    )}

                    <span style={{
                      fontSize: 12, color: "#9ca3af", marginLeft: 4,
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s",
                      display: "inline-block",
                    }}>▼</span>
                  </div>

                  {/* Expandable section */}
                  {isExpanded && (
                    <>
                      {/* Player rows */}
                      <div style={{ borderTop: "1px solid #f3f4f6" }}>
                        {entry.players.map((p, i) => (
                          <div key={p.player_id} style={{
                            display: "flex", alignItems: "center", gap: 10,
                            padding: "10px 16px",
                            borderBottom: i < entry.players.length - 1 ? "1px solid #f3f4f6" : "none",
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
                                {p.name || p.player_id}
                              </div>
                              <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                                {p.position} · {fmtMoney(p.salary)}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              {isScored ? (
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

                      {/* Footer */}
                      <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 16px" }}>
                        {/* Scored stats grid OR pending notice */}
                        {isScored ? (
                          <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 8, marginBottom: 10,
                          }}>
                            {[
                              { label: t("总分", "Total Fpts"), value: fmtFpts(entry.total_fpts) },
                              { label: t("排名", "Rank"),        value: entry.rank != null ? `#${entry.rank}` : "—" },
                              { label: t("获得积分", "Points"),  value: `+${entry.points_awarded}` },
                            ].map(({ label, value }) => (
                              <div key={label} style={{
                                background: "#f9fafb", borderRadius: 8, padding: "8px 6px",
                                textAlign: "center", border: "1px solid #f3f4f6",
                              }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{value}</div>
                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{
                            fontSize: 12, color: "#92400e", background: "#fef3c7",
                            border: "1px solid #fcd34d", borderRadius: 6,
                            padding: "6px 10px", marginBottom: 10, fontWeight: 500,
                          }}>
                            {t("等待结算，比赛结束后自动更新排名和积分。", "Awaiting settlement — rank and points will update after games complete.")}
                          </div>
                        )}

                        {/* Total salary + leaderboard button */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {t("总工资", "Total Salary")}
                            <span style={{ fontWeight: 600, color: "#374151", marginLeft: 6 }}>
                              {fmtMoney(totalSalary)}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/contest/leaderboard?id=${entry.contest_id}`);
                            }}
                            style={{
                              padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb",
                              background: "#fff", color: "#374151", cursor: "pointer",
                              fontSize: 12, fontWeight: 600,
                            }}
                          >
                            {t("查看排行榜", "Leaderboard")}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
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
