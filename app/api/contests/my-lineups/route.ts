export const dynamic = "force-dynamic";
// GET /api/contests/my-lineups
//
// Returns submitted/locked/scored lineups for the authenticated user
// within the current natural week (Mon–Sun UTC), sorted by contest_date ASC.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";
import { SLOT_LABEL } from "@/lib/contest-positions";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/contest-points";
import { fetchStatsForDate } from "@/lib/player-game-stats";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = db();

  // ── 1. Fetch all user lineups with contest info ──────────────
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, contest_id, status, total_fpts, rank, submitted_at, contests(id, date, status, lineup_lock_at)")
    .eq("user_id", userId)
    .in("status", ["submitted", "locked", "scored"])
    .order("submitted_at", { ascending: false });

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (!lineups || lineups.length === 0) return NextResponse.json({ lineups: [] });

  // ── Filter to current natural week (Mon–Sun UTC) by contest_date ──
  const weekStart = toDateStr(getWeekStart());
  const weekEnd   = toDateStr(getWeekEnd());
  const weekLineups = (lineups as any[]).filter((l) => {
    const date = (l.contests as any)?.date;
    return date && date >= weekStart && date <= weekEnd;
  });
  if (weekLineups.length === 0) return NextResponse.json({ lineups: [] });

  // Try to include points_awarded; fall back if column not yet migrated.
  let pointsMap = new Map<string, number>();
  const { data: paRows, error: paErr } = await supabase
    .from("user_lineups")
    .select("id, points_awarded")
    .in("id", weekLineups.map((l: any) => l.id));

  if (!paErr && paRows) {
    for (const r of paRows as any[]) {
      pointsMap.set(r.id, r.points_awarded ?? 0);
    }
  }

  const lineupIds = weekLineups.map((l: any) => l.id);

  // ── 2. Fetch all lineup players ──────────────────────────────
  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("lineup_id, slot, player_id, actual_fantasy_points")
    .in("lineup_id", lineupIds);

  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 });

  // ── 3. Fetch player metadata, salaries, and live stats ───────
  const allPlayerIds = [...new Set((lineupPlayers as any[] ?? []).map((p) => String(p.player_id)))];
  const intIds = allPlayerIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));

  const contestIds = [...new Set(weekLineups.map((l: any) => l.contest_id))];

  // Collect contest dates for lineups not yet officially scored.
  const unscoredDates = [
    ...new Set(
      weekLineups
        .filter((l: any) => l.status !== "scored")
        .map((l: any) => (l.contests as any)?.date)
        .filter(Boolean),
    ),
  ] as string[];

  // ── Fetch player metadata + salaries (parallel DB queries) ──
  const [pscRes, cpRes] = await Promise.all([
    intIds.length
      ? supabase.from("player_stats_cache").select("player_id, name, position").in("player_id", intIds)
      : Promise.resolve({ data: [], error: null }),
    contestIds.length && allPlayerIds.length
      ? supabase.from("contest_players").select("contest_id, player_id, salary").in("contest_id", contestIds).in("player_id", allPlayerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // ── Fetch live fpts via shared lib (same BDL pipeline as nba-game-stats route) ──
  // Direct import avoids server-to-server HTTP and shares the in-memory 5-min cache.
  const liveFptsMap = new Map<string, number>(); // "YYYY-MM-DD:player_id" → fpts

  if (unscoredDates.length > 0) {
    await Promise.all(
      unscoredDates.map(async (date) => {
        try {
          const statsForDate = await fetchStatsForDate(date);
          for (const [pid, stats] of Object.entries(statsForDate)) {
            liveFptsMap.set(`${date}:${pid}`, stats.fpts);
          }
        } catch {
          // BDL unavailable for this date — players show "进行中"
        }
      }),
    );
  }

  const metaMap = new Map<string, { name: string; position: string }>(
    ((pscRes.data as any[]) ?? []).map((r) => [String(r.player_id), r]),
  );

  // Salary keyed by "contestId:playerId"
  const salaryMap = new Map<string, number>(
    ((cpRes.data as any[]) ?? []).map((r) => [`${r.contest_id}:${String(r.player_id)}`, r.salary]),
  );

  // ── 4. Group players by lineup ───────────────────────────────
  const playersByLineup = new Map<string, any[]>();
  for (const lp of (lineupPlayers as any[] ?? [])) {
    const meta = metaMap.get(String(lp.player_id));
    if (!playersByLineup.has(lp.lineup_id)) playersByLineup.set(lp.lineup_id, []);
    playersByLineup.get(lp.lineup_id)!.push({
      slot:                  lp.slot,
      slot_label:            SLOT_LABEL[lp.slot as number] ?? String(lp.slot),
      player_id:             lp.player_id,
      name:                  meta?.name     ?? "",
      position:              meta?.position ?? "",
      actual_fantasy_points: lp.actual_fantasy_points ?? null,
      // live_fpts: real-time score from nba-game-stats (BDL live data, same as league scoreboard).
      // Populated for unscored lineups once BDL has box-score data for the player.
      live_fpts:             null as number | null,
    });
  }

  // ── 5. Build result sorted by contest_date ASC (Mon → Sun) ──
  const result = weekLineups
    .map((l: any) => {
      const contest      = l.contests as any;
      const contestDate  = contest?.date ?? null;
      const isScored     = l.status === "scored";

      const players = (playersByLineup.get(l.id) ?? [])
        .map((p) => {
          const salary = salaryMap.get(`${l.contest_id}:${String(p.player_id)}`) ?? 0;
          // For settled lineups actual_fantasy_points is authoritative.
          // For unsettled lineups, fill live_fpts from nba-game-stats (BDL live data).
          const liveKey = `${contestDate}:${String(p.player_id)}`;
          const live_fpts = !isScored && contestDate && liveFptsMap.has(liveKey)
            ? liveFptsMap.get(liveKey)!
            : null;
          return { ...p, salary, live_fpts };
        })
        .sort((a: any, b: any) => a.slot - b.slot);

      // Live total: sum of live_fpts for players whose game has finished.
      const live_total_fpts = !isScored
        ? players.reduce((sum: number, p: any) => sum + (p.live_fpts ?? 0), 0)
        : null;

      return {
        lineup_id:        l.id,
        contest_id:       l.contest_id,
        contest_date:     contestDate,
        contest_status:   contest?.status ?? null,
        status:           l.status,
        total_fpts:       l.total_fpts    ?? null,
        live_total_fpts,
        rank:             l.rank          ?? null,
        points_awarded:   pointsMap.get(l.id) ?? 0,
        submitted_at:     l.submitted_at  ?? null,
        players,
      };
    })
    .sort((a: any, b: any) => {
      if (!a.contest_date && !b.contest_date) return 0;
      if (!a.contest_date) return 1;
      if (!b.contest_date) return -1;
      return a.contest_date.localeCompare(b.contest_date); // oldest first (Mon → Sun)
    });

  return NextResponse.json({ lineups: result });
}
