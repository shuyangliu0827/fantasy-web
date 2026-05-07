export const dynamic = "force-dynamic";
// GET /api/contests/season-weeks
//
// Returns the list of Daily Fantasy season weeks that are relevant to the
// current user: the current week + all weeks where the user has submitted
// lineups (submitted / locked / scored).
//
// Also returns seasonWeek1Start: the Monday of the week containing the
// very first contest ever created in the system.
//
// Response:
// {
//   "seasonWeek1Start": "2026-04-06",
//   "currentWeekStart": "2026-05-04",
//   "weeks": [
//     {
//       "weekStart": "2026-04-06",
//       "weekEnd":   "2026-04-12",
//       "weekNum":   1,
//       "count":     3,
//       "isCurrent": false
//     },
//     ...
//   ]
// }
//
// Weeks are sorted ascending (oldest first).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";
import { getWeekStart, toDateStr } from "@/lib/contest-points";
import { getSeasonWeekNumber, parseDateStrUtc } from "@/lib/contest-weeks";

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

  // ── 1. Find earliest contest to determine season_week_1_start ──
  const { data: firstContest } = await supabase
    .from("contests")
    .select("date")
    .order("date", { ascending: true })
    .limit(1)
    .single();

  const currentWeekMonday = getWeekStart(new Date());
  const currentWeekStartStr = toDateStr(currentWeekMonday);

  let seasonWeek1Start: Date;
  if (firstContest?.date) {
    seasonWeek1Start = getWeekStart(parseDateStrUtc(firstContest.date));
  } else {
    // Fallback: if no contests exist yet, treat current week as week 1
    seasonWeek1Start = currentWeekMonday;
  }
  const seasonWeek1StartStr = toDateStr(seasonWeek1Start);

  // ── 2. Fetch all contest dates where this user has a lineup ────
  const { data: lineups } = await supabase
    .from("user_lineups")
    .select("contests(date)")
    .eq("user_id", userId)
    .in("status", ["submitted", "locked", "scored"]);

  // Collect all contest dates from user lineups
  const contestDates: string[] = [];
  for (const l of (lineups as any[] ?? [])) {
    const date = (l.contests as any)?.date;
    if (date) contestDates.push(date as string);
  }

  // ── 3. Compute the set of week-start strings to include ────────
  // Always include current week. Add weeks for each user contest date.
  const weekStartSet = new Set<string>();
  weekStartSet.add(currentWeekStartStr);

  for (const date of contestDates) {
    const ws = toDateStr(getWeekStart(parseDateStrUtc(date)));
    weekStartSet.add(ws);
  }

  // ── 4. Count user lineups per week ────────────────────────────
  const countByWeek = new Map<string, number>();
  for (const date of contestDates) {
    const ws = toDateStr(getWeekStart(parseDateStrUtc(date)));
    countByWeek.set(ws, (countByWeek.get(ws) ?? 0) + 1);
  }

  // ── 5. Build sorted week list ─────────────────────────────────
  const weekStarts = Array.from(weekStartSet).sort();

  const weeks = weekStarts.map((ws) => {
    const weekStartDate = parseDateStrUtc(ws);
    const weekEndDate   = new Date(weekStartDate);
    weekEndDate.setUTCDate(weekStartDate.getUTCDate() + 6);

    return {
      weekStart:  ws,
      weekEnd:    toDateStr(weekEndDate),
      weekNum:    getSeasonWeekNumber(weekStartDate, seasonWeek1Start),
      count:      countByWeek.get(ws) ?? 0,
      isCurrent:  ws === currentWeekStartStr,
    };
  });

  return NextResponse.json({
    seasonWeek1Start: seasonWeek1StartStr,
    currentWeekStart: currentWeekStartStr,
    weeks,
  });
}
