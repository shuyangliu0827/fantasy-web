export const dynamic = "force-dynamic";
// GET /api/contests/my-lineups
//
// Returns all submitted/locked/scored lineups for the authenticated user,
// across all contests, sorted by contest date DESC (newest first).
//
// Each entry includes contest info + player details (name, position, salary,
// actual_fantasy_points) so the page can render without extra requests.
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Response 200:
// {
//   "lineups": [
//     {
//       "lineup_id": "...",
//       "contest_id": "...",
//       "contest_date": "2026-04-30",
//       "contest_status": "open",
//       "status": "submitted",
//       "total_fpts": null,
//       "rank": null,
//       "points_awarded": 0,
//       "submitted_at": "...",
//       "players": [
//         { "slot": 1, "slot_label": "PG", "player_id": "...", "name": "...",
//           "position": "...", "salary": 7100, "actual_fantasy_points": null }
//       ]
//     }
//   ]
// }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";
import { SLOT_LABEL } from "@/lib/contest-positions";

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

  // Try to include points_awarded; fall back if column not yet migrated.
  let pointsMap = new Map<string, number>();
  const { data: paRows, error: paErr } = await supabase
    .from("user_lineups")
    .select("id, points_awarded")
    .in("id", (lineups as any[]).map((l) => l.id));

  if (!paErr && paRows) {
    for (const r of paRows as any[]) {
      pointsMap.set(r.id, r.points_awarded ?? 0);
    }
  }

  const lineupIds = (lineups as any[]).map((l) => l.id);

  // ── 2. Fetch all lineup players ──────────────────────────────
  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("lineup_id, slot, player_id, actual_fantasy_points")
    .in("lineup_id", lineupIds);

  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 });

  // ── 3. Fetch player metadata and salaries ────────────────────
  const allPlayerIds = [...new Set((lineupPlayers as any[] ?? []).map((p) => String(p.player_id)))];
  const intIds = allPlayerIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));

  // Get contest_ids to fetch salaries
  const contestIds = [...new Set((lineups as any[]).map((l) => l.contest_id))];

  const [pscRes, cpRes] = await Promise.all([
    intIds.length
      ? supabase.from("player_stats_cache").select("player_id, name, position").in("player_id", intIds)
      : Promise.resolve({ data: [], error: null }),
    contestIds.length && allPlayerIds.length
      ? supabase.from("contest_players").select("contest_id, player_id, salary").in("contest_id", contestIds).in("player_id", allPlayerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

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
    });
  }

  // ── 5. Sort and enrich each lineup ───────────────────────────
  const result = (lineups as any[])
    .map((l) => {
      const contest = l.contests as any;
      const players = (playersByLineup.get(l.id) ?? [])
        .map((p) => ({
          ...p,
          salary: salaryMap.get(`${l.contest_id}:${String(p.player_id)}`) ?? 0,
        }))
        .sort((a: any, b: any) => a.slot - b.slot);

      return {
        lineup_id:      l.id,
        contest_id:     l.contest_id,
        contest_date:   contest?.date   ?? null,
        contest_status: contest?.status ?? null,
        status:         l.status,
        total_fpts:     l.total_fpts    ?? null,
        rank:           l.rank          ?? null,
        points_awarded: pointsMap.get(l.id) ?? 0,
        submitted_at:   l.submitted_at  ?? null,
        players,
      };
    })
    // Sort by contest_date DESC (newest first)
    .sort((a, b) => {
      if (!a.contest_date && !b.contest_date) return 0;
      if (!a.contest_date) return 1;
      if (!b.contest_date) return -1;
      return b.contest_date.localeCompare(a.contest_date);
    });

  return NextResponse.json({ lineups: result });
}
