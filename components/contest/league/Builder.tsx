"use client";

// Lineup builder for an authorized basketball league contest.
// Owns local picks/lineup state, save/submit handlers, and the contest
// status header, my-lineup card, salary bar, and player pool grid.

import { useCallback, useEffect, useMemo, useState } from "react";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";
import { contestStatusLabel } from "@/lib/i18n/labels";
import {
  getEligibleSlots,
  SLOT_LABELS as POSITION_SLOT_LABELS,
} from "@/lib/basketball/contest-positions";
import type {
  Contest,
  LineupResponse,
  LineupSlot,
  PoolPlayer,
} from "./types";
import { SLOT_LABELS } from "./types";
import SlotPickerModal from "./SlotPickerModal";

export default function ContestBuilder({ contest }: { contest: Contest }) {
  const { t } = useLang();
  const [pool, setPool] = useState<PoolPlayer[]>([]);
  const [lineup, setLineup] = useState<LineupResponse | null>(null);
  const [picks, setPicks] = useState<(string | null)[]>(
    Array(contest.lineup_size).fill(null),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [slotPicker, setSlotPicker] = useState<{
    player: PoolPlayer;
    eligibleSlots: number[];
  } | null>(null);

  const load = useCallback(async () => {
    const [poolRes, lineupRes] = await Promise.all([
      basketballJson<{ players: PoolPlayer[] }>(
        `/api/basketball-contests/${contest.id}/players`,
      ),
      basketballJson<LineupResponse>(
        `/api/basketball-contests/${contest.id}/lineup`,
      ),
    ]);
    setPool(poolRes.data?.players ?? []);
    if (lineupRes.data) {
      setLineup(lineupRes.data);
      const slots = Array(contest.lineup_size).fill(null) as (string | null)[];
      for (const s of lineupRes.data.players ?? []) {
        if (s.slot >= 0 && s.slot < slots.length) slots[s.slot] = s.player_id;
      }
      setPicks(slots);
    } else {
      setPicks(Array(contest.lineup_size).fill(null));
    }
  }, [contest.id, contest.lineup_size]);

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

  const cap = contest.salary_cap;
  const filled = picks.filter(Boolean).length;
  const isLocked =
    contest.status === "locked" ||
    contest.status === "scored" ||
    (contest.lineup_lock_at !== null &&
      new Date(contest.lineup_lock_at).getTime() <= Date.now());
  const isSubmitted = lineup?.status === "submitted" || lineup?.status === "scored";
  const editable = !isLocked && !isSubmitted;

  const assignToSlot = (player: PoolPlayer, slot: number) => {
    setMsg(null);
    setPicks((prev) => {
      const next = [...prev];
      const existing = next.indexOf(player.player_id);
      if (existing >= 0) next[existing] = null;
      const wouldBe = salaryUsed + player.salary - (existing >= 0 ? player.salary : 0);
      if (wouldBe > cap) {
        setMsg({ kind: "err", text: t("超出工资帽", "Over salary cap") });
        return prev;
      }
      next[slot] = player.player_id;
      return next;
    });
  };

  const togglePick = (player: PoolPlayer) => {
    if (!editable) return;
    setMsg(null);

    // Toggle off if already picked.
    const existing = picks.indexOf(player.player_id);
    if (existing >= 0) {
      setPicks((prev) => {
        const next = [...prev];
        next[existing] = null;
        return next;
      });
      return;
    }

    // Find empty slots this player is eligible for. PG/SG → can fill PG or SG.
    const openSlots: number[] = [];
    for (let i = 0; i < picks.length; i++) {
      if (picks[i] == null) openSlots.push(i);
    }
    if (openSlots.length === 0) {
      setMsg({ kind: "err", text: t("阵容已满", "Lineup is full") });
      return;
    }
    const eligible = getEligibleSlots(player.position, openSlots);
    if (eligible.length === 0) {
      const allEligible = getEligibleSlots(player.position);
      if (allEligible.length === 0) {
        setMsg({
          kind: "err",
          text: t(
            "该球员位置不适合任何位置",
            "This player has no eligible slot",
          ),
        });
      } else {
        setMsg({
          kind: "err",
          text: t(
            "该球员的可用位置已被占用",
            "All eligible slots are already filled",
          ),
        });
      }
      return;
    }
    if (eligible.length === 1) {
      assignToSlot(player, eligible[0]);
      return;
    }
    setSlotPicker({ player, eligibleSlots: eligible });
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
    setBusy("submit");
    setMsg(null);
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

  return (
    <>
      <ContestStatusHeader contest={contest} />

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
        picks={picks}
        onToggle={togglePick}
        editable={editable}
      />

      {slotPicker && (
        <SlotPickerModal
          playerName={slotPicker.player.name}
          eligibleSlots={slotPicker.eligibleSlots}
          onPick={(slot) => {
            assignToSlot(slotPicker.player, slot);
            setSlotPicker(null);
          }}
          onCancel={() => setSlotPicker(null)}
        />
      )}
    </>
  );
}

export function ContestStatusHeader({ contest }: { contest: Contest }) {
  const { t, lang } = useLang();
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
        }}
      >
        {contestStatusLabel(contest.status, lang)}
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
  picks,
  onToggle,
  editable,
}: {
  pool: PoolPlayer[];
  picks: (string | null)[];
  onToggle: (p: PoolPlayer) => void;
  editable: boolean;
}) {
  const { t } = useLang();
  const pickedSet = new Set(picks.filter((x): x is string => !!x));
  const openSlots: number[] = [];
  for (let i = 0; i < picks.length; i++) {
    if (picks[i] == null) openSlots.push(i);
  }
  if (pool.length === 0) {
    return (
      <div style={{ color: "#94a3b8", marginTop: 24, fontSize: 14, textAlign: "center" }}>
        {t(
          "球员池为空。请联赛管理员将参赛球队的球员加入。",
          "Player pool is empty. League admin must roster players to the teams playing today.",
        )}
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
              <th style={{ ...th(), textAlign: "center" }}>{t("可用位置", "Eligible")}</th>
              <th style={{ ...th(), textAlign: "center" }}>TEAM</th>
              <th style={{ ...th(), textAlign: "center" }}>{t("均值", "FP/G")}</th>
              <th style={{ ...th(), textAlign: "center" }}>GP</th>
              <th style={{ ...th(), textAlign: "right" }}>{t("工资", "Salary")}</th>
            </tr>
          </thead>
          <tbody>
            {pool.map((p) => {
              const isPicked = pickedSet.has(p.player_id);
              const openEligible = getEligibleSlots(p.position, openSlots);
              const allEligible = getEligibleSlots(p.position);
              const hasOpenSlot = openEligible.length > 0;
              const clickable = editable && (isPicked || hasOpenSlot);
              return (
                <tr
                  key={p.player_id}
                  onClick={() => onToggle(p)}
                  style={{
                    borderTop: "1px solid #f1f5f9",
                    cursor: clickable ? "pointer" : "not-allowed",
                    background: isPicked ? "#eef2ff" : "transparent",
                    opacity: clickable || isPicked ? 1 : 0.5,
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
                  <td style={{ ...td(), textAlign: "center", color: "#475569", fontSize: 12 }}>
                    {allEligible.length === 0
                      ? "—"
                      : allEligible.map((s) => POSITION_SLOT_LABELS[s]).join("/")}
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
