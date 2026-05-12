"use client";

import { useState, useEffect, useRef } from "react";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { getSessionUser, createInsight, uploadImage } from "@/lib/shared/store";
import PostImageUploader from "@/components/PostImageUploader";
import LineupShareCard, { type SharePlayer } from "@/components/LineupShareCard";
import { translateTeam } from "@/lib/shared/i18n";
import { useLang } from "@/lib/lang";
import { getPlayerDisplayName } from "@/lib/players/player-name-zh";
import { getMyLineup, saveLineup, submitLineup, contestFetch } from "@/lib/fantasy/daily/fetch";
import { isEligibleForContestSlot, SLOT_LABEL, parsePositions } from "@/lib/fantasy/daily/positions";
import {
  SALARY_CAP,
  ROSTER_SIZE,
  computeCapState,
} from "@/lib/fantasy/daily/salary";
import {
  type Tone,
  type Style,
  TONE_VALUES,
  STYLE_VALUES,
  MAX_CUSTOM_INSTRUCTION_LEN,
} from "@/lib/ai/posts/lineup-post/input-safety";
import { track } from "@/lib/shared/analytics";

// ── Types ─────────────────────────────────────────────────────

type Contest = {
  id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string;
  // True for client-synthesized future-date stubs that don't have a DB row.
  // Rendered as "Upcoming" cards so the calendar always shows a future bucket;
  // selecting one shows a "Contest opens closer to game day" panel instead of
  // the lineup builder.
  placeholder?: boolean;
};

type ContestPlayer = {
  player_id: string;
  tier: 1 | 2 | 3 | 4;
  fpts_scored: number | null;
  name: string;
  team: string;
  position: string;
  fpts_avg: number;
  injury: string | null;
  // Salary-cap fields populated by /api/contests/[id]/players (migration 025).
  // Older contests created before the migration will have salary=5000 and
  // projected_points=0 — the UI tolerates that gracefully.
  salary: number;
  projected_points: number;
  last_5_avg_fp: number;
  season_avg_fp: number;
  value: number;
  injury_status: string | null;
  is_available: boolean;
};

// Money formatter used everywhere in the cap UI. Whole-dollar precision and
// a leading $ keeps "$50,000" / "$8,400" readable on a phone-width card.
function fmtMoney(n: number): string {
  const abs = Math.abs(Math.round(n));
  const sign = n < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-US")}`;
}

// ── Constants ─────────────────────────────────────────────────

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const TIER_LABEL: Record<number, [string, string]> = {
  1: ["精英", "Elite"],
  2: ["稳健", "Solid"],
  3: ["价值", "Value"],
  4: ["深水炸弹", "Deep Cut"],
};

const TIER_COLOR: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(245,158,11,0.12)", color: "#d97706", border: "rgba(245,158,11,0.3)" },
  2: { bg: "rgba(59,130,246,0.10)", color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  3: { bg: "rgba(16,185,129,0.10)", color: "#059669", border: "rgba(16,185,129,0.25)" },
  4: { bg: "rgba(100,116,139,0.10)", color: "#64748b", border: "rgba(100,116,139,0.2)" },
};

const STATUS_PILL: Record<string, { bg: string; color: string }> = {
  pending:  { bg: "#fef3c7", color: "#92400e" },
  open:     { bg: "#d1fae5", color: "#065f46" },
  locked:   { bg: "#fee2e2", color: "#991b1b" },
  scored:   { bg: "#dbeafe", color: "#1e40af" },
};

// Calendar-card pill derived from date bucket, not DB status.
const BUCKET_PILL: Record<"past" | "present" | "upcoming", { bg: string; color: string }> = {
  past:     { bg: "#f3f4f6", color: "#6b7280" },
  present:  { bg: "#d1fae5", color: "#065f46" },
  upcoming: { bg: "#fef3c7", color: "#92400e" },
};

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string, lang: "zh" | "en" = "en"): string {
  const d = new Date(iso + "T00:00:00");
  if (lang === "zh") {
    const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${d.getMonth() + 1}月${d.getDate()}日 ${weekdays[d.getDay()]}`;
  }
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function formatDateShort(iso: string, lang: "zh" | "en" = "en"): string {
  const d = new Date(iso + "T00:00:00");
  if (lang === "zh") {
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getBucketLabel(bucket: "past" | "present" | "upcoming", lang: "zh" | "en"): string {
  if (lang === "zh") {
    return bucket === "past" ? "已结束" : bucket === "present" ? "开放中" : "未开始";
  }
  return bucket === "past" ? "Past" : bucket === "present" ? "Open" : "Upcoming";
}

function getStatusLabel(status: string, lang: "zh" | "en"): string {
  const map: Record<string, [string, string]> = {
    pending: ["未开始", "Upcoming"],
    open:    ["开放中", "Open"],
    locked:  ["已锁定", "Locked"],
    scored:  ["已结算", "Scored"],
  };
  const pair = map[status];
  if (!pair) return status;
  return lang === "zh" ? pair[0] : pair[1];
}

// ── Page ──────────────────────────────────────────────────────

export default function ContestPage() {
  const { lang, t } = useLang();

  // Auth
  const [user] = useState(() => getSessionUser());

  // Contest data
  // `allContests` holds the ±14-day window from /api/contests/nearby.
  // `contest` is the currently selected contest (feeds lineup + player pool UI).
  const [allContests, setAllContests] = useState<Contest[]>([]);
  const [contest, setContest] = useState<Contest | null>(null);
  const [players, setPlayers] = useState<ContestPlayer[]>([]);

  // Lineup: array of 5 player_ids (null = empty slot)
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null, null]);
  const [lineupStatus, setLineupStatus] = useState<string>("draft");

  // Multi-position slot picker modal state
  const [slotPickModal, setSlotPickModal] = useState<{
    player: ContestPlayer;
    eligibleSlots: number[]; // 0-based slot indices
  } | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [posFilter, setPosFilter] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [now, setNow] = useState(new Date());

  // Placeholder-resolution state. When a user clicks an upcoming placeholder
  // card we hit /api/contests/by-date to ask BDL whether games are scheduled
  // and (if so) lazily create the contest row + player pool. Until that
  // resolves, `resolvingPlaceholder` drives a "checking schedule…" panel.
  // `noGamesForPlaceholder` is set when BDL says no games are scheduled.
  const [resolvingPlaceholder, setResolvingPlaceholder] = useState(false);
  const [noGamesForPlaceholder, setNoGamesForPlaceholder] = useState(false);

  // Player-pool fetch error. When non-null, the pool area renders a
  // diagnostic banner instead of "no players match your filter" so the user
  // can tell apart a real empty pool from a transport / schema problem
  // (e.g., a missing migration on the deployed DB).
  const [playersError, setPlayersError] = useState<string | null>(null);

  // Set when the players API confirms that no games are scheduled for this
  // date in the current BDL schedule (stale playoff pool that was cleared).
  const [noConfirmedGames, setNoConfirmedGames] = useState(false);

  // ── AI lineup post state ─────────────────────────────────────
  const [aiOpen, setAiOpen] = useState(false);
  const [aiTone, setAiTone] = useState<Tone>("analytical");
  const [aiStyle, setAiStyle] = useState<Style>("hupu");
  const [aiCustom, setAiCustom] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiVersions, setAiVersions] = useState<{ style: string; post: string }[] | null>(null);
  const [aiCustomIgnored, setAiCustomIgnored] = useState(false);
  const [aiSelectedIdx, setAiSelectedIdx] = useState<number | null>(null);
  const [aiEditTitle, setAiEditTitle] = useState("");
  const [aiEditBody, setAiEditBody] = useState("");
  const [aiInitialBody, setAiInitialBody] = useState("");
  const [aiEditedTracked, setAiEditedTracked] = useState(false);
  const [aiPublishing, setAiPublishing] = useState(false);
  const [aiPostImages, setAiPostImages]         = useState<string[]>([]);
  const [aiPostUploading, setAiPostUploading]   = useState(false);
  const lineupShareCardRef = useRef<HTMLDivElement>(null);

  // ── Clock ───────────────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Initial load ────────────────────────────────────────────
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setPageError(null);
    try {
      // 1. Fetch the nearby window (±14 days). Single source of truth for
      //    the page — never 404s; an empty window returns { contests: [] }.
      const nr = await fetch("/api/contests/nearby");
      if (!nr.ok) {
        setPageError("Failed to load contests.");
        return;
      }
      const { contests } = (await nr.json()) as { contests: Contest[] };
      setAllContests(contests);

      // 2. Pick a sensible selectedContest: prefer today, else next upcoming,
      //    else most recent past. Only dead-ends when the window is empty.
      const todayStr = new Date().toISOString().slice(0, 10);
      const selectedContest =
        contests.find((x) => x.date === todayStr) ??
        contests.find((x) => x.date > todayStr) ??
        [...contests].reverse().find((x) => x.date < todayStr) ??
        null;

      if (!selectedContest) {
        setPageError("No contests scheduled nearby. Check back soon.");
        return;
      }
      await loadContestDetail(selectedContest);
    } catch {
      setPageError("Network error. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  // Guards against stale fetch responses when the user rapidly switches
  // between contest cards. Only responses for the latest-requested contest
  // id are allowed to write into state.
  const requestedContestIdRef = useRef<string | null>(null);

  // Loads player pool + user's lineup for a given contest and sets it as
  // the selected contest. Used by both initial load() and card clicks.
  async function loadContestDetail(c: Contest) {
    requestedContestIdRef.current = c.id;
    setContest(c);
    // Reset per-contest state so switching doesn't bleed across contests.
    setSlots([null, null, null, null, null]);
    setLineupStatus("draft");
    setPlayers([]);
    // Also reset player-pool filters — the previous contest's search/tier/
    // position selection has no meaning against the new pool.
    setSearch("");
    setTierFilter(null);
    setPosFilter(null);
    setNoGamesForPlaceholder(false);
    setResolvingPlaceholder(false);
    setPlayersError(null);
    setNoConfirmedGames(false);

    // Placeholder upcoming card (no DB row yet) — ask the by-date resolver
    // whether games are scheduled. If yes, it creates the contest stub and
    // returns a real row; we then load it like any other contest. If no
    // games, surface the no-games panel instead of the lineup builder.
    let real: Contest = c;
    if (c.placeholder) {
      setResolvingPlaceholder(true);
      try {
        const r = await fetch(`/api/contests/by-date?date=${encodeURIComponent(c.date)}`);
        if (requestedContestIdRef.current !== c.id) return;
        const json = await r.json().catch(() => null);
        if (!r.ok || !json) {
          setResolvingPlaceholder(false);
          return;
        }
        if (json.noGames) {
          setNoGamesForPlaceholder(true);
          setResolvingPlaceholder(false);
          return;
        }
        if (!json.contest) {
          setResolvingPlaceholder(false);
          return;
        }
        real = json.contest as Contest;
        // Replace the synthetic placeholder in the calendar so subsequent
        // renders / clicks see the real row directly.
        setAllContests((prev) => {
          const without = prev.filter((x) => x.date !== real.date);
          return [...without, real].sort((a, b) => a.date.localeCompare(b.date));
        });
        requestedContestIdRef.current = real.id;
        setContest(real);
      } finally {
        setResolvingPlaceholder(false);
      }
    }

    const pr = await fetch(`/api/contests/${real.id}/players`);
    if (requestedContestIdRef.current !== real.id) return;
    if (pr.ok) {
      const { players: pool, noConfirmedGames: noGames } = await pr.json();
      setPlayers(pool ?? []);
      setNoConfirmedGames(!!noGames);
      setPlayersError(null);
    } else {
      // Surface the upstream error so an empty pool is debuggable instead
      // of looking identical to an over-filtered list. The most common
      // cause is a missing column on the deployed DB (migration 025 not
      // yet applied).
      const body = await pr.json().catch(() => null);
      setPlayersError(body?.error ?? `HTTP ${pr.status}`);
      setPlayers([]);
    }

    if (user) {
      const { data } = await getMyLineup(real.id);
      if (requestedContestIdRef.current !== real.id) return;
      if (data) {
        const next: (string | null)[] = [null, null, null, null, null];
        for (const p of data.players) next[p.slot - 1] = p.player_id;
        setSlots(next);
        setLineupStatus(data.status);
      }
    }
  }

  // ── Derived ─────────────────────────────────────────────────
  // Lineup composition is governed by the salary cap, not tier quotas.
  // Tier remains a display / filter aid (badge + filter pill) but no longer
  // affects validity. Cap math lives in lib/contest-salary.ts and is
  // mirrored server-side by app/api/contests/[id]/lineup/route.ts.

  const filledCount   = slots.filter(Boolean).length;
  const inLineup      = new Set(slots.filter(Boolean) as string[]);
  const playerMap     = new Map(players.map((p) => [p.player_id, p]));

  // Contest bucket — derived from contest.date vs today (UTC). Drives
  // bucket-aware CTA/header wording; reactive via the existing clock.
  const todayUtc = now.toISOString().slice(0, 10);
  const bucket: "past" | "present" | "upcoming" | null = contest
    ? (contest.date < todayUtc ? "past"
      : contest.date > todayUtc ? "upcoming"
      : "present")
    : null;

  // Player editing locks at the first game tip-off (lineup_lock_at) or once
  // the contest header has flipped to locked/scored. We don't add a separate
  // "is the date in the past" check here because for any past date its
  // lineup_lock_at is already in the past too, so the time comparison covers
  // it — duplicating the check would just shadow data integrity bugs.
  const isPastDeadline = contest
    ? contest.status === "locked" || contest.status === "scored" || now >= new Date(contest.lineup_lock_at)
    : false;
  const isReadOnly    = isPastDeadline || lineupStatus === "locked" || lineupStatus === "scored";
  const isSubmitted   = lineupStatus === "submitted" || lineupStatus === "locked" || lineupStatus === "scored";
  const canEdit       = !!user && !isReadOnly;

  // Bucketed views over the full nearby window — feed the Past/Today/Upcoming
  // section cards above the existing contest detail pane.
  const pastContests = allContests.filter((c) => c.date < todayUtc).reverse();
  const realPresent  = allContests.find((c) => c.date === todayUtc) ?? null;
  const realUpcoming = allContests.filter((c) => c.date > todayUtc);

  // Synthesize a placeholder for TODAY when no DB row exists yet. The morning
  // create-today cron normally seeds it at 14:00 UTC, but the section must
  // still render before then (or if the cron failed). Clicking calls the
  // same /api/contests/by-date resolver as upcoming placeholders.
  const presentContest: Contest = realPresent ?? {
    id: `placeholder-${todayUtc}`,
    date: todayUtc,
    status: "pending",
    lineup_lock_at: `${todayUtc}T23:00:00Z`,
    placeholder: true,
  };

  // Synthesize placeholder cards for the next 7 days that don't have a DB row,
  // so the "Upcoming" section is always visible even when the seed-upcoming
  // cron hasn't seeded yet. Clicking calls /api/contests/by-date which
  // resolves the date against BDL — either pulling an existing contest,
  // creating one if games are scheduled, or surfacing a no-games panel.
  const UPCOMING_PLACEHOLDER_DAYS = 7;
  const placeholderUpcoming: Contest[] = (() => {
    const haveDates = new Set(realUpcoming.map((c) => c.date));
    const out: Contest[] = [];
    const base = new Date(todayUtc + "T00:00:00Z");
    for (let i = 1; i <= UPCOMING_PLACEHOLDER_DAYS; i++) {
      const d = new Date(base);
      d.setUTCDate(base.getUTCDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      if (haveDates.has(dateStr)) continue;
      out.push({
        id: `placeholder-${dateStr}`,
        date: dateStr,
        status: "pending",
        lineup_lock_at: `${dateStr}T23:00:00Z`,
        placeholder: true,
      });
    }
    return out;
  })();
  const upcomingContests = [...realUpcoming, ...placeholderUpcoming]
    .sort((a, b) => a.date.localeCompare(b.date));

  const isPlaceholder = !!contest?.placeholder;

  // Salary-cap state: live total, remaining budget, per-empty-slot average.
  // Drives the cap counter UI and gates the Save / Submit buttons.
  const lineupSalaries = slots.map((pid) => (pid ? playerMap.get(pid)?.salary ?? 0 : 0));
  const capState = computeCapState(lineupSalaries);
  const lineupComplete = filledCount === ROSTER_SIZE;
  const lineupValid    = lineupComplete && !capState.overCap;

  // Base positions for the filter pills — always the five canonical slots,
  // independent of what combo strings are stored in player_stats_cache.
  const BASE_POSITIONS = ["PG", "SG", "SF", "PF", "C"] as const;

  const filtered = players.filter((p) => {
    if (tierFilter !== null && p.tier !== tierFilter) return false;
    // Position filter: use parsePositions so "PG/SG" matches both PG and SG filters.
    if (posFilter !== null && !parsePositions(p.position).includes(posFilter.toLowerCase())) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Flat salary-DESC list — replaces the tier-grouped layout. Tier is now a
  // small badge on each row, and the tier filter pill above the list is
  // sufficient for narrowing down by tier when the user wants to.
  const sortedPool = [...filtered].sort((a, b) => b.salary - a.salary);

  // ── Interactions ────────────────────────────────────────────

  // Toggle player in/out of lineup.
  // For multi-position players (e.g. "PF/C") with multiple eligible empty slots,
  // shows a picker modal instead of auto-assigning to the first eligible slot.
  function togglePlayer(pid: string) {
    if (!canEdit) return;

    if (slots.includes(pid)) {
      setSlots((prev) => prev.map((id) => (id === pid ? null : id)));
      return;
    }

    const player = playerMap.get(pid);
    if (!player) return;

    if (player.is_available === false) {
      const displayName = getPlayerDisplayName(player, lang);
      showFlash("err", t(
        `${displayName} 当日不可用。`,
        `${player.name} is unavailable for this contest.`,
      ));
      return;
    }

    const projectedTotal = capState.totalSalary + (player.salary || 0);
    if (projectedTotal > SALARY_CAP) {
      const over = projectedTotal - SALARY_CAP;
      const displayName = getPlayerDisplayName(player, lang);
      showFlash("err", t(
        `加上 ${displayName}（${fmtMoney(player.salary)}）会超出工资帽 ${fmtMoney(over)}。`,
        `Adding ${player.name} (${fmtMoney(player.salary)}) would exceed the cap by ${fmtMoney(over)}.`,
      ));
      return;
    }

    // Collect ALL eligible empty slot indices (0-based).
    const eligibleSlots = slots
      .map((id, i) => (id === null && isEligibleForContestSlot(player.position, i + 1) ? i : -1))
      .filter((i) => i !== -1);

    if (eligibleSlots.length === 0) {
      const pos = player.position === "N/A" ? (lang === "zh" ? "未知位置" : "unknown position") : player.position;
      const displayName = getPlayerDisplayName(player, lang);
      showFlash("err", t(
        `${displayName}（${pos}）没有可用的位置。`,
        `${player.name} (${pos}) doesn't fit any open slot.`,
      ));
      return;
    }

    if (eligibleSlots.length === 1) {
      const idx = eligibleSlots[0];
      setSlots((prev) => { const next = [...prev]; next[idx] = pid; return next; });
      return;
    }

    // Multiple eligible slots — ask the user to choose.
    setSlotPickModal({ player, eligibleSlots });
  }

  function placeInSlot(pid: string, slotIdx: number) {
    setSlots((prev) => { const next = [...prev]; next[slotIdx] = pid; return next; });
    setSlotPickModal(null);
  }

  function removeSlot(idx: number) {
    if (!canEdit) return;
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
  }

  function showFlash(type: "ok" | "err", msg: string) {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 3000);
  }

  // ── Save draft ───────────────────────────────────────────────

  async function handleSave() {
    if (!contest || !user || saving) return;
    const picks = slots
      .map((id, i) => (id ? { slot: i + 1, player_id: id } : null))
      .filter(Boolean) as { slot: number; player_id: string }[];
    if (picks.length !== ROSTER_SIZE) {
      showFlash("err", t("请选满 5 名球员后再保存。", "Fill all 5 slots to save."));
      return;
    }
    if (capState.overCap) {
      showFlash("err", t(
        `工资超出 ${fmtMoney(-capState.remaining)}。`,
        `Lineup is ${fmtMoney(-capState.remaining)} over the salary cap.`,
      ));
      return;
    }
    setSaving(true);
    const { error } = await saveLineup(contest.id, picks);
    setSaving(false);
    if (error) {
      const msgs: Record<string, string> = {
        unauthorized:                          t("请登录后再保存。", "Log in to save your lineup."),
        contest_locked:                        t("比赛已锁定，无法编辑。", "Contest is locked — edits not allowed."),
        "salary cap exceeded":                 t("工资超出上限。", "Lineup exceeds the salary cap."),
        "one or more players not available":   t("阵容中存在不可用球员。", "One or more players are not available."),
      };
      showFlash("err", msgs[error] ?? error);
    } else {
      showFlash("ok", t("草稿已保存。", "Draft saved."));
    }
  }

  // ── Submit ───────────────────────────────────────────────────

  async function handleSubmit() {
    if (!contest || !user || !canEdit || !lineupValid || submitting) return;
    setSubmitting(true);

    // Save first, then submit
    const picks = slots.map((id, i) => ({ slot: i + 1, player_id: id! }));
    const saveResult = await saveLineup(contest.id, picks);
    if (saveResult.error) {
      const msgs: Record<string, string> = {
        unauthorized:                          t("请登录后再提交。", "Log in to submit."),
        contest_locked:                        t("比赛已锁定。", "Contest is locked."),
        "salary cap exceeded":                 t("工资超出上限。", "Lineup exceeds the salary cap."),
        "one or more players not available":   t("阵容中存在不可用球员。", "One or more players are not available."),
      };
      showFlash("err", msgs[saveResult.error] ?? saveResult.error);
      setSubmitting(false);
      return;
    }

    const subResult = await submitLineup(contest.id);
    setSubmitting(false);
    if (subResult.error) {
      const msgs: Record<string, string> = {
        unauthorized:                          t("请登录后再提交。", "Log in to submit."),
        contest_locked:                        t("比赛已锁定，无法提交。", "Contest is locked — lineups can no longer be submitted."),
        lineup_locked:                         t("阵容已锁定。", "Your lineup is already locked."),
        incomplete_lineup:                     t("请选择 5 名球员。", "Select exactly 5 players."),
        "salary cap exceeded":                 t("工资超出上限。", "Lineup exceeds the salary cap."),
        "one or more players not available":   t("阵容中存在不可用球员。", "One or more players are not available."),
      };
      showFlash("err", msgs[subResult.error] ?? subResult.error);
    } else {
      setLineupStatus("submitted");
      showFlash("ok", t("阵容已提交！祝你好运 🎯", "Lineup submitted! Good luck 🎯"));
    }
  }

  // ── AI lineup post helpers ───────────────────────────────────

  function buildAiLineupPayload() {
    if (!contest) return null;
    const items: { slot: string; playerId: string; name: string; team: string; position: string; projFpts?: number }[] = [];
    slots.forEach((pid, idx) => {
      if (!pid) return;
      const p = playerMap.get(pid);
      if (!p) return;
      const item: { slot: string; playerId: string; name: string; team: string; position: string; projFpts?: number } = {
        slot: SLOT_LABEL[idx + 1],
        playerId: p.player_id,
        name: p.name,
        team: p.team,
        position: p.position,
      };
      if (typeof p.fpts_avg === "number" && Number.isFinite(p.fpts_avg)) {
        item.projFpts = Math.round(p.fpts_avg * 10) / 10;
      }
      items.push(item);
    });
    if (items.length === 0) return null;
    return { lineup: items, contestDate: contest.date };
  }

  function resetAiState() {
    setAiVersions(null);
    setAiCustomIgnored(false);
    setAiSelectedIdx(null);
    setAiEditTitle("");
    setAiEditBody("");
    setAiInitialBody("");
    setAiEditedTracked(false);
    setAiError(null);
    setAiPostImages([]);
    setAiPostUploading(false);
  }

  async function generateAndUploadLineupImage(): Promise<string | null> {
    const el = lineupShareCardRef.current;
    if (!el) return null;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, { cacheBust: true, backgroundColor: "#ffffff", pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `lineup-${contest?.id ?? "post"}-${Date.now()}.png`, { type: "image/png" });
      const result = await uploadImage(file, "posts");
      return result.ok ? result.url : null;
    } catch {
      return null;
    }
  }

  function discardAiPost(reason: "user_close" | "after_publish") {
    if (reason === "user_close" && aiVersions) {
      track("ai_post_discarded", { hadSelection: aiSelectedIdx !== null });
    }
    resetAiState();
    setAiOpen(false);
  }

  async function handleAiGenerate() {
    if (aiGenerating) return;
    const payload = buildAiLineupPayload();
    if (!payload) {
      setAiError(t("请先填满 5 个阵容位", "Fill all 5 lineup slots first"));
      return;
    }
    const trimmedCustom = aiCustom.trim();
    track("ai_post_generate_clicked", {
      tone: aiTone,
      style: aiStyle,
      hasCustom: trimmedCustom.length > 0,
    });
    setAiError(null);
    setAiGenerating(true);
    setAiVersions(null);
    setAiCustomIgnored(false);
    setAiSelectedIdx(null);

    try {
      const res = await contestFetch("/api/ai/generate-lineup-post", {
        method: "POST",
        body: JSON.stringify({
          language: lang,
          tone: aiTone,
          style: aiStyle,
          contestDate: payload.contestDate,
          lineup: payload.lineup,
          customInstruction: trimmedCustom,
          generateCount: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const code = data?.error ?? `HTTP ${res.status}`;
        const map: Record<string, string> = {
          unauthorized: t("请登录后再生成", "Log in to generate."),
          AI_NOT_CONFIGURED: t("AI 服务暂未配置", "AI service is not configured."),
          RATE_LIMITED: t("请求太频繁，稍后再试", "Too many requests, try again shortly."),
          AI_OUTPUT_SHAPE: t("AI 返回格式异常，请重试", "Unexpected AI output, please retry."),
          AI_UPSTREAM_ERROR: t("AI 服务暂时不可用", "AI service temporarily unavailable."),
          EMPTY_LINEUP: t("阵容为空", "Lineup is empty."),
        };
        setAiError(map[code] ?? code);
        return;
      }
      const versions = data.versions as { style: string; post: string }[];
      const accepted = data.customInstructionAccepted as boolean;
      setAiVersions(versions);
      setAiCustomIgnored(trimmedCustom.length > 0 && accepted === false);
      if (trimmedCustom.length > 0) {
        track("ai_post_custom_instruction_used", { accepted });
      }
    } catch {
      setAiError(t("网络错误，请重试", "Network error, please retry."));
    } finally {
      setAiGenerating(false);
    }
  }

  function selectAiVersion(idx: number) {
    if (!aiVersions) return;
    const v = aiVersions[idx];
    if (!v) return;
    track("ai_post_version_selected", { style: v.style, index: idx });
    const fallbackTitleZh = `${formatDate(contest!.date, "zh")} 我的阵容`;
    const fallbackTitleEn = `My ${formatDateShort(contest!.date, "en")} lineup`;
    setAiSelectedIdx(idx);
    setAiEditTitle(lang === "zh" ? fallbackTitleZh : fallbackTitleEn);
    setAiEditBody(v.post);
    setAiInitialBody(v.post);
    setAiEditedTracked(false);
  }

  function onAiBodyChange(next: string) {
    setAiEditBody(next);
    if (!aiEditedTracked && next !== aiInitialBody) {
      track("ai_post_edited");
      setAiEditedTracked(true);
    }
  }

  async function publishAiPost() {
    if (aiPublishing) return;
    if (!aiEditTitle.trim()) {
      setAiError(t("请输入标题", "Please enter a title"));
      return;
    }
    setAiPublishing(true);
    setAiError(null);

    // If user uploaded images, use them; otherwise auto-generate a lineup card image.
    let finalImages = aiPostImages;
    let autoGenFailed = false;
    if (finalImages.length === 0) {
      const autoUrl = await generateAndUploadLineupImage();
      if (autoUrl) {
        finalImages = [autoUrl];
      } else {
        autoGenFailed = true;
      }
    }

    const result = await createInsight({
      title:     aiEditTitle,
      body:      aiEditBody.trim() || aiInitialBody,
      cover_url: finalImages[0],
      images:    finalImages.length > 0 ? finalImages : undefined,
    });
    setAiPublishing(false);
    if (!result.ok) {
      setAiError(result.error || t("发布失败", "Publish failed"));
      return;
    }
    track("ai_post_published", {
      tone: aiTone,
      style: aiStyle,
      versionStyle: aiVersions?.[aiSelectedIdx ?? 0]?.style,
      hasAutoImage: finalImages.length > 0 && aiPostImages.length === 0,
    });
    const msg = autoGenFailed
      ? t("已发布（阵容配图生成失败，仅发布文字）", "Published (lineup image failed — text only)")
      : t("已发布到 Insights", "Published to Insights");
    showFlash("ok", msg);
    discardAiPost("after_publish");
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav scope={{ kind: "nba" }} contestId={contest?.id ?? null} />

      {/* ── Flash toast ─────────────────────────────────────── */}
      {flash && (
        <div style={{
          position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
          zIndex: 999, padding: "12px 20px",
          background: flash.type === "ok" ? "#065f46" : "#991b1b",
          color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 600,
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)", whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 32px)", textAlign: "center",
        }}>
          {flash.msg}
        </div>
      )}

      <main style={{ maxWidth: 480, margin: "0 auto", paddingBottom: 80 }}>

        {/* ── Past / Today / Upcoming section cards ──────────── */}
        {/* Clicking a card switches selectedContest via loadContestDetail. */}
        {pastContests.length > 0 && (
          <ContestSection
            label={t("已结束", "Past")}
            contests={pastContests}
            selectedId={contest?.id ?? null}
            onSelect={loadContestDetail}
            bucket="past"
            lang={lang}
          />
        )}
        <ContestSection
          label={t("今天", "Today")}
          contests={[presentContest]}
          selectedId={contest?.id ?? null}
          onSelect={loadContestDetail}
          highlight
          bucket="present"
          lang={lang}
        />
        {upcomingContests.length > 0 && (
          <ContestSection
            label={t("即将开赛", "Upcoming")}
            contests={upcomingContests}
            selectedId={contest?.id ?? null}
            onSelect={loadContestDetail}
            bucket="upcoming"
            lang={lang}
          />
        )}

        {/* ── Contest header ──────────────────────────────────── */}
        {contest && (
          <div style={{
            background: "#fff", borderBottom: "1px solid #e5e7eb",
            padding: "16px 16px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase" }}>
                  {bucket === "past" ? t("历史竞赛", "Past Contest")
                    : bucket === "upcoming" ? t("即将开赛", "Upcoming Contest")
                    : t("每日竞赛", "Daily Contest")}
                </span>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 2 }}>
                  {formatDate(contest.date, lang)}
                </div>
              </div>
              {/* Status pill — past dates always show "Past" so the header
                  matches the calendar card; today/future fall back to DB status. */}
              {(() => {
                const headerPill = bucket === "past"
                  ? BUCKET_PILL.past
                  : (STATUS_PILL[contest.status] ?? { bg: "#f3f4f6", color: "#374151" });
                const headerLabel = bucket === "past"
                  ? getBucketLabel("past", lang)
                  : getStatusLabel(contest.status, lang);
                return (
                  <span style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: headerPill.bg,
                    color:      headerPill.color,
                  }}>
                    {headerLabel}
                  </span>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────── */}
        {loading && (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            {t("加载中…", "Loading contest…")}
          </div>
        )}

        {/* ── Page error ──────────────────────────────────────── */}
        {!loading && pageError && (
          <div style={{ padding: "32px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "24px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏀</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                {pageError}
              </div>
            </div>
          </div>
        )}

        {/* ── Placeholder upcoming states ─────────────────────── */}
        {/* While resolving via /api/contests/by-date — checks BDL + lazily
            creates the contest stub. */}
        {!loading && !pageError && contest && isPlaceholder && resolvingPlaceholder && (
          <div style={{ padding: "24px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "28px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 14, color: "#6b7280" }}>
                {t("正在检查赛程…", "Checking schedule…")}
              </div>
            </div>
          </div>
        )}

        {/* BDL has no scheduled games for this date. */}
        {!loading && !pageError && contest && isPlaceholder && !resolvingPlaceholder && noGamesForPlaceholder && (
          <div style={{ padding: "24px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "28px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏀</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                {t("当日无比赛", "No games scheduled")}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {t(
                  "这一天没有 NBA 比赛，无法创建每日竞赛。",
                  "There are no NBA games on this date, so no daily contest is available.",
                )}
              </div>
            </div>
          </div>
        )}

        {/* Resolver returned no contest and no noGames flag (e.g. network
            error). Fall back copy depends on bucket so a today-placeholder
            doesn't read like a future date. */}
        {!loading && !pageError && contest && isPlaceholder && !resolvingPlaceholder && !noGamesForPlaceholder && (
          <div style={{ padding: "24px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "28px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                {bucket === "present"
                  ? t("竞赛准备中", "Contest is being prepared")
                  : t("竞赛尚未开放", "Contest opens closer to game day")}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {bucket === "present"
                  ? t(
                      "今日竞赛即将开放，请稍后刷新。",
                      "Today's contest is being prepared. Please refresh in a moment.",
                    )
                  : t(
                      "球员池将在比赛日前一天准备好，请稍后再来选阵容。",
                      "The player pool is prepared the day before tip-off. Check back closer to game day to build your lineup.",
                    )}
              </div>
            </div>
          </div>
        )}

        {/* ── Main content ────────────────────────────────────── */}
        {!loading && !pageError && contest && !isPlaceholder && (
          <>
            {/* ── Not logged in banner ──────────────────────── */}
            {!user && (
              <div style={{
                margin: "12px 16px 0", padding: "12px 16px",
                background: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: 10, fontSize: 13, color: "#1e3a8a", fontWeight: 500,
              }}>
                <a href="/auth/login" style={{ fontWeight: 700, color: "#1d4ed8" }}>{t("登录", "Log in")}</a>
                {" "}{t("以保存并提交阵容。", "to save and submit your lineup.")}
              </div>
            )}

            {/* ── Locked banner ─────────────────────────────── */}
            {isReadOnly && (
              <div style={{
                margin: "12px 16px 0", padding: "12px 16px",
                background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 10, fontSize: 13, color: "#991b1b", fontWeight: 600,
              }}>
                {contest.status === "scored"
                  ? t("比赛已结算，查看你的得分。", "Results are in — see your score below.")
                  : bucket === "past"
                  ? t("正在查看已提交阵容，本次竞赛已结束。", "Viewing your submitted lineup — this contest has ended.")
                  : t("阵容已锁定，等待结果。", "Lineup locked. Awaiting results.")}
              </div>
            )}

            {/* ── Lineup builder ────────────────────────────── */}
            <div style={{
              background: "#fff", margin: "12px 16px 0",
              border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden",
            }}>
              <div style={{
                padding: "12px 16px", borderBottom: "1px solid #f3f4f6",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
                  {isReadOnly && isSubmitted ? t("我的已提交阵容", "My Submitted Lineup") : t("我的阵容", "My Lineup")}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {t(`已选 ${filledCount}/5`, `${filledCount}/5 selected`)}
                </span>
              </div>

              {/* Slots */}
              {slots.map((pid, idx) => {
                const p = pid ? playerMap.get(pid) : null;
                const tc = p ? TIER_COLOR[p.tier] : null;
                return (
                  <div key={idx} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 16px",
                    borderBottom: idx < 4 ? "1px solid #f3f4f6" : "none",
                    background: p ? "#fafafa" : "#fff",
                  }}>
                    {/* Slot position label (PG / SG / SF / PF / C) */}
                    <span style={{
                      width: 30, height: 22, borderRadius: 4,
                      background: p ? "#1e3a8a" : "#f3f4f6",
                      color: p ? "#fff" : "#9ca3af",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, flexShrink: 0,
                    }}>
                      {SLOT_LABEL[idx + 1]}
                    </span>

                    {p ? (
                      <>
                        <PlayerAvatar name={p.name} size={28} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {getPlayerDisplayName(p, lang)}
                          </div>
                          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1 }}>
                            {translateTeam(p.team, lang)} · {p.position}
                          </div>
                        </div>

                        {/* Tier badge */}
                        {tc && (
                          <span style={{
                            padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
                            background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
                            flexShrink: 0,
                          }}>
                            T{p.tier}
                          </span>
                        )}

                        {/* Score (if contest is scored) */}
                        {contest.status === "scored" && p.fpts_scored !== null && (
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#059669", flexShrink: 0 }}>
                            {p.fpts_scored.toFixed(1)}
                          </span>
                        )}

                        {/* Remove button */}
                        {canEdit && (
                          <button
                            onClick={() => removeSlot(idx)}
                            style={{
                              width: 22, height: 22, borderRadius: "50%",
                              background: "#fee2e2", border: "none", cursor: "pointer",
                              color: "#dc2626", fontSize: 14, lineHeight: 1,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              flexShrink: 0,
                            }}
                            aria-label="Remove player"
                          >
                            ×
                          </button>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 13, color: "#9ca3af", flex: 1 }}>
                        {t(`请选一位 ${SLOT_LABEL[idx + 1]}`, `Select a ${SLOT_LABEL[idx + 1]} below`)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Salary-cap counter ────────────────────────── */}
            {/* Live cap state: filled/5, used $, remaining $, avg per empty
                slot. Mirrors lib/contest-salary.ts; server re-validates. */}
            {user && !isReadOnly && (
              <div style={{
                margin: "10px 16px 0", padding: "12px 14px",
                background: "#f8fafc", border: `1px solid ${capState.overCap ? "#fecaca" : "#e5e7eb"}`,
                borderRadius: 10,
              }}>
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
                  gap: 8, fontSize: 11,
                }}>
                  <CapStat
                    label={t("已选", "Filled")}
                    value={`${capState.filled}/${ROSTER_SIZE}`}
                    tone={lineupComplete ? "ok" : "neutral"}
                  />
                  <CapStat
                    label={t("已用工资", "Salary used")}
                    value={fmtMoney(capState.totalSalary)}
                    tone={capState.overCap ? "err" : "neutral"}
                  />
                  <CapStat
                    label={t("剩余", "Remaining")}
                    value={fmtMoney(capState.remaining)}
                    tone={capState.overCap ? "err" : capState.remaining < 1000 ? "warn" : "ok"}
                  />
                  <CapStat
                    label={t("空位均值", "Avg / empty")}
                    value={capState.emptySlots > 0 ? fmtMoney(capState.avgPerEmptySlot) : "—"}
                    tone="neutral"
                  />
                </div>

                {/* Inline error: cap exceeded or lineup incomplete. Submit
                    button is disabled in either state — this line tells the
                    user exactly what to fix. */}
                {capState.overCap ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#991b1b", fontWeight: 600 }}>
                    {t(
                      `超出工资帽 ${fmtMoney(-capState.remaining)}。`,
                      `Over the salary cap by ${fmtMoney(-capState.remaining)}.`,
                    )}
                  </div>
                ) : !lineupComplete ? (
                  <div style={{ marginTop: 8, fontSize: 12, color: "#92400e", fontWeight: 600 }}>
                    {t(
                      `还需选择 ${ROSTER_SIZE - capState.filled} 名球员。`,
                      `Pick ${ROSTER_SIZE - capState.filled} more player${ROSTER_SIZE - capState.filled === 1 ? "" : "s"} to submit.`,
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* ── Action buttons ────────────────────────────── */}
            {user && !isReadOnly && (
              <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || !lineupValid}
                  style={{
                    flex: 1, padding: "11px 0",
                    background: "#fff", border: "1px solid #d1d5db",
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: lineupValid ? "#374151" : "#9ca3af",
                    cursor: lineupValid && !saving ? "pointer" : "not-allowed",
                    opacity: lineupValid ? 1 : 0.5,
                    transition: "all 0.15s",
                  }}
                >
                  {saving ? t("保存中…", "Saving…") : t("保存草稿", "Save Draft")}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!canEdit || !lineupValid || submitting}
                  style={{
                    flex: 2, padding: "11px 0",
                    background: canEdit && lineupValid
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : "#e5e7eb",
                    border: "none", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    color: canEdit && lineupValid ? "#000" : "#9ca3af",
                    cursor: canEdit && lineupValid && !submitting ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                  }}
                >
                  {submitting ? t("提交中…", "Submitting…")
                    : bucket === "upcoming"
                      ? (isSubmitted ? t("更新阵容", "Update Lineup") : t("创建阵容", "Create Lineup"))
                      : (isSubmitted ? t("重新提交", "Resubmit Lineup") : t("提交阵容", "Submit Lineup"))}
                </button>
              </div>
            )}

            {/* Submitted confirmation + results link */}
            {isSubmitted && !isReadOnly && (
              <div style={{ margin: "10px 16px 0" }}>
                <div style={{
                  padding: "10px 14px",
                  background: "#f0fdf4", border: "1px solid #bbf7d0",
                  borderRadius: 8, fontSize: 12, color: "#15803d", fontWeight: 500,
                }}>
                  ✓ {t("阵容已提交，锁定前可继续更新。", "Lineup submitted — you can still update it until lock time.")}
                </div>
                <button
                  onClick={() => contest && window.open(`/contest/nba/my-lineup?id=${contest.id}`, "_self")}
                  style={{
                    width: "100%", marginTop: 8, padding: "9px 0", borderRadius: 8,
                    background: "#fff", border: "1px solid #e5e7eb",
                    fontSize: 13, fontWeight: 600, color: "#374151", cursor: "pointer",
                  }}
                >
                  {t("查看我的成绩", "View My Results")}
                </button>
              </div>
            )}

            {/* Read-only results link (after lock) */}
            {isSubmitted && isReadOnly && contest && (
              <div style={{ margin: "10px 16px 0" }}>
                <button
                  onClick={() => window.open(`/contest/nba/my-lineup?id=${contest.id}`, "_self")}
                  style={{
                    width: "100%", padding: "10px 0", borderRadius: 8,
                    background: "#1e3a8a", border: "none",
                    fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
                  }}
                >
                  {t("查看比赛成绩", "View Results")}
                </button>
              </div>
            )}

            {/* ── AI lineup post ──────────────────────────────── */}
            {user && filledCount === 5 && (
              <div style={{
                margin: "12px 16px 0", padding: "14px",
                background: "#fff", border: "1px solid #e5e7eb",
                borderRadius: 12,
              }}>
                {!aiOpen && (
                  <button
                    onClick={() => setAiOpen(true)}
                    style={{
                      width: "100%", padding: "11px 0",
                      background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                      border: "none", borderRadius: 10,
                      fontSize: 14, fontWeight: 700, color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    {t("一键生成阵容贴", "Generate lineup post")}
                  </button>
                )}

                {aiOpen && (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {t("阵容贴生成器", "Lineup post generator")}
                      </span>
                      <button
                        onClick={() => discardAiPost("user_close")}
                        style={{
                          background: "none", border: "none", fontSize: 18,
                          color: "#6b7280", cursor: "pointer", lineHeight: 1,
                        }}
                        aria-label="close"
                      >
                        ×
                      </button>
                    </div>

                    {/* Tone selector */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        {t("语气", "Tone")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {TONE_VALUES.map((tone) => {
                          const labels: Record<Tone, [string, string]> = {
                            analytical: ["专业分析", "Analytical"],
                            casual: ["轻松吐槽", "Casual"],
                            bold_prediction: ["大胆预测", "Bold prediction"],
                            ask_advice: ["求建议", "Ask advice"],
                            trash_talk: ["赛前狠话", "Trash talk"],
                          };
                          const [zh, en] = labels[tone];
                          const active = aiTone === tone;
                          return (
                            <button
                              key={tone}
                              onClick={() => setAiTone(tone)}
                              style={{
                                padding: "6px 12px", borderRadius: 999,
                                fontSize: 12, fontWeight: 600,
                                border: `1px solid ${active ? "#4f46e5" : "#d1d5db"}`,
                                background: active ? "#4f46e5" : "#fff",
                                color: active ? "#fff" : "#374151",
                                cursor: "pointer",
                              }}
                            >
                              {t(zh, en)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Style selector */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        {t("风格", "Style")}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {STYLE_VALUES.map((style) => {
                          const labels: Record<Style, [string, string]> = {
                            hupu: ["虎扑老哥", "Hupu fan"],
                            xiaohongshu: ["小红书", "Xiaohongshu"],
                            wechat_moments: ["朋友圈", "WeChat moments"],
                            professional_short: ["专业简短", "Professional short"],
                          };
                          const [zh, en] = labels[style];
                          const active = aiStyle === style;
                          return (
                            <button
                              key={style}
                              onClick={() => setAiStyle(style)}
                              style={{
                                padding: "6px 12px", borderRadius: 999,
                                fontSize: 12, fontWeight: 600,
                                border: `1px solid ${active ? "#4f46e5" : "#d1d5db"}`,
                                background: active ? "#4f46e5" : "#fff",
                                color: active ? "#fff" : "#374151",
                                cursor: "pointer",
                              }}
                            >
                              {t(zh, en)}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Custom instruction */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                        {t("自定义说明（可选）", "Custom instruction (optional)")}
                      </div>
                      <textarea
                        value={aiCustom}
                        onChange={(e) => setAiCustom(e.target.value)}
                        maxLength={MAX_CUSTOM_INSTRUCTION_LEN}
                        placeholder={t(
                          "比如：写得嚣张一点 / 强调我今天赌冷门 / 不要太正式",
                          "e.g. make it bolder / emphasize my underdog bet / not too formal",
                        )}
                        rows={2}
                        style={{
                          width: "100%", padding: "8px 10px",
                          border: "1px solid #e5e7eb", borderRadius: 8,
                          fontSize: 13, color: "#111827", background: "#fff",
                          outline: "none", resize: "vertical",
                          boxSizing: "border-box",
                        }}
                      />
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4, textAlign: "right" }}>
                        {Array.from(aiCustom).length}/{MAX_CUSTOM_INSTRUCTION_LEN}
                      </div>
                    </div>

                    <button
                      onClick={handleAiGenerate}
                      disabled={aiGenerating}
                      style={{
                        width: "100%", padding: "10px 0",
                        background: aiGenerating ? "#a5b4fc" : "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                        border: "none", borderRadius: 10,
                        fontSize: 13, fontWeight: 700, color: "#fff",
                        cursor: aiGenerating ? "not-allowed" : "pointer",
                      }}
                    >
                      {aiGenerating ? t("生成中…", "Generating…") : t("生成 3 个版本", "Generate 3 versions")}
                    </button>

                    {aiError && (
                      <div style={{
                        marginTop: 10, padding: "8px 10px",
                        background: "#fef2f2", border: "1px solid #fecaca",
                        borderRadius: 8, fontSize: 12, color: "#991b1b",
                      }}>
                        {aiError}
                      </div>
                    )}

                    {aiCustomIgnored && (
                      <div style={{
                        marginTop: 10, padding: "8px 10px",
                        background: "#fffbeb", border: "1px solid #fde68a",
                        borderRadius: 8, fontSize: 12, color: "#92400e",
                      }}>
                        {t("自定义说明已忽略（与篮球/阵容主题无关）", "Custom instruction ignored (off-topic).")}
                      </div>
                    )}

                    {aiVersions && aiSelectedIdx === null && (
                      <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                        {aiVersions.map((v, idx) => {
                          const tag = v.style === "analysis"
                            ? t("分析", "Analysis")
                            : v.style === "casual"
                              ? t("吐槽", "Casual")
                              : t("预测", "Bold");
                          return (
                            <div key={idx} style={{
                              border: "1px solid #e5e7eb", borderRadius: 10,
                              padding: 10, background: "#fafafa",
                            }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                                <span style={{
                                  padding: "2px 8px", borderRadius: 999,
                                  fontSize: 11, fontWeight: 700,
                                  background: "#eef2ff", color: "#4338ca",
                                }}>
                                  {tag}
                                </span>
                                <button
                                  onClick={() => selectAiVersion(idx)}
                                  style={{
                                    padding: "4px 10px", borderRadius: 6,
                                    border: "1px solid #4f46e5", background: "#4f46e5",
                                    color: "#fff", fontSize: 11, fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  {t("使用此版本", "Use this version")}
                                </button>
                              </div>
                              <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                                {v.post}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {aiVersions && aiSelectedIdx !== null && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {t("标题", "Title")}
                        </div>
                        <input
                          value={aiEditTitle}
                          onChange={(e) => setAiEditTitle(e.target.value)}
                          maxLength={80}
                          style={{
                            width: "100%", padding: "8px 10px",
                            border: "1px solid #e5e7eb", borderRadius: 8,
                            fontSize: 13, color: "#111827", background: "#fff",
                            outline: "none", boxSizing: "border-box", marginBottom: 8,
                          }}
                        />
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 4 }}>
                          {t("正文", "Body")}
                        </div>
                        <textarea
                          value={aiEditBody}
                          onChange={(e) => onAiBodyChange(e.target.value)}
                          maxLength={2000}
                          rows={6}
                          style={{
                            width: "100%", padding: "8px 10px",
                            border: "1px solid #e5e7eb", borderRadius: 8,
                            fontSize: 13, color: "#111827", background: "#fff",
                            outline: "none", boxSizing: "border-box", resize: "vertical",
                          }}
                        />
                        {/* Image uploader */}
                        <div style={{ marginTop: 12 }}>
                          <PostImageUploader
                            uploadedUrls={aiPostImages}
                            onUpload={(newUrls) => setAiPostImages((prev) => [...prev, ...newUrls])}
                            onRemove={(i) => setAiPostImages((prev) => prev.filter((_, idx) => idx !== i))}
                            uploading={aiPostUploading}
                            onUploading={setAiPostUploading}
                            uploadFn={(file) => uploadImage(file, "posts")}
                            maxImages={4}
                            maxMB={10}
                            lang={lang}
                          />
                        </div>

                        {/* Default image hint */}
                        <div style={{
                          marginTop: 8, padding: "6px 10px",
                          background: "#f0fdf4", border: "1px solid #bbf7d0",
                          borderRadius: 6, fontSize: 11, color: "#15803d",
                        }}>
                          {aiPostImages.length > 0
                            ? t("将使用你上传的图片作为配图。", "Your uploaded image(s) will be used as the post cover.")
                            : t("将自动生成阵容配图。", "A lineup card image will be auto-generated as the post cover.")}
                        </div>

                        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                          <button
                            onClick={() => setAiSelectedIdx(null)}
                            style={{
                              flex: 1, padding: "9px 0",
                              background: "#fff", border: "1px solid #d1d5db",
                              borderRadius: 8, fontSize: 13, fontWeight: 600,
                              color: "#374151", cursor: "pointer",
                            }}
                          >
                            {t("返回", "Back")}
                          </button>
                          <button
                            onClick={publishAiPost}
                            disabled={aiPublishing || aiPostUploading}
                            style={{
                              flex: 2, padding: "9px 0",
                              background: (aiPublishing || aiPostUploading) ? "#a7f3d0" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: "none", borderRadius: 8,
                              fontSize: 13, fontWeight: 700, color: "#fff",
                              cursor: (aiPublishing || aiPostUploading) ? "not-allowed" : "pointer",
                            }}
                          >
                            {aiPublishing ? t("发布中…", "Publishing…") : t("发布", "Publish")}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Player pool ───────────────────────────────── */}
            <div style={{ padding: "20px 16px 0" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                {t("球员池", "Player Pool")}
                <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>
                  {t(`（${players.length} 人）`, `(${players.length} players)`)}
                </span>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder={t("搜索球员…", "Search players…")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px",
                  border: "1px solid #e5e7eb", borderRadius: 8,
                  fontSize: 14, color: "#111827", background: "#fff",
                  outline: "none", marginBottom: 10,
                  boxSizing: "border-box",
                }}
              />

              {/* Tier filters */}
              <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
                <FilterPill
                  label={t("全部档位", "All Tiers")}
                  active={tierFilter === null}
                  onClick={() => setTierFilter(null)}
                  color="#374151"
                  activeBg="#1e3a8a"
                />
                {([1, 2, 3, 4] as const).map((tier) => (
                  <FilterPill
                    key={tier}
                    label={`T${tier} ${lang === "zh" ? TIER_LABEL[tier][0] : TIER_LABEL[tier][1]}`}
                    active={tierFilter === tier}
                    onClick={() => setTierFilter(tierFilter === tier ? null : tier)}
                    color={TIER_COLOR[tier].color}
                    activeBg={TIER_COLOR[tier].color}
                  />
                ))}
              </div>

              {/* Position filters — always the 5 base positions.
                  Matching uses parsePositions so "PG/SG" appears under both PG and SG. */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                <FilterPill
                  label={t("全部", "All")}
                  active={posFilter === null}
                  onClick={() => setPosFilter(null)}
                  color="#374151"
                  activeBg="#374151"
                />
                {BASE_POSITIONS.map((pos) => (
                  <FilterPill
                    key={pos}
                    label={pos}
                    active={posFilter === pos}
                    onClick={() => setPosFilter(posFilter === pos ? null : pos)}
                    color="#374151"
                    activeBg="#374151"
                  />
                ))}
              </div>

              {/* Flat salary-DESC list. Tier badge + filter pill above keep
                  the tier signal without forcing a grouped layout. */}
              {playersError ? (
                <div style={{
                  padding: "14px 16px", background: "#fef2f2",
                  border: "1px solid #fecaca", borderRadius: 10,
                  fontSize: 13, color: "#991b1b", lineHeight: 1.5,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {t("无法加载球员池", "Could not load player pool")}
                  </div>
                  <div style={{ fontSize: 12, color: "#7f1d1d" }}>
                    {playersError}
                  </div>
                </div>
              ) : noConfirmedGames ? (
                <div style={{
                  padding: "20px 16px", background: "#fefce8",
                  border: "1px solid #fde047", borderRadius: 10,
                  fontSize: 13, color: "#713f12", lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>
                    {t("该日期暂无确认比赛", "No confirmed games for this date")}
                  </div>
                  <div style={{ fontSize: 12, color: "#854d0e" }}>
                    {t(
                      "球员池将在赛程确认后更新。季后赛赛程根据系列赛结果实时调整，请稍后再来查看。",
                      "The player pool will update once the schedule is confirmed. Playoff schedules adjust based on series results — check back closer to game day.",
                    )}
                  </div>
                </div>
              ) : sortedPool.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "#9ca3af" }}>
                  {players.length === 0
                    ? t("当日没有球员可选。", "No players available for this contest.")
                    : t("暂无符合条件的球员。", "No players match your filter.")}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sortedPool.map((p) => {
                    const selected = inLineup.has(p.player_id);
                    const isOut = p.is_available === false || p.injury?.toLowerCase().startsWith("out");
                    // A non-selected player whose salary would push us past
                    // the cap is rendered greyed/non-clickable.
                    const wouldOverflow = !selected &&
                      capState.totalSalary + (p.salary || 0) > SALARY_CAP;
                    return (
                      <PlayerCard
                        key={p.player_id}
                        player={p}
                        selected={selected}
                        canEdit={canEdit}
                        lang={lang}
                        isOut={!!isOut}
                        wouldOverflow={wouldOverflow}
                        onClick={() => togglePlayer(p.player_id)}
                      />
                    );
                  })}
                </div>
              )}

              {/* Bottom padding */}
              <div style={{ height: 40 }} />
            </div>
          </>
        )}
      </main>

      {/* ── Off-screen lineup share card (for auto-image capture) ─── */}
      {/* Rendered when user is on the final AI post editor. html-to-image
          captures this element; it must be in the DOM but is invisible. */}
      {aiSelectedIdx !== null && contest && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed", left: -9999, top: 0,
            zIndex: -1, pointerEvents: "none", width: 360,
          }}
        >
          <LineupShareCard
            ref={lineupShareCardRef}
            contestDate={contest.date}
            players={slots.map((pid, idx): SharePlayer | null => {
              if (!pid) return null;
              const p = playerMap.get(pid);
              if (!p) return null;
              return {
                slotLabel: SLOT_LABEL[idx + 1],
                name: p.name,
                team: p.team,
                position: p.position,
                tier: p.tier,
                salary: p.salary,
              };
            })}
            totalSalary={capState.totalSalary}
            remaining={capState.remaining}
            lang={lang}
          />
        </div>
      )}

      {/* ── Slot-picker modal (multi-position players) ───────── */}
      {slotPickModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setSlotPickModal(null)}
        >
          <div
            style={{
              background: "#fff", borderRadius: 16, padding: "24px 20px",
              maxWidth: 320, width: "90%", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
              {t("选择位置", "Choose a slot")}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
              {t(
                `把 ${getPlayerDisplayName(slotPickModal.player, "zh")} 放在哪个位置？`,
                `Where do you want to place ${slotPickModal.player.name}?`,
              )}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {slotPickModal.eligibleSlots.map((idx) => (
                <button
                  key={idx}
                  onClick={() => placeInSlot(slotPickModal.player.player_id, idx)}
                  style={{
                    flex: 1, padding: "12px 0", borderRadius: 10,
                    background: "#1e3a8a", color: "#fff",
                    border: "none", cursor: "pointer",
                    fontSize: 15, fontWeight: 700,
                  }}
                >
                  {SLOT_LABEL[idx + 1]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setSlotPickModal(null)}
              style={{
                width: "100%", marginTop: 10, padding: "9px 0", borderRadius: 10,
                background: "#f3f4f6", border: "none", cursor: "pointer",
                fontSize: 13, color: "#6b7280",
              }}
            >
              {t("取消", "Cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ContestSection({
  label, contests, selectedId, onSelect, highlight = false, bucket, lang,
}: {
  label: string;
  contests: Contest[];
  selectedId: string | null;
  onSelect: (c: Contest) => void;
  highlight?: boolean;
  bucket: "past" | "present" | "upcoming";
  lang: "zh" | "en";
}) {
  const pill = BUCKET_PILL[bucket];
  const bucketLabel = getBucketLabel(bucket, lang);
  return (
    <div style={{ padding: "12px 16px 0" }}>
      <div style={{
        fontSize: 11, fontWeight: 700, letterSpacing: 1,
        color: "#6b7280", textTransform: "uppercase", marginBottom: 6,
      }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
        {contests.map((c) => {
          const isSelected = c.id === selectedId;
          const activeBg = highlight ? "#1e3a8a" : "#374151";
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              style={{
                flexShrink: 0, minWidth: 96,
                padding: "8px 12px", borderRadius: 10,
                background: isSelected ? activeBg : "#fff",
                border: `1px solid ${isSelected ? activeBg : "#e5e7eb"}`,
                textAlign: "left", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              <div style={{
                fontSize: 12, fontWeight: 700,
                color: isSelected ? "#fff" : "#111827",
              }}>
                {formatDateShort(c.date, lang)}
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{
                  display: "inline-block",
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 999,
                  background: isSelected ? "rgba(255,255,255,0.2)" : pill.bg,
                  color:      isSelected ? "#fff"                    : pill.color,
                }}>
                  {bucketLabel}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Single cell in the salary-cap counter. Tone drives the color so a glance
// at the row tells the user whether they're under, near, or over the cap.
function CapStat({
  label, value, tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "err" | "neutral";
}) {
  const color =
    tone === "err"  ? "#991b1b" :
    tone === "warn" ? "#92400e" :
    tone === "ok"   ? "#065f46" : "#111827";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 10, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{ fontSize: 14, fontWeight: 700, color }}>
        {value}
      </span>
    </div>
  );
}

function FilterPill({
  label, active, onClick, color, activeBg,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
  activeBg: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "4px 11px", borderRadius: 999, fontSize: 12, fontWeight: 600,
        border: `1px solid ${active ? activeBg : "#e5e7eb"}`,
        background: active ? activeBg : "#fff",
        color: active ? "#fff" : color,
        cursor: "pointer", transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );
}

function PlayerCard({
  player: p, selected, canEdit, lang, isOut, wouldOverflow, onClick,
}: {
  player: ContestPlayer;
  selected: boolean;
  canEdit: boolean;
  lang: string;
  isOut: boolean;
  wouldOverflow: boolean;
  onClick: () => void;
}) {
  const tc = TIER_COLOR[p.tier];
  // Disabled = locked view (no edit), or unavailable, or would push over
  // the cap (only when not already in the lineup).
  const disabled = (!canEdit && !selected) || (canEdit && (isOut || wouldOverflow) && !selected);
  const fadedReason = !selected && (isOut || wouldOverflow);

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", textAlign: "left",
        background: selected
          ? "rgba(30,58,138,0.06)"
          : fadedReason ? "#fafafa" : "#fff",
        border: `1px solid ${selected ? "#93c5fd" : "#e5e7eb"}`,
        borderRadius: 10,
        cursor: disabled ? "not-allowed" : (canEdit ? "pointer" : "default"),
        transition: "all 0.15s",
        opacity: fadedReason ? 0.55 : 1,
      }}
    >
      {/* Selected check or avatar */}
      {selected ? (
        <div style={{
          width: 32, height: 32, borderRadius: "50%",
          background: "#1e3a8a",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <span style={{ color: "#fff", fontSize: 15, fontWeight: 700 }}>✓</span>
        </div>
      ) : (
        <PlayerAvatar name={p.name} size={32} />
      )}

      {/* Player info — name + (team · pos · tier · injury) on a second line. */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "#111827",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {getPlayerDisplayName(p, lang as "zh" | "en")}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
          <span>{translateTeam(p.team, lang as "en" | "zh")}</span>
          <span>·</span>
          <span>{p.position}</span>
          {/* Tier — display/filter only, no longer enforced. */}
          <span style={{
            padding: "1px 5px", borderRadius: 4, fontSize: 10, fontWeight: 700,
            background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
            marginLeft: 2,
          }}>
            T{p.tier}
          </span>
          {p.injury && (
            <span style={{
              padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: isOut ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              color: isOut ? "#ef4444" : "#d97706",
            }}>
              {p.injury}
            </span>
          )}
        </div>
      </div>

      {/* Salary + projected + value. Three lines, right-aligned. Salary is
          bold (it's the cap-driver). Value is the per-$1k efficiency hint. */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1, flexShrink: 0, minWidth: 64 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
          {fmtMoney(p.salary)}
        </span>
        <span style={{ fontSize: 10, color: "#6b7280" }}>
          {p.projected_points.toFixed(1)} {lang === "zh" ? "预测" : "proj"}
        </span>
        <span style={{ fontSize: 10, color: "#2563eb", fontWeight: 600 }}>
          {p.value.toFixed(2)}× {lang === "zh" ? "性价比" : "value"}
        </span>
      </div>
    </button>
  );
}
