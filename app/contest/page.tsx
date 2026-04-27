"use client";

import { useState, useEffect, useRef } from "react";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getSessionUser, createInsight } from "@/lib/store";
import { translateTeam } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { getMyLineup, saveLineup, submitLineup, contestFetch } from "@/lib/contest-fetch";
import { isEligibleForContestSlot, SLOT_LABEL, parsePositions } from "@/lib/contest-positions";
import {
  type Tone,
  type Style,
  TONE_VALUES,
  STYLE_VALUES,
  MAX_CUSTOM_INSTRUCTION_LEN,
} from "@/lib/ai/input-safety";
import { track } from "@/lib/analytics";

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
};

// ── Constants ─────────────────────────────────────────────────

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const TIER_LABEL: Record<number, string> = {
  1: "Elite",
  2: "Solid",
  3: "Value",
  4: "Deep Cut",
};

const TIER_COLOR: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: "rgba(245,158,11,0.12)", color: "#d97706", border: "rgba(245,158,11,0.3)" },
  2: { bg: "rgba(59,130,246,0.10)", color: "#2563eb", border: "rgba(59,130,246,0.25)" },
  3: { bg: "rgba(16,185,129,0.10)", color: "#059669", border: "rgba(16,185,129,0.25)" },
  4: { bg: "rgba(100,116,139,0.10)", color: "#64748b", border: "rgba(100,116,139,0.2)" },
};

const STATUS_PILL: Record<string, { label: string; bg: string; color: string }> = {
  pending:  { label: "Upcoming",  bg: "#fef3c7", color: "#92400e" },
  open:     { label: "Open",      bg: "#d1fae5", color: "#065f46" },
  locked:   { label: "Locked",    bg: "#fee2e2", color: "#991b1b" },
  scored:   { label: "Scored",    bg: "#dbeafe", color: "#1e40af" },
};

// Calendar-card pill derived from date bucket, not DB status. Past contests
// always read "Past" (regardless of DB status), today reads "Open", and any
// date in the future reads "Upcoming".
const BUCKET_PILL: Record<"past" | "present" | "upcoming", { label: string; bg: string; color: string }> = {
  past:     { label: "Past",     bg: "#f3f4f6", color: "#6b7280" },
  present:  { label: "Open",     bg: "#d1fae5", color: "#065f46" },
  upcoming: { label: "Upcoming", bg: "#fef3c7", color: "#92400e" },
};

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
}

function formatLockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });
}

function formatCountdown(lockIso: string, now: Date): string {
  const diff = new Date(lockIso).getTime() - now.getTime();
  if (diff <= 0) return "Locked";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

    // Placeholder upcoming card (no DB row yet) — skip the player/lineup
    // fetches; the render path shows a "Contest opens closer to game day"
    // panel instead of the lineup builder.
    if (c.placeholder) return;

    const pr = await fetch(`/api/contests/${c.id}/players`);
    if (requestedContestIdRef.current !== c.id) return;
    if (pr.ok) {
      const { players: pool } = await pr.json();
      setPlayers(pool ?? []);
    }

    if (user) {
      const { data } = await getMyLineup(c.id);
      if (requestedContestIdRef.current !== c.id) return;
      if (data) {
        const next: (string | null)[] = [null, null, null, null, null];
        for (const p of data.players) next[p.slot - 1] = p.player_id;
        setSlots(next);
        setLineupStatus(data.status);
      }
    }
  }

  // ── Tier rules ───────────────────────────────────────────────
  // Exact requirement: 1 T1, 1 T2, 1 T3, 2 T4.
  // Mirrored server-side in app/api/contests/[id]/lineup/route.ts.
  const TIER_REQUIRED: Record<number, number> = { 1: 1, 2: 1, 3: 1, 4: 2 };

  // ── Derived ─────────────────────────────────────────────────

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

  const isPastDeadline = contest
    ? bucket === "past" || contest.status === "locked" || contest.status === "scored" || now >= new Date(contest.lineup_lock_at)
    : false;
  const isReadOnly    = isPastDeadline || lineupStatus === "locked" || lineupStatus === "scored";
  const isSubmitted   = lineupStatus === "submitted" || lineupStatus === "locked" || lineupStatus === "scored";
  const canEdit       = !!user && !isReadOnly;

  // Bucketed views over the full nearby window — feed the Past/Today/Upcoming
  // section cards above the existing contest detail pane.
  const pastContests     = allContests.filter((c) => c.date < todayUtc).reverse();
  const presentContest   = allContests.find((c) => c.date === todayUtc) ?? null;
  const realUpcoming     = allContests.filter((c) => c.date > todayUtc);

  // Synthesize placeholder cards for the next 7 days that don't have a DB row,
  // so the "Upcoming" section is always visible even when the seed-upcoming
  // cron hasn't seeded yet. Placeholder cards are visually identical, but
  // selecting one shows a "Contest opens closer to game day" panel.
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

  // Tier counts of the current lineup slots
  const tierCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const pid of slots) {
    if (pid) {
      const t = playerMap.get(pid)?.tier ?? 4;
      tierCounts[t] = (tierCounts[t] ?? 0) + 1;
    }
  }
  const tierOk = filledCount === 5 &&
    tierCounts[1] === TIER_REQUIRED[1] &&
    tierCounts[2] === TIER_REQUIRED[2] &&
    tierCounts[3] === TIER_REQUIRED[3] &&
    tierCounts[4] === TIER_REQUIRED[4];

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

  // Group by tier (only tiers with results after filtering)
  const tierGroups: Array<{ tier: number; players: ContestPlayer[] }> = [1, 2, 3, 4]
    .map((t) => ({ tier: t, players: filtered.filter((p) => p.tier === t) }))
    .filter((g) => g.players.length > 0);

  // ── Interactions ────────────────────────────────────────────

  // Toggle player in/out of lineup.
  // Fills the first empty slot the player is position-eligible for.
  // Combo positions ("PG/SG") satisfy either slot they contain.
  function togglePlayer(pid: string) {
    if (!canEdit) return;

    if (slots.includes(pid)) {
      setSlots((prev) => prev.map((id) => (id === pid ? null : id)));
      return;
    }

    const player = playerMap.get(pid);
    if (!player) return;

    // ── Tier constraint checks ─────────────────────────────
    // Block adding if this tier is already at its quota.
    const tierQuota = TIER_REQUIRED[player.tier] ?? 0;
    if ((tierCounts[player.tier] ?? 0) >= tierQuota) {
      const labels: Record<number, string> = { 1: "Elite (T1)", 2: "Solid (T2)", 3: "Value (T3)", 4: "Deep Cut (T4)" };
      showFlash("err", `Only ${tierQuota} ${labels[player.tier]} player${tierQuota === 1 ? "" : "s"} allowed.`);
      return;
    }

    // slots is current state — safe to read here (no stale closure risk since
    // we call setSlots with a direct value, not a functional update that depends on prev).
    const eligibleEmptyIdx = slots.findIndex(
      (id, i) => id === null && isEligibleForContestSlot(player.position, i + 1),
    );

    if (eligibleEmptyIdx === -1) {
      const pos = player.position === "N/A" ? "unknown position" : player.position;
      showFlash("err", `${player.name} (${pos}) doesn't fit any open slot.`);
      return;
    }

    setSlots((prev) => {
      const next = [...prev];
      next[eligibleEmptyIdx] = pid;
      return next;
    });
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
    if (picks.length !== 5) {
      showFlash("err", "Fill all 5 slots to save.");
      return;
    }
    if (!tierOk) {
      showFlash("err", "Lineup must have exactly 1 Elite, 1 Solid, 1 Value, and 2 Deep Cut players.");
      return;
    }
    setSaving(true);
    const { error } = await saveLineup(contest.id, picks);
    setSaving(false);
    if (error) {
      showFlash("err",
        error === "unauthorized"   ? "Log in to save your lineup." :
        error === "contest_locked" ? "Contest is locked — edits not allowed." :
        error
      );
    } else {
      showFlash("ok", "Draft saved.");
    }
  }

  // ── Submit ───────────────────────────────────────────────────

  async function handleSubmit() {
    if (!contest || !user || !canEdit || filledCount !== 5 || submitting) return;
    setSubmitting(true);

    // Save first, then submit
    const picks = slots.map((id, i) => ({ slot: i + 1, player_id: id! }));
    const saveResult = await saveLineup(contest.id, picks);
    if (saveResult.error) {
      showFlash("err",
        saveResult.error === "unauthorized"   ? "Log in to submit." :
        saveResult.error === "contest_locked" ? "Contest is locked." :
        saveResult.error
      );
      setSubmitting(false);
      return;
    }

    const subResult = await submitLineup(contest.id);
    setSubmitting(false);
    if (subResult.error) {
      const msgs: Record<string, string> = {
        unauthorized:     "Log in to submit.",
        contest_locked:   "Contest is locked — lineups can no longer be submitted.",
        lineup_locked:    "Your lineup is already locked.",
        incomplete_lineup: "Select exactly 5 players.",
      };
      showFlash("err", msgs[subResult.error] ?? subResult.error);
    } else {
      setLineupStatus("submitted");
      showFlash("ok", "Lineup submitted! Good luck 🎯");
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
    const fallbackTitleZh = `${formatDate(contest!.date)} 我的阵容`;
    const fallbackTitleEn = `My ${formatDateShort(contest!.date)} lineup`;
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
    const result = await createInsight({
      title: aiEditTitle,
      body: aiEditBody.trim() || aiInitialBody,
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
    });
    showFlash("ok", t("已发布到 Insights", "Published to Insights"));
    discardAiPost("after_publish");
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />

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
            label="Past"
            contests={pastContests}
            selectedId={contest?.id ?? null}
            onSelect={loadContestDetail}
            bucket="past"
          />
        )}
        {presentContest && (
          <ContestSection
            label="Today"
            contests={[presentContest]}
            selectedId={contest?.id ?? null}
            onSelect={loadContestDetail}
            highlight
            bucket="present"
          />
        )}
        {upcomingContests.length > 0 && (
          <ContestSection
            label="Upcoming"
            contests={upcomingContests}
            selectedId={contest?.id ?? null}
            onSelect={loadContestDetail}
            bucket="upcoming"
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
                  {bucket === "past" ? "Past Contest"
                    : bucket === "upcoming" ? "Upcoming Contest"
                    : "Daily Contest"}
                </span>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 2 }}>
                  {formatDate(contest.date)}
                </div>
              </div>
              {/* Status pill — past dates always show "Past" so the header
                  matches the calendar card; today/future fall back to DB status. */}
              {(() => {
                const headerPill = bucket === "past"
                  ? BUCKET_PILL.past
                  : (STATUS_PILL[contest.status] ?? { label: contest.status, bg: "#f3f4f6", color: "#374151" });
                return (
                  <span style={{
                    padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: headerPill.bg,
                    color:      headerPill.color,
                  }}>
                    {headerPill.label}
                  </span>
                );
              })()}
            </div>

            {/* Lock info — hidden for placeholder cards since the lock time
                is synthetic and not meaningful until the contest is seeded. */}
            {!isPlaceholder && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  Lock: {formatLockTime(contest.lineup_lock_at)}
                </span>
                {!isPastDeadline && (
                  <span style={{
                    fontSize: 12, fontWeight: 700,
                    color: formatCountdown(contest.lineup_lock_at, now) === "Locked" ? "#991b1b" : "#1e3a8a",
                  }}>
                    {formatCountdown(contest.lineup_lock_at, now)}
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Loading ─────────────────────────────────────────── */}
        {loading && (
          <div style={{ padding: "48px 16px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            Loading contest…
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

        {/* ── Placeholder upcoming empty-state ────────────────── */}
        {/* Future-date card with no DB row yet — shown instead of the
            lineup builder until the seed-upcoming cron creates the contest. */}
        {!loading && !pageError && contest && isPlaceholder && (
          <div style={{ padding: "24px 16px" }}>
            <div style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12,
              padding: "28px 20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🗓️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                {t("竞赛尚未开放", "Contest opens closer to game day")}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {t(
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
                <a href="/auth/login" style={{ fontWeight: 700, color: "#1d4ed8" }}>Log in</a>
                {" "}to save and submit your lineup.
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
                  ? "Results are in — see your score below."
                  : bucket === "past"
                  ? "Viewing your submitted lineup — this contest has ended."
                  : "Lineup locked. Awaiting results."}
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
                  {isReadOnly && isSubmitted ? "My Submitted Lineup" : "My Lineup"}
                </span>
                <span style={{ fontSize: 12, color: "#6b7280" }}>
                  {filledCount}/5 selected
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
                            {p.name}
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
                        Select a {SLOT_LABEL[idx + 1]} below
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ── Tier rules bar ────────────────────────────── */}
            {user && !isReadOnly && (
              <div style={{
                margin: "10px 16px 0", padding: "10px 14px",
                background: "#f8fafc", border: "1px solid #e5e7eb",
                borderRadius: 8, fontSize: 12,
                display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center",
              }}>
                <span style={{ color: "#6b7280", fontWeight: 600 }}>Required:</span>
                {([1, 2, 3, 4] as const).map((t) => {
                  const required = TIER_REQUIRED[t];
                  const current  = tierCounts[t] ?? 0;
                  const over  = current > required;
                  const met   = current === required;
                  const label = ["", "T1", "T2", "T3", "T4"][t];
                  return (
                    <span key={t} style={{
                      fontWeight: 700,
                      color: over ? "#991b1b" : met ? "#15803d" : "#6b7280",
                    }}>
                      {label}: {current}/{required}
                    </span>
                  );
                })}
              </div>
            )}

            {/* ── Action buttons ────────────────────────────── */}
            {user && !isReadOnly && (
              <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || filledCount !== 5 || !tierOk}
                  style={{
                    flex: 1, padding: "11px 0",
                    background: "#fff", border: "1px solid #d1d5db",
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: filledCount === 5 && tierOk ? "#374151" : "#9ca3af",
                    cursor: filledCount === 5 && tierOk && !saving ? "pointer" : "not-allowed",
                    opacity: filledCount === 5 && tierOk ? 1 : 0.5,
                    transition: "all 0.15s",
                  }}
                >
                  {saving ? "Saving…" : "Save Draft"}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!canEdit || filledCount !== 5 || !tierOk || submitting}
                  style={{
                    flex: 2, padding: "11px 0",
                    background: canEdit && filledCount === 5 && tierOk
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : "#e5e7eb",
                    border: "none", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    color: canEdit && filledCount === 5 && tierOk ? "#000" : "#9ca3af",
                    cursor: canEdit && filledCount === 5 && tierOk && !submitting ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                  }}
                >
                  {submitting ? "Submitting…"
                    : bucket === "upcoming"
                      ? (isSubmitted ? "Update Lineup" : "Create Lineup")
                      : (isSubmitted ? "Resubmit Lineup" : "Submit Lineup")}
                </button>
              </div>
            )}

            {/* Submitted confirmation */}
            {isSubmitted && !isReadOnly && (
              <div style={{
                margin: "10px 16px 0", padding: "10px 14px",
                background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, fontSize: 12, color: "#15803d", fontWeight: 500,
              }}>
                ✓ Lineup submitted — you can still update it until lock time.
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
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
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
                            disabled={aiPublishing}
                            style={{
                              flex: 2, padding: "9px 0",
                              background: aiPublishing ? "#a7f3d0" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              border: "none", borderRadius: 8,
                              fontSize: 13, fontWeight: 700, color: "#fff",
                              cursor: aiPublishing ? "not-allowed" : "pointer",
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
                Player Pool
                <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>
                  ({players.length} players)
                </span>
              </div>

              {/* Search */}
              <input
                type="text"
                placeholder="Search players…"
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
                  label="All Tiers"
                  active={tierFilter === null}
                  onClick={() => setTierFilter(null)}
                  color="#374151"
                  activeBg="#1e3a8a"
                />
                {[1, 2, 3, 4].map((t) => (
                  <FilterPill
                    key={t}
                    label={`T${t} ${TIER_LABEL[t]}`}
                    active={tierFilter === t}
                    onClick={() => setTierFilter(tierFilter === t ? null : t)}
                    color={TIER_COLOR[t].color}
                    activeBg={TIER_COLOR[t].color}
                  />
                ))}
              </div>

              {/* Position filters — always the 5 base positions.
                  Matching uses parsePositions so "PG/SG" appears under both PG and SG. */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                <FilterPill
                  label="All"
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

              {/* Tier-grouped player list */}
              {tierGroups.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0", fontSize: 13, color: "#9ca3af" }}>
                  No players match your filter.
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {tierGroups.map(({ tier, players: group }) => (
                    <div key={tier}>
                      {/* Tier header */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8,
                        marginBottom: 6,
                      }}>
                        <span style={{
                          padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
                          background: TIER_COLOR[tier].bg, color: TIER_COLOR[tier].color,
                          border: `1px solid ${TIER_COLOR[tier].border}`,
                        }}>
                          Tier {tier} — {TIER_LABEL[tier]}
                        </span>
                        <span style={{ fontSize: 11, color: "#9ca3af" }}>
                          {group.length} players
                        </span>
                      </div>

                      {/* Player cards */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {group.map((p) => {
                          const selected = inLineup.has(p.player_id);
                          const isOut = p.injury?.toLowerCase().startsWith("out");
                          return (
                            <PlayerCard
                              key={p.player_id}
                              player={p}
                              selected={selected}
                              canEdit={canEdit}
                              lang={lang}
                              isOut={!!isOut}
                              onClick={() => togglePlayer(p.player_id)}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Bottom padding */}
              <div style={{ height: 40 }} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function ContestSection({
  label, contests, selectedId, onSelect, highlight = false, bucket,
}: {
  label: string;
  contests: Contest[];
  selectedId: string | null;
  onSelect: (c: Contest) => void;
  highlight?: boolean;
  bucket: "past" | "present" | "upcoming";
}) {
  const pill = BUCKET_PILL[bucket];
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
                {formatDateShort(c.date)}
              </div>
              <div style={{ marginTop: 3 }}>
                <span style={{
                  display: "inline-block",
                  fontSize: 10, fontWeight: 700,
                  padding: "1px 6px", borderRadius: 999,
                  background: isSelected ? "rgba(255,255,255,0.2)" : pill.bg,
                  color:      isSelected ? "#fff"                    : pill.color,
                }}>
                  {pill.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
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
  player: p, selected, canEdit, lang, isOut, onClick,
}: {
  player: ContestPlayer;
  selected: boolean;
  canEdit: boolean;
  lang: string;
  isOut: boolean;
  onClick: () => void;
}) {
  const tc = TIER_COLOR[p.tier];

  return (
    <button
      onClick={onClick}
      disabled={!canEdit && !selected}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10,
        padding: "10px 12px", textAlign: "left",
        background: selected
          ? "rgba(30,58,138,0.06)"
          : isOut ? "#fafafa" : "#fff",
        border: `1px solid ${selected ? "#93c5fd" : "#e5e7eb"}`,
        borderRadius: 10, cursor: canEdit ? "pointer" : "default",
        transition: "all 0.15s",
        opacity: isOut && !selected ? 0.55 : 1,
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

      {/* Player info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: "#111827",
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {p.name}
        </div>
        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 1, display: "flex", alignItems: "center", gap: 4 }}>
          <span>{translateTeam(p.team, lang as "en" | "zh")}</span>
          <span>·</span>
          <span>{p.position}</span>
          {p.injury && (
            <span style={{
              padding: "1px 6px", borderRadius: 4, fontSize: 10, fontWeight: 700,
              background: isOut ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)",
              color: isOut ? "#ef4444" : "#d97706",
              marginLeft: 2,
            }}>
              {p.injury}
            </span>
          )}
        </div>
      </div>

      {/* Avg FPTS + tier */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>
          {p.fpts_avg.toFixed(1)}
        </span>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>avg</span>
      </div>

      <div style={{ flexShrink: 0 }}>
        <span style={{
          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
        }}>
          T{p.tier}
        </span>
      </div>
    </button>
  );
}
