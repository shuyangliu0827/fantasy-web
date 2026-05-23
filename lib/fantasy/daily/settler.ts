// lib/contest-settler.ts
//
// Core settlement logic extracted for sharing between:
//   app/api/contests/[id]/settle/route.ts        (settle one contest)
//   app/api/contests/settle-all-pending/route.ts  (settle all overdue contests)
//
// Key design:
//   - Calls fetchStatsForDate first so player_day_stats is populated before scoring.
//   - Uses service_role key for all writes (bypasses points_transactions RLS).
//   - Idempotent: UPSERT on points_transactions(lineup_id, reason) prevents double-awarding.

import { createClient } from "@supabase/supabase-js";
import { calcPointsAwarded, assignRanks } from "@/lib/fantasy/daily/points";
import { fetchStatsForDate } from "@/lib/players/game-stats";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function readDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export function writeDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export type SettleResult = {
  contest_id:           string;
  contest_date:         string;
  lineups_found:        number;
  lineups_scored:       number;
  transactions_written: number;
  skipped:              boolean; // true when contest already scored and stats unchanged
  errors:               string[];
};

/**
 * Settles a single contest:
 *  1. Force-refreshes player_day_stats from BDL (final box scores).
 *  2. Computes total_fpts per lineup from player_day_stats.
 *  3. Assigns competition ranks and points_awarded.
 *  4. Writes user_lineup_players.actual_fantasy_points, user_lineups, points_transactions.
 *  5. Marks the contest as scored.
 *
 * Safe to call multiple times — all writes are idempotent.
 * Pass `{ force: true }` to bypass the lineup_lock_at guard and re-settle already-scored contests.
 */
export async function settleContest(
  contestId: string,
  options?: { force?: boolean },
): Promise<SettleResult> {
  const force = options?.force ?? false;
  const supabase = readDb();
  const svcDb    = writeDb();

  const result: SettleResult = {
    contest_id:           contestId,
    contest_date:         "",
    lineups_found:        0,
    lineups_scored:       0,
    transactions_written: 0,
    skipped:              false,
    errors:               [],
  };

  // ── 1. Fetch contest ─────────────────────────────────────────────────
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("id", contestId)
    .maybeSingle();

  if (cErr)     { result.errors.push(cErr.message); return result; }
  if (!contest) { result.errors.push("contest_not_found"); return result; }

  result.contest_date = contest.date;

  if (!force && new Date() < new Date(contest.lineup_lock_at)) {
    result.errors.push("contest_not_yet_locked");
    return result;
  }

  // ── 2. Force-refresh player_day_stats from BDL for this date ────────────
  // forceRefresh bypasses in-memory and DB caches so settlement always uses
  // the latest final box scores, not partial mid-game data.
  try {
    await fetchStatsForDate(contest.date, { forceRefresh: true });
  } catch (err) {
    const msg = `stats_fetch_warning: ${err}`;
    console.warn("[contest-settler]", { contestId, date: contest.date, msg });
    result.errors.push(msg); // non-fatal — scoring will use whatever's in DB
  }

  // ── 3. Fetch submitted / locked / scored lineups ───────────────────────
  // When force=true, include "completed" status so already-settled lineups
  // can be re-scored with corrected stats (idempotent via UPSERT).
  const lineupStatuses = force
    ? ["submitted", "locked", "scored", "completed"]
    : ["submitted", "locked", "scored"];

  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, user_id, status, submitted_at")
    .eq("contest_id", contestId)
    .in("status", lineupStatuses);

  if (lErr) { result.errors.push(`lineups: ${lErr.message}`); return result; }

  if (!lineups || lineups.length === 0) {
    const { error: csErr } = await svcDb
      .from("contests")
      .update({ status: "scored" })
      .eq("id", contestId);
    if (csErr) result.errors.push(`contest_update: ${csErr.message}`);
    return result;
  }

  result.lineups_found = lineups.length;
  const lineupIds = (lineups as any[]).map((l) => l.id);

  // ── 4. Fetch all lineup players ────────────────────────────────────────
  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("id, lineup_id, player_id")
    .in("lineup_id", lineupIds);

  if (lpErr) { result.errors.push(`lineup_players: ${lpErr.message}`); return result; }

  const allPlayerIds = [...new Set((lineupPlayers as any[] ?? []).map((p) => String(p.player_id)))];

  // ── 4b. Validity gate: only score players that are in this contest's pool ──
  // A lineup player missing from contest_players (e.g. the pool was rebuilt and
  // no longer contains them) is invalid for this contest and must not
  // contribute fantasy points. This keeps settlement aligned with the contest
  // snapshot that build / my-lineup / leaderboard display.
  const validPlayerIds = new Set<string>();
  if (allPlayerIds.length > 0) {
    const { data: cpRows, error: cpErr } = await svcDb
      .from("contest_players")
      .select("player_id")
      .eq("contest_id", contestId)
      .in("player_id", allPlayerIds);
    if (cpErr) { result.errors.push(`contest_players: ${cpErr.message}`); return result; }
    for (const r of (cpRows as any[] ?? [])) validPlayerIds.add(String(r.player_id));
  }

  // ── 5. Read fpts from player_day_stats ────────────────────────────────
  const { data: dayStats, error: dsErr } = await svcDb
    .from("player_day_stats")
    .select("player_id, fpts")
    .eq("date", contest.date)
    .in("player_id", allPlayerIds);

  if (dsErr) { result.errors.push(`day_stats: ${dsErr.message}`); return result; }

  const fptsMap = new Map<string, number | null>();
  for (const s of (dayStats as any[] ?? [])) {
    fptsMap.set(String(s.player_id), s.fpts != null ? Number(s.fpts) : null);
  }

  // ── 6. Group players by lineup, compute lineup totals ─────────────────
  type LPRow = { id: string; player_id: string; actual_fpts: number | null; fpts_for_total: number };
  const playersByLineup = new Map<string, LPRow[]>();
  for (const lp of (lineupPlayers as any[] ?? [])) {
    const pid = String(lp.player_id);
    // Invalid players (not in contest_players for this contest) score null and
    // contribute 0 to the lineup total.
    const isValid = validPlayerIds.has(pid);
    const actual_fpts = isValid && fptsMap.has(pid) ? fptsMap.get(pid)! : null;
    if (!playersByLineup.has(lp.lineup_id)) playersByLineup.set(lp.lineup_id, []);
    playersByLineup.get(lp.lineup_id)!.push({
      id: lp.id, player_id: pid,
      actual_fpts,
      fpts_for_total: actual_fpts ?? 0,
    });
  }

  type LineupTotal = { id: string; user_id: string; submitted_at: string | null; total_fpts: number; players: LPRow[] };
  const lineupTotals: LineupTotal[] = (lineups as any[]).map((l) => ({
    id:           l.id,
    user_id:      l.user_id,
    submitted_at: l.submitted_at,
    total_fpts:   (playersByLineup.get(l.id) ?? []).reduce((s, p) => s + p.fpts_for_total, 0),
    players:      playersByLineup.get(l.id) ?? [],
  }));

  // Sort DESC total_fpts, ASC submitted_at (tie-break: earlier submitter wins).
  lineupTotals.sort((a, b) => {
    if (b.total_fpts !== a.total_fpts) return b.total_fpts - a.total_fpts;
    const at = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
    const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
    return at - bt;
  });

  const ranks        = assignRanks(lineupTotals);
  const totalEntries = lineupTotals.length;

  // ── 7. Write per-player actual_fantasy_points ─────────────────────────
  for (const lineup of lineupTotals) {
    for (const player of lineup.players) {
      const { error } = await svcDb
        .from("user_lineup_players")
        .update({ actual_fantasy_points: player.actual_fpts })
        .eq("id", player.id);
      if (error) result.errors.push(`ulp_${player.id}: ${error.message}`);
    }
  }

  // ── 8. Write contest_players.fpts_scored ──────────────────────────────
  for (const [pid, fpts] of fptsMap) {
    await svcDb
      .from("contest_players")
      .update({ fpts_scored: fpts })
      .eq("contest_id", contestId)
      .eq("player_id", pid);
  }

  // ── 9. Write user_lineups + points_transactions ───────────────────────
  let txWritten = 0;
  for (const lineup of lineupTotals) {
    const rank   = ranks.get(lineup.id)!;
    const points = calcPointsAwarded(rank, totalEntries);

    const { error: ulErr } = await svcDb
      .from("user_lineups")
      .update({ total_fpts: lineup.total_fpts, rank, points_awarded: points, status: "scored", completed_at: new Date().toISOString() })
      .eq("id", lineup.id);
    if (ulErr) { result.errors.push(`ul_${lineup.id}: ${ulErr.message}`); continue; }

    const { error: ptErr } = await svcDb
      .from("points_transactions")
      .upsert(
        { user_id: lineup.user_id, contest_id: contestId, lineup_id: lineup.id, amount: points, reason: "daily_rank_reward" },
        { onConflict: "lineup_id,reason" },
      );
    if (ptErr) {
      console.error("[contest-settler] points_transactions upsert failed", { lineup_id: lineup.id, error: ptErr });
      result.errors.push(`pt_${lineup.id}: ${ptErr.message}`);
    } else {
      txWritten++;
    }

    result.lineups_scored++;
  }
  result.transactions_written = txWritten;

  // ── 10. Mark contest scored ───────────────────────────────────────────
  const { error: csErr } = await svcDb
    .from("contests")
    .update({ status: "scored" })
    .eq("id", contestId);
  if (csErr) result.errors.push(`contest_status: ${csErr.message}`);

  console.log("[contest-settler] settled", {
    contestId, date: contest.date, lineups_scored: result.lineups_scored,
    transactions_written: txWritten, errors: result.errors.length,
  });

  return result;
}
