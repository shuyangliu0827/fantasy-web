export const dynamic = "force-dynamic";
// GET /api/contests/season-weeks
//
// Returns every Daily Fantasy season week from Week 1 to the current week,
// regardless of whether the user has any lineup records in that week.
//
// season_week_1_start = Monday of the week containing the earliest contest row.
// Fallback: current week Monday when no contests exist yet.
//
// Response:
// {
//   "seasonWeek1Start": "2026-04-06",
//   "currentWeekStart": "2026-05-04",
//   "weeks": [
//     { "weekStart": "2026-04-06", "weekEnd": "2026-04-12", "weekNum": 1, "count": 0, "isCurrent": false },
//     { "weekStart": "2026-04-13", "weekEnd": "2026-04-19", "weekNum": 2, "count": 2, "isCurrent": false },
//     ...
//     { "weekStart": "2026-05-04", "weekEnd": "2026-05-10", "weekNum": 5, "count": 1, "isCurrent": true }
//   ]
// }
//
// Weeks are sorted ascending (oldest first). No future weeks are included.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/fantasy/daily/auth";
import { getWeekStart, toDateStr } from "@/lib/fantasy/daily/points";
import { getSeasonWeekNumber, parseDateStrUtc } from "@/lib/fantasy/daily/weeks";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function GET(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let supabase: ReturnType<typeof db>;
  try { supabase = db(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // ── 1. Find earliest contest to determine season_week_1_start ──
  const { data: firstContest } = await supabase
    .from("contests")
    .select("date")
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const currentWeekMonday    = getWeekStart(new Date());
  const currentWeekStartStr  = toDateStr(currentWeekMonday);

  let seasonWeek1Start: Date;
  if (firstContest?.date) {
    seasonWeek1Start = getWeekStart(parseDateStrUtc(firstContest.date));
  } else {
    seasonWeek1Start = currentWeekMonday;
  }
  const seasonWeek1StartStr = toDateStr(seasonWeek1Start);

  // ── 2. Fetch user lineup counts grouped by contest date ────────
  const { data: lineups } = await supabase
    .from("user_lineups")
    .select("contests(date)")
    .eq("user_id", userId)
    .in("status", ["submitted", "locked", "scored"]);

  // Aggregate record count by week-start string
  const countByWeek = new Map<string, number>();
  for (const l of (lineups as any[] ?? [])) {
    const date = (l.contests as any)?.date as string | undefined;
    if (!date) continue;
    const ws = toDateStr(getWeekStart(parseDateStrUtc(date)));
    countByWeek.set(ws, (countByWeek.get(ws) ?? 0) + 1);
  }

  // ── 3. Enumerate every week from Week 1 to current week ────────
  const weeks = [];
  let cursor = new Date(seasonWeek1Start);

  while (cursor <= currentWeekMonday) {
    const ws          = toDateStr(cursor);
    const weekEndDate = new Date(cursor);
    weekEndDate.setUTCDate(cursor.getUTCDate() + 6);

    weeks.push({
      weekStart: ws,
      weekEnd:   toDateStr(weekEndDate),
      weekNum:   getSeasonWeekNumber(cursor, seasonWeek1Start),
      count:     countByWeek.get(ws) ?? 0,
      isCurrent: ws === currentWeekStartStr,
    });

    cursor = new Date(cursor);
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return NextResponse.json({
    seasonWeek1Start: seasonWeek1StartStr,
    currentWeekStart: currentWeekStartStr,
    weeks,
  });
}

