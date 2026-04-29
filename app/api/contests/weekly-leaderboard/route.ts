export const dynamic = "force-dynamic";
// app/api/contests/weekly-leaderboard/route.ts
//
// GET /api/contests/weekly-leaderboard?week=YYYY-MM-DD
//
// Returns the weekly points leaderboard for the calendar week (Mon–Sun UTC)
// that contains the given date.  If `week` is omitted, defaults to today.
//
// Data is aggregated from user_lineups WHERE status='scored' joined with
// contests WHERE date BETWEEN week_start AND week_end.
// Uses points_awarded (written by settlement job) — never front-end computed.
//
// ── Response ──────────────────────────────────────────────────
// {
//   "week_start": "2026-04-27",
//   "week_end":   "2026-05-03",
//   "entries": [
//     {
//       "weekly_rank":        1,
//       "user_id":            "...",
//       "username":           "marcus",
//       "weekly_points":      900,
//       "participation_days": 3,
//       "best_daily_rank":    1
//     },
//     ...
//   ]
// }
//
// Before any contest in the week is scored, entries is [].

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/contest-points";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const anchor = weekParam ? new Date(weekParam + "T00:00:00Z") : new Date();
  const weekStart = toDateStr(getWeekStart(anchor));
  const weekEnd   = toDateStr(getWeekEnd(anchor));

  const supabase = db();

  // 1. Get all scored contests in the week.
  const { data: weekContests, error: wcErr } = await supabase
    .from("contests")
    .select("id")
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .eq("status", "scored");

  if (wcErr) return NextResponse.json({ error: wcErr.message }, { status: 500 });

  if (!weekContests || weekContests.length === 0) {
    return NextResponse.json({ week_start: weekStart, week_end: weekEnd, entries: [] });
  }

  const contestIds = (weekContests as any[]).map((c) => c.id);

  // 2. Fetch all scored lineups for those contests, joining users for username.
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("user_id, points_awarded, rank, users!inner(username, name)")
    .in("contest_id", contestIds)
    .eq("status", "scored");

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  // 3. Aggregate per user in JS.
  type UserAgg = {
    user_id: string;
    username: string;
    weekly_points: number;
    participation_days: number;
    best_daily_rank: number;
  };

  const userMap = new Map<string, UserAgg>();
  for (const row of (lineups as any[] ?? [])) {
    const uid = row.user_id as string;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        user_id: uid,
        username: (row.users as any)?.username ?? "",
        weekly_points: 0,
        participation_days: 0,
        best_daily_rank: Infinity,
      });
    }
    const agg = userMap.get(uid)!;
    agg.weekly_points += Number(row.points_awarded) || 0;
    agg.participation_days += 1;
    if (row.rank != null && row.rank < agg.best_daily_rank) {
      agg.best_daily_rank = row.rank;
    }
  }

  // 4. Sort: weekly_points DESC, participation_days DESC, username ASC.
  const sorted = [...userMap.values()]
    .map((u) => ({ ...u, best_daily_rank: u.best_daily_rank === Infinity ? null : u.best_daily_rank }))
    .sort((a, b) => {
      if (b.weekly_points !== a.weekly_points) return b.weekly_points - a.weekly_points;
      if (b.participation_days !== a.participation_days) return b.participation_days - a.participation_days;
      return a.username.localeCompare(b.username);
    });

  // 5. Assign weekly ranks (competition ranking, gaps on ties by weekly_points).
  let rankCursor = 1;
  const entries = sorted.map((u, i) => {
    if (i === 0 || sorted[i].weekly_points !== sorted[i - 1].weekly_points) {
      rankCursor = i + 1;
    }
    return { weekly_rank: rankCursor, ...u };
  });

  return NextResponse.json({ week_start: weekStart, week_end: weekEnd, entries });
}
