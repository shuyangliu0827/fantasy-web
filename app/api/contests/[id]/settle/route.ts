export const dynamic = "force-dynamic";
// app/api/contests/[id]/settle/route.ts
//
// POST /api/contests/[id]/settle
//
// Settlement job for a Daily Fantasy contest.  Designed to be called by a
// cron job (or manually by an admin) after the contest's games are complete.
//
// ── What it does ──────────────────────────────────────────────
//   1. Verifies the contest exists and its lineup_lock_at has passed.
//   2. Fetches all submitted / locked / scored lineups for the contest.
//   3. Reads actual fantasy points from player_day_stats for the contest date.
//   4. Sums 5-player fpts per lineup → total_fpts.
//   5. Sorts DESC total_fpts, ASC submitted_at (tie-break: earlier submitter wins).
//   6. Assigns competition ranks (RANK() semantics; ties share rank, next rank skips).
//   7. Calculates points_awarded per rank using lib/contest-points.ts rules.
//   8. Writes:
//      • user_lineup_players.actual_fantasy_points
//      • contest_players.fpts_scored
//      • user_lineups: total_fpts, rank, points_awarded, status='scored'
//      • points_transactions (UPSERT — idempotent via UNIQUE(lineup_id, reason))
//      • contests.status = 'scored'
//
// ── Idempotency ───────────────────────────────────────────────
// Safe to run multiple times.  Each run recomputes scores from player_day_stats
// and UPSERTs results.  Re-runs update existing points_transactions rows
// rather than inserting duplicates (UNIQUE (lineup_id, reason) constraint).
//
// ── Auth ──────────────────────────────────────────────────────
// Requires Authorization: Bearer <CRON_SECRET> header
//   or ?secret=<CRON_SECRET> query param.
//
// Error responses:
//   401 { "error": "unauthorized" }
//   404 { "error": "contest_not_found" }
//   409 { "error": "contest_not_yet_locked" }  — called before lock_time
//   500 { "error": "<message>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { calcPointsAwarded, assignRanks } from "@/lib/contest-points";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Read-only client (anon key) — for fetching contests, lineups, player stats.
function db() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Write client using service_role key — bypasses RLS for settlement writes.
// Falls back to anon key only if SUPABASE_SERVICE_ROLE_KEY is not configured
// (useful in local dev without a service key set up).
function serviceDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

function checkAuth(req: Request): boolean {
  const cronSecret  = process.env.CRON_SECRET;
  const svcKey      = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader  = req.headers.get("Authorization") ?? "";
  const querySecret = new URL(req.url).searchParams.get("secret") ?? "";

  // Primary: CRON_SECRET for Vercel cron / external scheduler.
  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret)) return true;

  // Secondary: service_role key lets admins trigger settlement manually
  // (e.g. curl -H "Authorization: Bearer <svc_key>" POST /api/contests/<id>/settle).
  if (svcKey && authHeader === `Bearer ${svcKey}`) return true;

  return false;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = db();          // reads (anon key)
  const svcDb   = serviceDb();    // writes (service_role bypasses RLS)

  // ── 1. Fetch contest ─────────────────────────────────────────
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr)     return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  if (new Date() < new Date(contest.lineup_lock_at)) {
    return NextResponse.json({ error: "contest_not_yet_locked" }, { status: 409 });
  }

  // ── 2. Fetch submitted / locked / scored lineups ─────────────
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, user_id, status, submitted_at")
    .eq("contest_id", id)
    .in("status", ["submitted", "locked", "scored"]);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  if (!lineups || lineups.length === 0) {
    await svcDb.from("contests").update({ status: "scored" }).eq("id", id);
    return NextResponse.json({ settled: 0, message: "no submitted lineups" });
  }

  const lineupIds = (lineups as any[]).map((l) => l.id);

  // ── 3. Fetch all lineup players ──────────────────────────────
  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("id, lineup_id, player_id")
    .in("lineup_id", lineupIds);

  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 });

  const allPlayerIds = [...new Set((lineupPlayers as any[] ?? []).map((p) => String(p.player_id)))];

  // ── 4. Fetch actual fpts from player_day_stats ───────────────
  // Source of truth: player_day_stats.fpts WHERE date = contest.date.
  // Players absent from this table are treated as DNP (0 fpts).
  // If stats haven't been ingested yet the row simply won't exist,
  // so settle only after the nba-game-stats pipeline has run for contest.date.
  const { data: dayStats, error: dsErr } = await supabase
    .from("player_day_stats")
    .select("player_id, fpts")
    .eq("date", contest.date)
    .in("player_id", allPlayerIds);

  if (dsErr) return NextResponse.json({ error: dsErr.message }, { status: 500 });

  // Map: player_id(text) → fpts(number). Players NOT in player_day_stats score 0 (DNP).
  const fptsMap = new Map<string, number | null>();
  for (const s of (dayStats as any[] ?? [])) {
    fptsMap.set(String(s.player_id), s.fpts != null ? Number(s.fpts) : null);
  }

  // ── 5. Group players by lineup, compute lineup totals ────────
  // actual_fpts is null when no player_day_stats row found (DNP or stats not yet ingested).
  // For total_fpts we treat null as 0 so ranking is still deterministic.
  type LPRow = { id: string; player_id: string; actual_fpts: number | null; fpts_for_total: number };
  const playersByLineup = new Map<string, LPRow[]>();
  for (const lp of (lineupPlayers as any[] ?? [])) {
    const actual_fpts = fptsMap.has(String(lp.player_id)) ? fptsMap.get(String(lp.player_id))! : null;
    if (!playersByLineup.has(lp.lineup_id)) playersByLineup.set(lp.lineup_id, []);
    playersByLineup.get(lp.lineup_id)!.push({
      id: lp.id,
      player_id: lp.player_id,
      actual_fpts,
      fpts_for_total: actual_fpts ?? 0,
    });
  }

  type LineupTotal = {
    id: string;
    user_id: string;
    submitted_at: string | null;
    total_fpts: number;
    players: LPRow[];
  };

  const lineupTotals: LineupTotal[] = (lineups as any[]).map((l) => ({
    id: l.id,
    user_id: l.user_id,
    submitted_at: l.submitted_at,
    total_fpts: (playersByLineup.get(l.id) ?? []).reduce((sum, p) => sum + p.fpts_for_total, 0),
    players: playersByLineup.get(l.id) ?? [],
  }));

  // ── 6. Sort: DESC total_fpts, ASC submitted_at (tie-break) ───
  lineupTotals.sort((a, b) => {
    if (b.total_fpts !== a.total_fpts) return b.total_fpts - a.total_fpts;
    const at = a.submitted_at ? new Date(a.submitted_at).getTime() : Infinity;
    const bt = b.submitted_at ? new Date(b.submitted_at).getTime() : Infinity;
    return at - bt;
  });

  const ranks = assignRanks(lineupTotals);
  const totalEntries = lineupTotals.length;

  // ── 7. Write per-player actual_fantasy_points (service role) ─
  // actual_fpts is null when player has no player_day_stats row (DNP assumption).
  for (const lineup of lineupTotals) {
    for (const player of lineup.players) {
      const { error } = await svcDb
        .from("user_lineup_players")
        .update({ actual_fantasy_points: player.actual_fpts })
        .eq("id", player.id);
      if (error) return NextResponse.json({ error: `ulp: ${error.message}` }, { status: 500 });
    }
  }

  // ── 8. Write contest_players.fpts_scored (service role) ──────
  for (const [pid, fpts] of fptsMap) {
    await svcDb
      .from("contest_players")
      .update({ fpts_scored: fpts })
      .eq("contest_id", id)
      .eq("player_id", pid);
  }

  // ── 9. Write user_lineups + points_transactions (service role)
  for (const lineup of lineupTotals) {
    const rank   = ranks.get(lineup.id)!;
    const points = calcPointsAwarded(rank, totalEntries);

    const { error: ulErr } = await svcDb
      .from("user_lineups")
      .update({
        total_fpts:    lineup.total_fpts,
        rank,
        points_awarded: points,
        status:        "scored",
        completed_at:  new Date().toISOString(),
      })
      .eq("id", lineup.id);
    if (ulErr) return NextResponse.json({ error: `lineup: ${ulErr.message}` }, { status: 500 });

    // Upsert is idempotent: UNIQUE (lineup_id, reason) → ON CONFLICT UPDATE amount.
    // Uses service_role so this write bypasses the restrictive RLS on points_transactions.
    const { error: ptErr } = await svcDb
      .from("points_transactions")
      .upsert(
        { user_id: lineup.user_id, contest_id: id, lineup_id: lineup.id, amount: points, reason: "daily_rank_reward" },
        { onConflict: "lineup_id,reason" },
      );
    if (ptErr) return NextResponse.json({ error: `pt: ${ptErr.message}` }, { status: 500 });
  }

  // ── 10. Mark contest scored (service role) ───────────────────
  const { error: csErr } = await svcDb
    .from("contests")
    .update({ status: "scored" })
    .eq("id", id);
  if (csErr) return NextResponse.json({ error: csErr.message }, { status: 500 });

  return NextResponse.json({
    settled: lineupTotals.length,
    contest_id: id,
    date: contest.date,
    entries: lineupTotals.map((l) => ({
      lineup_id: l.id,
      rank: ranks.get(l.id),
      total_fpts: l.total_fpts,
      points_awarded: calcPointsAwarded(ranks.get(l.id)!, totalEntries),
    })),
  });
}
