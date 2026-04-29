export const dynamic = "force-dynamic";
// GET /api/contests/user-df-stats?user_id=<uuid>
//
// Returns Daily Fantasy stats for a single user.  Public — no auth required.
// Used by profile pages (/u/[username]) to display the DF stats card.
//
// Response 200 (has played):
// {
//   "has_played": true,
//   "total_points": 3420,
//   "weekly_points": 860,
//   "participation_days": 12,
//   "best_daily_rank": 3
// }
//
// Response 200 (never played):
// { "has_played": false }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/contest-points";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function db() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

function serviceDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export async function GET(req: Request) {
  const userId = new URL(req.url).searchParams.get("user_id");
  if (!userId) return NextResponse.json({ error: "user_id required" }, { status: 400 });

  const supabase = db();

  // Fetch all scored lineups with contest date for weekly filtering
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, contest_id, points_awarded, rank, contests(date)")
    .eq("user_id", userId)
    .eq("status", "scored");

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (!lineups || lineups.length === 0) return NextResponse.json({ has_played: false });

  // ── Total points: try points_transactions first ────────────────────
  let total_points = 0;
  const { data: ptRows } = await serviceDb()
    .from("points_transactions")
    .select("amount")
    .eq("user_id", userId)
    .in("reason", ["daily_rank_reward", "participation_reward"]);

  if (ptRows && (ptRows as any[]).length > 0) {
    total_points = (ptRows as any[]).reduce((s, r) => s + (Number(r.amount) || 0), 0);
  } else {
    total_points = (lineups as any[]).reduce((s, l) => s + (Number(l.points_awarded) || 0), 0);
  }

  // ── Weekly points (current Mon–Sun, from user_lineups) ────────────
  const weekStart = toDateStr(getWeekStart());
  const weekEnd   = toDateStr(getWeekEnd());
  const weekly_points = (lineups as any[])
    .filter((l) => {
      const d = (l.contests as any)?.date;
      return d && d >= weekStart && d <= weekEnd;
    })
    .reduce((s, l) => s + (Number(l.points_awarded) || 0), 0);

  // ── Participation days (distinct contest_id) ───────────────────
  const participation_days = new Set((lineups as any[]).map((l) => l.contest_id)).size;

  // ── Best daily rank (MIN, ignoring null) ──────────────────────
  const validRanks = (lineups as any[]).map((l) => l.rank).filter((r) => r != null).map(Number);
  const best_daily_rank = validRanks.length > 0 ? Math.min(...validRanks) : null;

  return NextResponse.json({
    has_played:         true,
    total_points,
    weekly_points,
    participation_days,
    best_daily_rank,
  });
}
