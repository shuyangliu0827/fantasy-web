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
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
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
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (cErr)    return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  // Fetch submitted/locked/scored entries only (exclude drafts from public board).
  // Order: rank ASC (nulls at bottom for pre-scoring), then submitted_at ASC.
  // submitted_at ordering is the deterministic tiebreaker for equal rank.
  const { data: entries, count, error: eErr } = await supabase
    .from("user_lineups")
    .select(
      "rank, user_id, status, total_fpts, submitted_at, users!inner(username)",
      { count: "exact" },
    )
    .eq("contest_id", id)
    .in("status", ["submitted", "locked", "scored"])
    .order("rank",         { ascending: true,  nullsFirst: false })
    .order("submitted_at", { ascending: true,  nullsFirst: false })
    .range(offset, offset + limit - 1);

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 });

  const shaped = (entries ?? []).map((row: any) => ({
    rank:         row.rank         ?? null,
    user_id:      row.user_id,
    username:     (row.users as any)?.username ?? "",
    total_fpts:   row.total_fpts   ?? null,
    status:       row.status,
    submitted_at: row.submitted_at ?? null,
  }));

  return NextResponse.json({
    contest_id: id,
    status:     contest.status,
    total:      count ?? 0,
    entries:    shaped,
  });
}
