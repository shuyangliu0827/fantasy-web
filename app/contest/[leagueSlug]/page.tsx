"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "archived";
  visibility: "public" | "invite_only" | "private";
  is_contest_enabled: boolean;
};

type Contest = {
  id: string;
  basketball_league_id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  salary_cap: number;
  lineup_size: number;
};

type PoolPlayer = {
  contest_player_id: string;
  player_id: string;
  name: string;
  position: string | null;
  team_name: string | null;
  team_abbr: string | null;
  salary: number;
  tier: number;
  projected_points: number;
  season_avg_fp: number;
  games_played: number;
};

type LineupSlot = { slot: number; player_id: string };

type LineupResponse = {
  lineup_id?: string;
  contest_id?: string;
  status: "draft" | "submitted" | "scored";
  total_fpts: number | null;
  rank: number | null;
  submitted_at: string | null;
  players: LineupSlot[];
};

type LeaderEntry = {
  id: string;
  user_id: string;
  status: string;
  total_fpts: number | null;
  rank: number | null;
  submitted_at: string | null;
};

const SLOT_LABELS = ["PG", "SG", "SF", "PF", "C"] as const;

export default function LeagueContestPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);
  if (leagueSlug === "nba") {
    redirect("/contest");
  }
  return <LeagueContestInner leagueSlug={leagueSlug} />;
}

function LeagueContestInner({ leagueSlug }: { leagueSlug: string }) {
  const { t } = useLang();
  const [league, setLeague] = useState<League | null>(null);
  const [leagueErr, setLeagueErr] = useState<string | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [contestErr, setContestErr] = useState<string | null>(null);
  const [pool, setPool] = useState<PoolPlayer[]>([]);
  const [lineup, setLineup] = useState<LineupResponse | null>(null);
  const [picks, setPicks] = useState<(string | null)[]>([null, null, null, null, null]);
  const [leaderboard, setLeaderboard] = useState<LeaderEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load league + contest + pool + (auth) lineup + leaderboard.
  const load = useCallback(async () => {
    setLoading(true);
    const lRes = await basketballJson<{ league: League }>(
      `/api/basketball-leagues/by-slug/${leagueSlug}`,
    );
    if (lRes.status === 404 || !lRes.data) {
      setLeagueErr("league_not_found");
      setLoading(false);
      return;
    }
    setLeague(lRes.data.league);

    if (
      lRes.data.league.status !== "approved" ||
      lRes.data.league.visibility !== "public" ||
      !lRes.data.league.is_contest_enabled
    ) {
      setContestErr("league_not_enabled");
      setLoading(false);
      return;
    }

    const cRes = await basketballJson<{ contest: Contest }>(
      `/api/basketball-contests/today?leagueSlug=${encodeURIComponent(leagueSlug)}`,
    );
    if (cRes.status === 404 || !cRes.data) {
      setContestErr(cRes.error ?? "no_contest_today");
      setLoading(false);
      return;
    }
    setContest(cRes.data.contest);

    const [poolRes, lineupRes, boardRes] = await Promise.all([
      basketballJson<{ players: PoolPlayer[] }>(
        `/api/basketball-contests/${cRes.data.contest.id}/players`,
      ),
      basketballJson<LineupResponse>(
        `/api/basketball-contests/${cRes.data.contest.id}/lineup`,
      ),
      basketballJson<{ entries: LeaderEntry[] }>(
        `/api/basketball-contests/${cRes.data.contest.id}/leaderboard`,
      ),
    ]);

    setPool(poolRes.data?.players ?? []);
    if (lineupRes.data) {
      setLineup(lineupRes.data);
      const slots = Array(cRes.data.contest.lineup_size).fill(null) as (string | null)[];
      for (const s of lineupRes.data.players ?? []) {
        if (s.slot >= 0 && s.slot < slots.length) slots[s.slot] = s.player_id;
      }
      setPicks(slots);
    } else {
      setPicks(Array(cRes.data.contest.lineup_size).fill(null));
    }
    setLeaderboard(boardRes.data?.entries ?? []);
    setLoading(false);
  }, [leagueSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const poolById = useMemo(() => {
    const m = new Map<string, PoolPlayer>();
    pool.forEach((p) => m.set(p.player_id, p));
    return m;
  }, [pool]);

  const salaryUsed = useMemo(() => {
    return picks.reduce<number>((sum, pid) => {
      if (!pid) return sum;
      const p = poolById.get(pid);
      return sum + (p?.salary ?? 0);
    }, 0);
  }, [picks, poolById]);

  const cap = contest?.salary_cap ?? 50000;
  const filled = picks.filter(Boolean).length;
  const isLocked =
    !!contest &&
    (contest.status === "locked" ||
      contest.status === "scored" ||
      (contest.lineup_lock_at && new Date(contest.lineup_lock_at).getTime() <= Date.now()));
  const isSubmitted = lineup?.status === "submitted" || lineup?.status === "scored";
  const editable = !isLocked && !isSubmitted;

  const togglePick = (player: PoolPlayer) => {
    if (!editable) return;
    setMsg(null);
    setPicks((prev) => {
      const next = [...prev];
      const idx = next.indexOf(player.player_id);
      if (idx >= 0) {
        next[idx] = null;
        return next;
      }
      const empty = next.indexOf(null);
      if (empty < 0) return prev;
      // Refuse if it would put salary over cap.
      const wouldBe = salaryUsed + player.salary;
      if (wouldBe > cap) {
        setMsg({ kind: "err", text: t("超出工资帽", "Over salary cap") });
        return prev;
      }
      next[empty] = player.player_id;
      return next;
    });
  };

  const removeFromSlot = (slotIdx: number) => {
    if (!editable) return;
    setPicks((prev) => {
      const next = [...prev];
      next[slotIdx] = null;
      return next;
    });
  };

  const save = async () => {
    if (!contest) return;
    const slots: LineupSlot[] = picks
      .map((pid, i) => (pid ? { slot: i, player_id: pid } : null))
      .filter((x): x is LineupSlot => !!x);
    setBusy("save");
    setMsg(null);
    const res = await basketballFetch(
      `/api/basketball-contests/${contest.id}/lineup`,
      { method: "POST", body: JSON.stringify({ players: slots }) },
    );
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: body.error ?? `HTTP ${res.status}` });
      return;
    }
    setMsg({ kind: "ok", text: t("已保存草稿", "Draft saved") });
    load();
  };

  const submit = async () => {
    if (!contest) return;
    setBusy("submit");
    setMsg(null);
    // Save first to make sure server has the latest picks.
    const saveRes = await basketballFetch(
      `/api/basketball-contests/${contest.id}/lineup`,
      {
        method: "POST",
        body: JSON.stringify({
          players: picks
            .map((pid, i) => (pid ? { slot: i, player_id: pid } : null))
            .filter(Boolean),
        }),
      },
    );
    if (!saveRes.ok) {
      const body = await saveRes.json().catch(() => ({}));
      setBusy(null);
      setMsg({ kind: "err", text: body.error ?? `HTTP ${saveRes.status}` });
      return;
    }
    const res = await basketballFetch(
      `/api/basketball-contests/${contest.id}/lineup/submit`,
      { method: "POST" },
    );
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: body.error ?? `HTTP ${res.status}` });
      return;
    }
    setMsg({ kind: "ok", text: t("阵容已提交", "Lineup submitted") });
    load();
  };

  if (loading) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }
  if (leagueErr || !league) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该联赛。", "League not found.")}
        </main>
      </>
    );
  }
  if (contestErr === "league_not_enabled") {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
            {league.name}
          </div>
          <p>{t("该联赛暂未开放每日竞赛。", "This league is not available for fantasy contest yet.")}</p>
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              background: "#1e3a8a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            {t("查看联赛详情 →", "View League Details →")}
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={contest?.id ?? null} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 12,
          }}
        >
          <h1
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {league.name}
          </h1>
          <LeagueVisibilityBadge visibility={league.visibility} />
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{
              fontSize: 13,
              color: "#1e3a8a",
              fontWeight: 800,
              textDecoration: "none",
            }}
          >
            {t("查看联赛详情 →", "View League Details →")}
          </Link>
        </div>

        {!contest ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "40px 24px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
            <p style={{ margin: 0 }}>
              {t(
                "今日没有比赛。请等待联赛安排下一场比赛后再来。",
                "No games scheduled today. Check back once the league schedules its next game.",
              )}
            </p>
          </div>
        ) : (
          <>
            <ContestHeader contest={contest} />

            <MyLineup
              cap={cap}
              picks={picks}
              poolById={poolById}
              onRemove={removeFromSlot}
              editable={editable}
            />

            <SalaryBar used={salaryUsed} cap={cap} filled={filled} size={contest.lineup_size} />

            <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
              <button
                onClick={save}
                disabled={!editable || busy !== null}
                style={btn(busy === "save", "#1e3a8a", !editable)}
              >
                {busy === "save"
                  ? t("保存中…", "Saving…")
                  : t("保存草稿", "Save draft")}
              </button>
              <button
                onClick={submit}
                disabled={!editable || busy !== null || filled !== contest.lineup_size}
                style={btn(
                  busy === "submit",
                  "var(--gradient-gold, linear-gradient(135deg,#f59e0b,#d97706))",
                  !editable || filled !== contest.lineup_size,
                  "#0a0e1a",
                )}
              >
                {busy === "submit"
                  ? t("提交中…", "Submitting…")
                  : t("提交阵容", "Submit lineup")}
              </button>
              {isSubmitted && (
                <span style={{ alignSelf: "center", color: "#166534", fontSize: 13, fontWeight: 800 }}>
                  ✓ {t("已提交", "Submitted")}
                </span>
              )}
            </div>
            {msg && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  fontWeight: 700,
                  color: msg.kind === "err" ? "#991b1b" : "#166534",
                }}
              >
                {msg.text}
              </div>
            )}

            <PlayerPool
              pool={pool}
              picked={picks.filter((x): x is string => !!x)}
              onToggle={togglePick}
              editable={editable}
            />

            <Leaderboard entries={leaderboard} />
          </>
        )}
      </main>
    </>
  );
}

function ContestHeader({ contest }: { contest: Contest }) {
  const { t } = useLang();
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 18,
        marginBottom: 18,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            fontWeight: 900,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          {t("每日竞赛", "Daily Contest")}
        </div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 2 }}>
          {new Date(`${contest.date}T00:00:00Z`).toLocaleDateString(undefined, {
            weekday: "long",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
        </div>
        {contest.lineup_lock_at && (
          <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>
            {t("锁定时间", "Locks at")}:{" "}
            {new Date(contest.lineup_lock_at).toLocaleString()}
          </div>
        )}
      </div>
      <span
        style={{
          padding: "6px 14px",
          background:
            contest.status === "open"
              ? "#dcfce7"
              : contest.status === "scored"
                ? "#e0e7ff"
                : "#fef3c7",
          color:
            contest.status === "open"
              ? "#166534"
              : contest.status === "scored"
                ? "#3730a3"
                : "#92400e",
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 900,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {contest.status}
      </span>
    </div>
  );
}

function MyLineup({
  picks,
  poolById,
  onRemove,
  editable,
}: {
  picks: (string | null)[];
  poolById: Map<string, PoolPlayer>;
  onRemove: (slotIdx: number) => void;
  cap: number;
  editable: boolean;
}) {
  const { t } = useLang();
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 14,
      }}
    >
      <div
        style={{
          padding: "12px 18px",
          borderBottom: "1px solid #f1f5f9",
          fontWeight: 800,
          color: "#0f172a",
        }}
      >
        {t("我的阵容", "My Lineup")}{" "}
        <span style={{ color: "#94a3b8", fontWeight: 700 }}>
          {picks.filter(Boolean).length}/{picks.length}
        </span>
      </div>
      {picks.map((pid, i) => {
        const player = pid ? poolById.get(pid) : null;
        return (
          <div
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 18px",
              borderTop: i === 0 ? "none" : "1px solid #f1f5f9",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 36,
                fontSize: 11,
                fontWeight: 900,
                color: "#94a3b8",
                letterSpacing: "0.06em",
              }}
            >
              {SLOT_LABELS[i] ?? `S${i + 1}`}
            </span>
            {player ? (
              <>
                <span style={{ flex: 1, fontWeight: 800, color: "#0f172a" }}>
                  {player.name}
                </span>
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {[player.position, player.team_abbr].filter(Boolean).join(" · ")}
                </span>
                <span style={{ fontWeight: 800, color: "#1e3a8a" }}>
                  ${player.salary.toLocaleString()}
                </span>
                {editable && (
                  <button
                    onClick={() => onRemove(i)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#991b1b",
                      cursor: "pointer",
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    ✕
                  </button>
                )}
              </>
            ) : (
              <span style={{ color: "#94a3b8", fontSize: 13 }}>
                {t("从下方球员池选择", "Pick from the pool below")}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SalaryBar({
  used,
  cap,
  filled,
  size,
}: {
  used: number;
  cap: number;
  filled: number;
  size: number;
}) {
  const { t } = useLang();
  const remaining = cap - used;
  const avgRemaining = filled < size ? Math.floor(remaining / (size - filled)) : 0;
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const over = used > cap;
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 14,
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 12,
      }}
    >
      <Stat label={t("已选", "Picked")} value={`${filled}/${size}`} />
      <Stat label={t("已用工资", "Spent")} value={`$${used.toLocaleString()}`} />
      <Stat
        label={t("剩余", "Remaining")}
        value={`$${remaining.toLocaleString()}`}
        color={over ? "#991b1b" : "#166534"}
      />
      <Stat
        label={t("空位均值", "Per slot")}
        value={`$${avgRemaining.toLocaleString()}`}
      />
      <div style={{ gridColumn: "1 / -1", marginTop: 4 }}>
        <div
          style={{
            height: 6,
            borderRadius: 999,
            background: "#f1f5f9",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              background: over ? "#dc2626" : "#1e3a8a",
              transition: "width 0.15s",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 17,
          fontWeight: 900,
          color: color ?? "#0f172a",
          marginTop: 4,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function PlayerPool({
  pool,
  picked,
  onToggle,
  editable,
}: {
  pool: PoolPlayer[];
  picked: string[];
  onToggle: (p: PoolPlayer) => void;
  editable: boolean;
}) {
  const { t } = useLang();
  const pickedSet = new Set(picked);
  if (pool.length === 0) {
    return (
      <div style={{ color: "#94a3b8", marginTop: 24, fontSize: 14, textAlign: "center" }}>
        {t("球员池为空。请联赛管理员先添加球员。", "Player pool is empty. League admin must add players first.")}
      </div>
    );
  }
  return (
    <div style={{ marginTop: 28 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.01em",
          margin: "0 0 12px",
        }}
      >
        {t("球员池", "Player pool")}{" "}
        <span style={{ color: "#94a3b8", fontSize: 13, fontWeight: 700 }}>· {pool.length}</span>
      </h2>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 640 }}
        >
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th()}></th>
              <th style={th()}>{t("球员", "Player")}</th>
              <th style={{ ...th(), textAlign: "center" }}>POS</th>
              <th style={{ ...th(), textAlign: "center" }}>TEAM</th>
              <th style={{ ...th(), textAlign: "center" }}>{t("均值", "FP/G")}</th>
              <th style={{ ...th(), textAlign: "center" }}>GP</th>
              <th style={{ ...th(), textAlign: "right" }}>{t("工资", "Salary")}</th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => {
              const isPicked = pickedSet.has(p.player_id);
              return (
                <tr
                  key={p.player_id}
                  onClick={() => onToggle(p)}
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    cursor: editable ? "pointer" : "default",
                    background: isPicked ? "#eef2ff" : "transparent",
                  }}
                >
                  <td style={{ ...td(), textAlign: "center", width: 28 }}>
                    {isPicked ? "✓" : ""}
                  </td>
                  <td style={td()}>
                    <span style={{ fontWeight: 800, color: "#0f172a" }}>{p.name}</span>
                  </td>
                  <td style={{ ...td(), textAlign: "center", color: "#475569" }}>
                    {p.position ?? "—"}
                  </td>
                  <td style={{ ...td(), textAlign: "center", color: "#475569" }}>
                    {p.team_abbr ?? p.team_name ?? "—"}
                  </td>
                  <td style={{ ...td(), textAlign: "center" }}>{p.season_avg_fp.toFixed(1)}</td>
                  <td style={{ ...td(), textAlign: "center", color: "#94a3b8" }}>{p.games_played}</td>
                  <td style={{ ...td(), textAlign: "right", fontWeight: 900, color: "#1e3a8a" }}>
                    ${p.salary.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Leaderboard({ entries }: { entries: LeaderEntry[] }) {
  const { t } = useLang();
  return (
    <div style={{ marginTop: 32 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.01em",
          margin: "0 0 12px",
        }}
      >
        {t("每日榜", "Daily Board")}
      </h2>
      {entries.length === 0 ? (
        <div style={{ color: "#94a3b8", fontSize: 14 }}>
          {t("尚无提交。", "No submissions yet.")}
        </div>
      ) : (
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
      )}
    </div>
  );
}

function btn(
  busy: boolean,
  bg: string,
  disabled: boolean,
  fg = "#fff",
): React.CSSProperties {
  return {
    minHeight: 44,
    padding: "0 22px",
    background: disabled || busy ? "#94a3b8" : bg,
    color: disabled || busy ? "#fff" : fg,
    border: "none",
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 800,
    cursor: disabled || busy ? "default" : "pointer",
  };
}

function th(): React.CSSProperties {
  return {
    padding: "10px 12px",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textAlign: "left",
  };
}
function td(): React.CSSProperties {
  return { padding: "10px 12px", color: "#0f172a" };
}
