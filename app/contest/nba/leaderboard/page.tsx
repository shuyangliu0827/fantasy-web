"use client";
// app/contest/nba/leaderboard/page.tsx
//
// Daily Fantasy leaderboard — "首发五虎" redesign.
//
// Visibility rules (enforced by API + this UI):
//   Before lock : entry count + usernames shown; player picks hidden.
//   After lock  : full lineups revealed; click row to expand player detail.
//   After score : total_fpts, rank, points_awarded shown.

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import SharePosterModal from "@/components/daily-fantasy/SharePosterModal";
import { type ResultPosterProps } from "@/components/daily-fantasy/posters/ResultPoster";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/shared/store";
import { getPlayerDisplayName } from "@/lib/players/player-name-zh";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";
function fmtFpts(n: number | null) { return n != null ? n.toFixed(1) : "—"; }

// ── Types ──────────────────────────────────────────────────────────────────
type Player = {
  slot: number; slot_label: string; player_id: string;
  name: string; position: string; salary: number;
  team?: string; tier?: number | null;
  actual_fantasy_points: number | null;
  invalid?: boolean;
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

// ── Position badge palette ─────────────────────────────────────────────────
const POS_COLOR: Record<string, { bg: string; fg: string }> = {
  PG: { bg: "#1e3a8a", fg: "#fff" },
  SG: { bg: "#5b21b6", fg: "#fff" },
  SF: { bg: "#065f46", fg: "#fff" },
  PF: { bg: "#92400e", fg: "#fff" },
  C:  { bg: "#9f1239", fg: "#fff" },
};

// ── Rank badge ─────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number | null }) {
  if (rank == null) {
    return (
      <div style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 16, color: "#d1d5db", fontWeight: 700 }}>—</span>
      </div>
    );
  }
  if (rank === 1) return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: "linear-gradient(135deg,#fef3c7,#fcd34d)",
      boxShadow: "0 2px 6px rgba(217,119,6,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18,
    }}>🥇</div>
  );
  if (rank === 2) return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: "linear-gradient(135deg,#f1f5f9,#cbd5e1)",
      boxShadow: "0 2px 6px rgba(100,116,139,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18,
    }}>🥈</div>
  );
  if (rank === 3) return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      background: "linear-gradient(135deg,#fff7ed,#fdba74)",
      boxShadow: "0 2px 6px rgba(194,65,12,0.25)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 18,
    }}>🥉</div>
  );
  return (
    <div style={{
      width: 36, height: 36, borderRadius: "50%",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700, color: "#9ca3af",
    }}>
      #{rank}
    </div>
  );
}

// ── Starting Five avatar strip ─────────────────────────────────────────────
const SLOT_LABELS = ["PG", "SG", "SF", "PF", "C"];

function StartingFive({ players, locked, size = 34 }: { players: Player[] | null; locked: boolean; size?: number }) {
  const chipStyle = (label: string) => {
    const c = POS_COLOR[label] ?? { bg: "#64748b", fg: "#fff" };
    return {
      fontSize: 8, fontWeight: 700, color: c.fg, background: c.bg,
      borderRadius: 3, padding: "1px 3px", whiteSpace: "nowrap",
      letterSpacing: "0.02em",
    };
  };

  if (!locked) {
    return (
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
        {SLOT_LABELS.map((lbl) => (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{
              width: size, height: size, borderRadius: "50%",
              background: "#f8fafc", border: "1.5px dashed #cbd5e1",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: Math.round(size * 0.45), color: "#d1d5db",
            }}>
              🔒
            </div>
            <span style={chipStyle(lbl)}>{lbl}</span>
          </div>
        ))}
      </div>
    );
  }

  const sorted = [...(players ?? [])].sort((a, b) => a.slot - b.slot);

  if (sorted.length === 0) {
    return (
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
        {SLOT_LABELS.map((lbl) => (
          <div key={lbl} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <div style={{ width: size, height: size, borderRadius: "50%", background: "#f1f5f9" }} />
            <span style={chipStyle(lbl)}>{lbl}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 5, alignItems: "flex-end" }}>
      {sorted.map((p) => (
        <div key={p.player_id} title={p.name}
          style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
          <PlayerAvatar name={p.name} size={size} />
          <span style={chipStyle(p.slot_label)}>{p.slot_label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Score cell ─────────────────────────────────────────────────────────────
function ScoreCell({ entry, t }: { entry: Entry; t: (zh: string, en: string) => string }) {
  if (entry.total_fpts != null) {
    return (
      <span style={{ fontSize: 15, fontWeight: 800, color: "#111827", fontVariantNumeric: "tabular-nums" }}>
        {fmtFpts(entry.total_fpts)}
      </span>
    );
  }
  return (
    <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500 }}>
      {t("待结算", "Pending")}
    </span>
  );
}

// ── Points / status cell ───────────────────────────────────────────────────
function PointsCell({ entry, t }: { entry: Entry; t: (zh: string, en: string) => string }) {
  if (entry.status === "scored") {
    const pts = entry.points_awarded;
    return (
      <span style={{
        fontSize: 14, fontWeight: 800, fontVariantNumeric: "tabular-nums",
        color: pts > 0 ? "#059669" : "#9ca3af",
      }}>
        {pts > 0 ? `+${pts}` : "0"}
      </span>
    );
  }
  const STATUS_CFG: Record<string, { zh: string; en: string; bg: string; fg: string }> = {
    submitted: { zh: "已提交", en: "Submitted", bg: "#dbeafe", fg: "#1d4ed8" },
    locked:    { zh: "已锁定", en: "Locked",    bg: "#fef3c7", fg: "#92400e" },
  };
  const cfg = STATUS_CFG[entry.status];
  if (!cfg) return null;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: "3px 8px",
      borderRadius: 6, background: cfg.bg, color: cfg.fg, whiteSpace: "nowrap",
    }}>
      {t(cfg.zh, cfg.en)}
    </span>
  );
}

// ── Expanded player detail panel ───────────────────────────────────────────
function PlayerDetailPanel({
  players, scored, lang,
}: {
  players: Player[]; scored: boolean; lang: string;
}) {
  const sorted = [...players].sort((a, b) => a.slot - b.slot);
  return (
    <div style={{ padding: "14px 16px 18px", background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "nowrap", overflowX: "auto" }}>
        {sorted.map((p) => {
          const pos = POS_COLOR[p.slot_label] ?? { bg: "#64748b", fg: "#fff" };
          const fpts = p.actual_fantasy_points;
          const fptsColor = fpts == null ? "#94a3b8"
            : fpts >= 40 ? "#059669"
            : fpts >= 20 ? "#d97706"
            : "#6b7280";
          return (
            <div key={p.player_id} style={{
              flex: "1 0 100px", minWidth: 100, maxWidth: 160,
              background: "#fff", borderRadius: 10,
              border: "1px solid #e2e8f0",
              padding: "10px 8px 12px",
              textAlign: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}>
              <span style={{
                display: "inline-block",
                fontSize: 9, fontWeight: 800,
                background: pos.bg, color: pos.fg,
                borderRadius: 4, padding: "2px 6px", marginBottom: 8,
                letterSpacing: "0.05em",
              }}>
                {p.slot_label}
              </span>
              <PlayerAvatar name={p.name} size={38} style={{ margin: "0 auto 7px" }} />
              <div style={{
                fontSize: 12, fontWeight: 700, color: "#111827",
                lineHeight: 1.3, marginBottom: 3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {getPlayerDisplayName(p, lang as "zh" | "en")}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 6 }}>
                {p.team ? `${p.team} · ` : ""}${(p.salary / 1000).toFixed(0)}K
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: fptsColor }}>
                {scored ? fmtFpts(fpts) : "—"}
              </div>
              {scored && (
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 1 }}>fpts</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main leaderboard content ───────────────────────────────────────────────
function LeaderboardContent() {
  const { t, lang } = useLang();
  const searchParams = useSearchParams();
  const contestId = searchParams.get("id");

  const [user]        = useState(() => getSessionUser());
  const [data,        setData]        = useState<LeaderboardData | null>(null);
  const [error,       setError]       = useState<string | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [resolvedId,  setResolvedId]  = useState<string | null>(contestId);
  const [contestDate, setContestDate] = useState<string | null>(null);
  const [contextMsg,  setContextMsg]  = useState<string | null>(null);
  const [page,        setPage]        = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [shareOpen,   setShareOpen]   = useState(false);

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
      const res   = await fetch("/api/contests/nearby");
      const json  = await res.json().catch(() => null);
      const contests: { id: string; date: string; status: string; lineup_lock_at: string | null }[] =
        json?.contests ?? [];

      const todaySlate   = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
      const now          = Date.now();
      const todayContest = contests.find((c) => c.date === todaySlate);
      const lockAt       = todayContest?.lineup_lock_at ? new Date(todayContest.lineup_lock_at).getTime() : null;
      const todayStarted = lockAt != null && now >= lockAt;

      if (todayContest && todayStarted) {
        cid = todayContest.id;
        setContestDate(todayContest.date);
        setContextMsg(
          todayContest.status === "scored"
            ? t("今日比赛已结算", "Today's contest — final results")
            : t("今日比赛进行中，当前排名为临时排名", "Today's contest in progress — preliminary standings"),
        );
      } else {
        const recent = [...contests].reverse().find((c) => c.date < todaySlate);
        if (recent) {
          cid = recent.id;
          setContestDate(recent.date);
          setContextMsg(
            recent.status === "scored"
              ? t("今日比赛尚未开始，当前展示最近已结算每日榜", "Today's games haven't started — showing most recent final results")
              : t("今日比赛尚未开始，最近每日榜结算处理中", "Today's games haven't started — recent results pending settlement"),
          );
        } else if (todayContest) {
          cid = todayContest.id;
          setContestDate(todayContest.date);
          setContextMsg(t("今日比赛尚未开始", "Today's contest hasn't started yet"));
        }
      }
    }

    if (!cid) {
      setError(t("暂无赛事。", "No contest found."));
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
    setData((prev: LeaderboardData | null) =>
      offset === 0
        ? json
        : prev ? { ...json, entries: [...prev.entries, ...json.entries] } : json,
    );

    if (!contestDate && contestId) {
      fetch("/api/contests/nearby")
        .then((r) => r.json())
        .then((nj) => {
          const found = (nj?.contests ?? []).find((c: { id: string; date: string }) => c.id === contestId);
          if (found) setContestDate(found.date);
        })
        .catch(() => {});
    }
    setLoading(false);
  }

  function loadMore() {
    const next = page + 1;
    setPage(next);
    resolveAndLoad(next * PAGE_SIZE);
  }

  const contestStatusLabel = (s: string) => {
    switch (s) {
      case "pending": return t("尚未开放", "Pending");
      case "open":    return t("开放选人", "Open");
      case "locked":  return t("已锁定，比赛进行中", "Locked — in progress");
      case "scored":  return t("已结算", "Final results");
      default:        return s;
    }
  };

  const formattedDate = (() => {
    if (!contestDate) return null;
    const [y, m, d] = contestDate.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(
      t("zh-CN", "en-US"),
      { month: "long", day: "numeric", year: "numeric" },
    );
  })();

  // Row key: user_id is unique per contest
  const toggleExpand = (key: string) =>
    setExpandedKey((prev: string | null) => (prev === key ? null : key));

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      {/* Responsive grid styles */}
      <style>{`
        .lb-grid {
          display: grid;
          grid-template-columns: 52px 180px 1fr 90px 90px;
          align-items: center;
        }
        .lb-col-five   { }
        .lb-col-score  { text-align: right; }
        .lb-col-pts    { text-align: right; }
        .lb-five-mobile { display: none; }
        @media (max-width: 700px) {
          .lb-grid {
            grid-template-columns: 44px 1fr 72px;
          }
          .lb-col-five  { display: none !important; }
          .lb-col-score { display: none !important; }
          .lb-col-pts   { text-align: right; }
          .lb-five-mobile { display: flex !important; }
        }
        .lb-entry-row:hover { background: var(--row-hover-bg) !important; }
      `}</style>

      <LightHeader activeHref="/contest" />
      <ContestNav scope={{ kind: "nba" }} contestId={resolvedId} />

      <main style={{ maxWidth: 1020, margin: "0 auto", padding: "20px 16px 48px" }}>

        {/* ── Page header ───────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, flexWrap: "wrap", gap: 4 }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
              {t("每日排行榜", "Daily Leaderboard")}
            </h2>
            {formattedDate && (
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3, fontWeight: 500 }}>{formattedDate}</div>
            )}
          </div>
          {data && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "#fff", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "5px 12px",
              fontSize: 12, color: "#6b7280",
            }}>
              <span style={{ fontSize: 16 }}>👥</span>
              <span style={{ fontWeight: 700, color: "#111827" }}>{data.total}</span>
              <span>{t("人参赛", "entries")}</span>
            </div>
          )}
        </div>

        {/* ── Status bar ───────────────────────────────────────── */}
        {data && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            marginBottom: 16, flexWrap: "wrap",
          }}>
            {contextMsg && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>{contextMsg}</span>
            )}
            {contextMsg && <span style={{ color: "#d1d5db", fontSize: 12 }}>·</span>}
            <span style={{ fontSize: 12, color: "#6b7280" }}>{contestStatusLabel(data.status)}</span>

            {!data.locked && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 20,
                background: "#fffbeb", color: "#92400e",
                border: "1px solid #fcd34d",
              }}>
                🔒 {t("阵容将在锁定后公开", "Lineups reveal after lock")}
              </span>
            )}
            {data.locked && data.status !== "scored" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 20,
                background: "#fff7ed", color: "#c2410c",
                border: "1px solid #fdba74",
              }}>
                ⏱ {t("临时排名 — 结算后更新积分", "Preliminary — points update after settlement")}
              </span>
            )}
            {data.status === "scored" && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 11, fontWeight: 700,
                padding: "3px 10px", borderRadius: 20,
                background: "#dcfce7", color: "#166534",
                border: "1px solid #86efac",
              }}>
                ✅ {t("已结算", "Scored")}
              </span>
            )}
          </div>
        )}

        {/* ── Loading / error / empty ──────────────────────────── */}
        {loading && !data && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}
        {error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "24px 0" }}>{error}</div>
        )}
        {data && data.entries.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 14, padding: "48px 24px",
            border: "1px solid #e2e8f0", textAlign: "center",
            color: "#9ca3af", fontSize: 14,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>🏀</div>
            {t("暂无提交记录。", "No entries submitted yet.")}
          </div>
        )}

        {/* ── Leaderboard table ────────────────────────────────── */}
        {data && data.entries.length > 0 && (
          <div style={{
            background: "#fff", borderRadius: 14,
            border: "1px solid #e2e8f0", overflow: "hidden",
            boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          }}>
            {/* Table header */}
            <div
              className="lb-grid"
              style={{
                padding: "10px 16px",
                borderBottom: "2px solid #f1f5f9",
                background: "#f8fafc",
                fontSize: 11, fontWeight: 800, color: "#94a3b8",
                textTransform: "uppercase", letterSpacing: "0.06em",
              }}
            >
              <span>{t("名次", "Rank")}</span>
              <span>{t("用户", "User")}</span>
              <span className="lb-col-five" style={{ paddingLeft: 8 }}>{t("首发五虎", "Starting Five")}</span>
              <span className="lb-col-score">{t("每日总分", "Daily Score")}</span>
              <span className="lb-col-pts">{t("积分", "Points")}</span>
            </div>

            {/* Entry rows */}
            {data.entries.map((entry: Entry, i: number) => {
              const key      = `${entry.user_id}-${i}`;
              const isMe     = !!(user && entry.user_id === user.id);
              const isExpand = expandedKey === key;
              const canExpand = data.locked && (entry.players?.length ?? 0) > 0;
              const isLast   = i === data.entries.length - 1;

              return (
                <div key={key}>
                  {/* Main row */}
                  <div
                    className="lb-entry-row lb-grid"
                    onClick={() => canExpand && toggleExpand(key)}
                    style={{
                      "--row-hover-bg": isMe ? "#dbeafe" : "#f8fafc",
                      padding: "12px 16px",
                      borderBottom: (!isLast || isExpand) ? "1px solid #f1f5f9" : "none",
                      background: isMe ? "#eff6ff" : "transparent",
                      cursor: canExpand ? "pointer" : "default",
                      transition: "background 0.12s",
                    } as any}
                  >
                    {/* Rank */}
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <RankBadge rank={entry.rank} />
                    </div>

                    {/* User */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 0, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <PlayerAvatar name={entry.username || "?"} size={28} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <span style={{
                              fontSize: 13, fontWeight: isMe ? 800 : 600, color: "#111827",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>
                              {entry.username || "—"}
                            </span>
                            {isMe && (
                              <span style={{
                                fontSize: 10, fontWeight: 800, lineHeight: 1,
                                color: "#1d4ed8", background: "#dbeafe",
                                borderRadius: 4, padding: "2px 5px",
                              }}>
                                {t("我", "me")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Mobile-only: compact 5 avatars below name */}
                      <div
                        className="lb-five-mobile"
                        style={{ display: "none", marginTop: 7, gap: 4, alignItems: "flex-end" }}
                      >
                        <StartingFive players={entry.players} locked={data.locked} size={26} />
                      </div>
                    </div>

                    {/* Starting Five (desktop) */}
                    <div className="lb-col-five" style={{ display: "flex", alignItems: "center", paddingLeft: 8 }}>
                      <StartingFive players={entry.players} locked={data.locked} size={34} />
                    </div>

                    {/* Daily Score (desktop) */}
                    <div className="lb-col-score">
                      <ScoreCell entry={entry} t={t} />
                    </div>

                    {/* Points / status */}
                    <div className="lb-col-pts" style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <PointsCell entry={entry} t={t} />
                      {isMe && data.status === "scored" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShareOpen(true); }}
                          style={{
                            padding: "3px 9px", borderRadius: 5,
                            background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
                            border: "none", color: "#fff", cursor: "pointer",
                            fontSize: 10, fontWeight: 700, whiteSpace: "nowrap",
                          }}
                        >
                          {t("分享", "Share")}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded player detail */}
                  {isExpand && entry.players && (
                    <PlayerDetailPanel
                      players={entry.players}
                      scored={entry.status === "scored"}
                      lang={lang}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Load more ────────────────────────────────────────── */}
        {data && data.entries.length < data.total && (
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              onClick={loadMore}
              disabled={loading}
              style={{
                padding: "10px 28px", borderRadius: 10,
                border: "1px solid #e2e8f0",
                background: loading ? "#f9fafb" : "#fff",
                color: "#374151", cursor: loading ? "not-allowed" : "pointer",
                fontSize: 13, fontWeight: 700,
                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                opacity: loading ? 0.6 : 1,
                transition: "all 0.1s",
              }}
            >
              {loading ? t("加载中…", "Loading…") : t("加载更多", "Load more")}
            </button>
          </div>
        )}
      </main>

      {/* ── Share poster modal (current user's result) ── */}
      {(() => {
        if (!shareOpen || !data || !user || !contestDate) return null;
        const myEntry = data.entries.find((e: Entry) => e.user_id === user.id);
        if (!myEntry) return null;
        return (
          <SharePosterModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            posterType="result"
            lang={lang as "zh" | "en"}
            posterProps={({
              posterType: "result",
              username: (user as { username?: string; email?: string }).username ?? (user as { username?: string; email?: string }).email?.split("@")[0] ?? "Player",
              date: contestDate,
              totalFpts: myEntry.total_fpts ?? 0,
              rank: myEntry.rank ?? 0,
              totalEntries: data.total,
              pointsAwarded: myEntry.points_awarded,
              lang: lang as "zh" | "en",
              players: (myEntry.players ?? []).map((p: Player) => ({
                slotLabel: p.slot_label,
                name: p.name,
                team: p.team ?? "",
                position: p.position ?? "",
                actualPoints: p.actual_fantasy_points,
              })),
            } as ResultPosterProps)}
          />
        );
      })()}
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
