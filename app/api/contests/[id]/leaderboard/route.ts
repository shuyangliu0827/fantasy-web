export const dynamic = "force-dynamic";
// app/api/contests/[id]/leaderboard/route.ts
//
// GET /api/contests/[id]/leaderboard
//
// Returns ranked entries for the contest. Public — no auth required.
//
// ── Tie-handling ──────────────────────────────────────────────
// rank uses standard competition ranking (SQL RANK() semantics):
//   scores 50, 45, 45, 40 → ranks 1, 2, 2, 4
// The rank column is written by the scoring job; this route only reads it.
// Among tied entries (same rank), the leaderboard orders by submitted_at ASC
// so the earliest submission appears higher.  For rank=1 ties, the first
// submitter is the champion — this ordering makes that deterministic.
//
// ── Before scoring ────────────────────────────────────────────
// During "open" / "locked": total_fpts and rank are NULL.
// The leaderboard still returns all submitted entries (with null scores)
// so the UI can show a "waiting for results" view with entry count.
//
// ── Query params ──────────────────────────────────────────────
//   limit  — number of entries to return (default 50, max 100)
//   offset — pagination offset (default 0)
//
// ── Sample response 200 (after scoring) ──────────────────────
// {
//   "contest_id": "b1c2...",
//   "status":     "scored",
//   "total":      142,
//   "entries": [
//     { "rank": 1, "user_id": "u1...", "username": "marcus", "total_fpts": 312.5, "status": "scored", "submitted_at": "2026-04-08T21:00:00Z" },
//     { "rank": 2, "user_id": "u2...", "username": "shuyang", "total_fpts": 298.0, "status": "scored", "submitted_at": "2026-04-08T22:30:00Z" },
//     { "rank": 2, "user_id": "u3...", "username": "wei", "total_fpts": 298.0, "status": "scored", "submitted_at": "2026-04-08T23:00:00Z" },
//     { "rank": 4, "user_id": "u4...", "username": "alex", "total_fpts": 275.5, "status": "scored", "submitted_at": "2026-04-08T20:15:00Z" }
//   ]
// }
//
// ── Sample response 200 (before scoring) ─────────────────────
// {
//   "contest_id": "b1c2...",
//   "status":     "locked",
//   "total":      87,
//   "entries": [
//     { "rank": null, "user_id": "u1...", "username": "marcus", "total_fpts": null, "status": "locked", "submitted_at": "2026-04-08T21:00:00Z" },
//     ...
//   ]
// }
//
// Error responses:
//   404 { "error": "contest_not_found" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT     = 100;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = db();
  const url    = new URL(req.url);
  const limit  = Math.min(Math.max(parseInt(url.searchParams.get("limit")  ?? String(DEFAULT_LIMIT)), 1), MAX_LIMIT);
  const offset = Math.max(parseInt(url.searchParams.get("offset") ?? "0"), 0);

  // Verify contest
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, status, lineup_lock_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr)     return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  const isLocked = (contest as any).status === "locked" || (contest as any).status === "scored"
    || new Date() >= new Date((contest as any).lineup_lock_at);

  // Fetch submitted/locked/scored entries (exclude drafts).
  // Try selecting points_awarded; if the column doesn't exist yet (migration pending),
  // fall back to a query without it and default to 0.
  let entries: any[] | null = null;
  let count: number | null = null;

  const baseSelect = "id, rank, user_id, status, total_fpts, submitted_at, users!inner(username)";
  const fullSelect = `${baseSelect}, points_awarded`;

  const fullResult = await supabase
    .from("user_lineups")
    .select(fullSelect, { count: "exact" })
    .eq("contest_id", id)
    .in("status", ["submitted", "locked", "scored"])
    .order("rank",         { ascending: true,  nullsFirst: false })
    .order("submitted_at", { ascending: true,  nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (fullResult.error?.message?.includes("points_awarded")) {
    // Migration 027 not yet applied — fall back without points_awarded.
    const fallback = await supabase
      .from("user_lineups")
      .select(baseSelect, { count: "exact" })
      .eq("contest_id", id)
      .in("status", ["submitted", "locked", "scored"])
      .order("rank",         { ascending: true,  nullsFirst: false })
      .order("submitted_at", { ascending: true,  nullsFirst: false })
      .range(offset, offset + limit - 1);
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    entries = fallback.data;
    count   = fallback.count;
  } else if (fullResult.error) {
    return NextResponse.json({ error: fullResult.error.message }, { status: 500 });
  } else {
    entries = fullResult.data;
    count   = fullResult.count;
  }

  // After lock: enrich each entry with player details so the UI can show lineups.
  let playersByLineup: Map<string, any[]> = new Map();
  if (isLocked && entries && entries.length > 0) {
    const lineupIds = (entries as any[]).map((e) => e.id);

    const [lpRes, cpRes, pscRes] = await Promise.all([
      supabase
        .from("user_lineup_players")
        .select("lineup_id, slot, player_id, actual_fantasy_points")
        .in("lineup_id", lineupIds),
      supabase
        .from("contest_players")
        .select("player_id, salary")
        .eq("contest_id", id),
      // player_stats_cache uses integer player_id; contest_players uses text.
      supabase
        .from("player_stats_cache")
        .select("player_id, name, position"),
    ]);

    const salaryMap = new Map<string, number>(
      ((cpRes.data as any[]) ?? []).map((r) => [String(r.player_id), r.salary]),
    );
    const nameMap = new Map<string, { name: string; position: string }>(
      ((pscRes.data as any[]) ?? []).map((r) => [String(r.player_id), r]),
    );

    for (const lp of (lpRes.data as any[] ?? [])) {
      const meta = nameMap.get(String(lp.player_id));
      const slot_labels: Record<number, string> = { 1: "PG", 2: "SG", 3: "SF", 4: "PF", 5: "C" };
      const row = {
        slot:                  lp.slot,
        slot_label:            slot_labels[lp.slot as number] ?? String(lp.slot),
        player_id:             lp.player_id,
        name:                  meta?.name     ?? "",
        position:              meta?.position ?? "",
        salary:                salaryMap.get(String(lp.player_id)) ?? 0,
        actual_fantasy_points: lp.actual_fantasy_points ?? null,
      };
      if (!playersByLineup.has(lp.lineup_id)) playersByLineup.set(lp.lineup_id, []);
      playersByLineup.get(lp.lineup_id)!.push(row);
    }
    // Sort players by slot within each lineup.
    for (const players of playersByLineup.values()) {
      players.sort((a, b) => a.slot - b.slot);
    }
  }

  const shaped = (entries ?? []).map((row: any) => ({
    rank:           row.rank           ?? null,
    user_id:        row.user_id,
    username:       (row.users as any)?.username ?? "",
    total_fpts:     row.total_fpts     ?? null,
    points_awarded: row.points_awarded ?? 0,
    status:         row.status,
    submitted_at:   row.submitted_at   ?? null,
    // Players only exposed after lock — prevents lineup scouting before deadline.
    players:        isLocked ? (playersByLineup.get(row.id) ?? []) : null,
  }));

  return NextResponse.json({
    contest_id: id,
    status:     (contest as any).status,
    locked:     isLocked,
    total:      count ?? 0,
    entries:    shaped,
  });
}
