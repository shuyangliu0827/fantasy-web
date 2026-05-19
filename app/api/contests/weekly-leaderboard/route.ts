export const dynamic = "force-dynamic";
// app/api/contests/weekly-leaderboard/route.ts
//
// GET /api/contests/weekly-leaderboard?week=YYYY-MM-DD
//
// Returns the weekly points leaderboard for the Mon–Sun UTC calendar week.
// Includes ALL users who submitted a lineup this week — not just scored ones —
// so the board is never empty while contests are pending settlement.
//
// Points source: user_lineups.points_awarded (written by settlement job).
// Unsettled lineups contribute 0 points; settled_contests/total_contests
// in the response lets the UI show a "X of Y settled" notice.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/fantasy/daily/points";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const weekParam = url.searchParams.get("week");
  const anchor    = weekParam ? new Date(weekParam + "T00:00:00Z") : new Date();
  const weekStart = toDateStr(getWeekStart(anchor));
  const weekEnd   = toDateStr(getWeekEnd(anchor));

  let supabase: ReturnType<typeof db>;
  try { supabase = db(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // 1. Get ALL contests in the week (any status — not just scored).
  const { data: weekContests, error: wcErr } = await supabase
    .from("contests")
    .select("id, status")
    .gte("date", weekStart)
    .lte("date", weekEnd);

  if (wcErr) return NextResponse.json({ error: wcErr.message }, { status: 500 });

  const allContest    = (weekContests as any[]) ?? [];
  const total_contests   = allContest.length;
  const settled_contests = allContest.filter((c) => c.status === "scored").length;

  if (total_contests === 0) {
    return NextResponse.json({
      week_start: weekStart, week_end: weekEnd,
      settled_contests: 0, total_contests: 0, entries: [],
    });
  }

  const contestIds = allContest.map((c) => c.id);

  // 2. Fetch all submitted / locked / scored lineups for those contests.
  // points_awarded is 0 (default) for unsettled lineups — that's correct.
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("user_id, points_awarded, rank, contest_id")
    .in("contest_id", contestIds)
    .in("status", ["submitted", "locked", "scored"]);

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  if (!lineups || lineups.length === 0) {
    return NextResponse.json({
      week_start: weekStart, week_end: weekEnd,
      settled_contests, total_contests, entries: [],
    });
  }

  // 3. Aggregate per user.
  type UserAgg = {
    user_id: string; username: string;
    weekly_points: number; participation_days: number; best_daily_rank: number;
  };

  const userMap    = new Map<string, UserAgg>();
  const contestSet = new Map<string, Set<string>>(); // uid → Set<contest_id>

  for (const row of (lineups as any[])) {
    const uid = row.user_id as string;
    if (!userMap.has(uid)) {
      userMap.set(uid, { user_id: uid, username: "", weekly_points: 0, participation_days: 0, best_daily_rank: Infinity });
      contestSet.set(uid, new Set());
    }
    const agg  = userMap.get(uid)!;
    const cSet = contestSet.get(uid)!;
    if (!cSet.has(row.contest_id)) {
      cSet.add(row.contest_id);
      agg.participation_days += 1;
    }
    agg.weekly_points += Number(row.points_awarded) || 0;
    if (row.rank != null && row.rank < agg.best_daily_rank) agg.best_daily_rank = row.rank;
  }

  // 3b. Fetch usernames.
  const activeUids = [...userMap.keys()];
  const { data: usersData } = await supabase
    .from("users").select("id, username").in("id", activeUids);
  for (const u of (usersData as any[] ?? [])) {
    const agg = userMap.get(u.id);
    if (agg) agg.username = u.username ?? "";
  }

  // 4. Sort: weekly_points DESC, participation_days DESC, username ASC.
  const sorted = [...userMap.values()]
    .map((u) => ({ ...u, best_daily_rank: u.best_daily_rank === Infinity ? null : u.best_daily_rank }))
    .sort((a, b) => {
      if (b.weekly_points !== a.weekly_points) return b.weekly_points - a.weekly_points;
      if (b.participation_days !== a.participation_days) return b.participation_days - a.participation_days;
      return a.username.localeCompare(b.username);
    });

  // 5. Assign weekly ranks (competition ranking — gaps on ties by weekly_points).
  let rankCursor = 1;
  const entries = sorted.map((u, i) => {
    if (i === 0 || sorted[i].weekly_points !== sorted[i - 1].weekly_points) rankCursor = i + 1;
    return { weekly_rank: rankCursor, ...u };
  });

  return NextResponse.json({ week_start: weekStart, week_end: weekEnd, settled_contests, total_contests, entries }, { headers: { "Cache-Control": "no-store" } });
}
