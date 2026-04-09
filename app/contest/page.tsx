"use client";

import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getSessionUser } from "@/lib/store";
import { translateTeam } from "@/lib/i18n";
import { useLang } from "@/lib/lang";
import { getMyLineup, saveLineup, submitLineup } from "@/lib/contest-fetch";
import { isEligibleForContestSlot, SLOT_LABEL, parsePositions } from "@/lib/contest-positions";

// ── Types ─────────────────────────────────────────────────────

type Contest = {
  id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string;
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

// ── Helpers ───────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
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
  const { lang } = useLang();

  // Auth
  const [user] = useState(() => getSessionUser());

  // Contest data
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
      // 1. Today's contest
      const cr = await fetch("/api/contests/today");
      if (!cr.ok) {
        // Parse error body if possible; fall back gracefully if the server
        // returned a non-JSON response (e.g. HTML crash page from Vercel).
        let errorCode = "";
        try { errorCode = (await cr.json())?.error ?? ""; } catch { /* non-JSON */ }
        setPageError(
          errorCode === "no_contest_today"
            ? "No contest is scheduled for today. Check back tomorrow."
            : "Failed to load contest."
        );
        return;
      }
      const c: Contest = await cr.json();
      setContest(c);

      // 2. Player pool
      const pr = await fetch(`/api/contests/${c.id}/players`);
      if (pr.ok) {
        const { players: pool } = await pr.json();
        setPlayers(pool ?? []);
      }

      // 3. Existing lineup (requires auth; 404 = no lineup yet = fine)
      if (user) {
        const { data } = await getMyLineup(c.id);
        if (data) {
          const next: (string | null)[] = [null, null, null, null, null];
          for (const p of data.players) next[p.slot - 1] = p.player_id;
          setSlots(next);
          setLineupStatus(data.status);
        }
      }
    } catch {
      setPageError("Network error. Please refresh and try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Derived ─────────────────────────────────────────────────

  const filledCount   = slots.filter(Boolean).length;
  const inLineup      = new Set(slots.filter(Boolean) as string[]);
  const playerMap     = new Map(players.map((p) => [p.player_id, p]));

  const isPastDeadline = contest
    ? contest.status === "locked" || contest.status === "scored" || now >= new Date(contest.lineup_lock_at)
    : false;
  const isReadOnly    = isPastDeadline || lineupStatus === "locked" || lineupStatus === "scored";
  const isSubmitted   = lineupStatus === "submitted" || lineupStatus === "locked" || lineupStatus === "scored";
  const canEdit       = !!user && !isReadOnly;

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

        {/* ── Contest header ──────────────────────────────────── */}
        {contest && (
          <div style={{
            background: "#fff", borderBottom: "1px solid #e5e7eb",
            padding: "16px 16px 14px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, color: "#6b7280", textTransform: "uppercase" }}>
                  Daily Contest
                </span>
                <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 2 }}>
                  {formatDate(contest.date)}
                </div>
              </div>
              {/* Status pill */}
              <span style={{
                padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                background: STATUS_PILL[contest.status]?.bg ?? "#f3f4f6",
                color:      STATUS_PILL[contest.status]?.color ?? "#374151",
              }}>
                {STATUS_PILL[contest.status]?.label ?? contest.status}
              </span>
            </div>

            {/* Lock info */}
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

        {/* ── Main content ────────────────────────────────────── */}
        {!loading && !pageError && contest && (
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
                  My Lineup
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

            {/* ── Action buttons ────────────────────────────── */}
            {user && !isReadOnly && (
              <div style={{ padding: "12px 16px 0", display: "flex", gap: 8 }}>
                <button
                  onClick={handleSave}
                  disabled={saving || filledCount !== 5}
                  style={{
                    flex: 1, padding: "11px 0",
                    background: "#fff", border: "1px solid #d1d5db",
                    borderRadius: 10, fontSize: 14, fontWeight: 600,
                    color: filledCount === 5 ? "#374151" : "#9ca3af",
                    cursor: filledCount === 5 && !saving ? "pointer" : "not-allowed",
                    opacity: filledCount === 5 ? 1 : 0.5,
                    transition: "all 0.15s",
                  }}
                >
                  {saving ? "Saving…" : "Save Draft"}
                </button>

                <button
                  onClick={handleSubmit}
                  disabled={!canEdit || filledCount !== 5 || submitting}
                  style={{
                    flex: 2, padding: "11px 0",
                    background: canEdit && filledCount === 5
                      ? "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)"
                      : "#e5e7eb",
                    border: "none", borderRadius: 10,
                    fontSize: 14, fontWeight: 700,
                    color: canEdit && filledCount === 5 ? "#000" : "#9ca3af",
                    cursor: canEdit && filledCount === 5 && !submitting ? "pointer" : "not-allowed",
                    transition: "all 0.15s",
                  }}
                >
                  {submitting ? "Submitting…" : isSubmitted ? "Resubmit Lineup" : "Submit Lineup"}
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
