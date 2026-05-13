export const dynamic = "force-dynamic";
// GET /api/basketball-contests/nearby?leagueSlug=...&days=14
//
// Date-discovery endpoint for authorized-league build pages, analogous
// in purpose to /api/contests/nearby for the NBA DFS flow.
//
// Returns the merged set of authorized-league contest dates in a ±days
// window around today (default ±14, league-local):
//   • Existing basketball_contests rows: { id, ..., placeholder: false }
//   • Dates that have scheduled basketball_games but no contest row yet:
//     { id: null, status: "scheduled", placeholder: true }
//
// Each entry also carries `scheduled_game_count` for the slate badge.
//
// Public — anyone can read.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import { dayBoundsUtc, todayInTimezone } from "@/lib/basketball/contest-date";

type ContestRow = {
  id: string;
  basketball_league_id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
};

type NearbyEntry = {
  id: string | null;
  date: string;
  status: "scheduled" | "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  placeholder: boolean;
  scheduled_game_count: number;
};

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("leagueSlug");
  const daysParam = Number(url.searchParams.get("days") ?? "14");
  const days = Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 60 ? daysParam : 14;

  if (!slug) {
    return NextResponse.json({ error: "missing_league_slug" }, { status: 400 });
  }
  const supabase = serviceDb();

  const { data: league, error: leagueErr } = await supabase
    .from("basketball_leagues")
    .select("id, slug, name, timezone, status, visibility, is_contest_enabled")
    .eq("slug", slug)
    .maybeSingle<{
      id: string; slug: string; name: string; timezone: string;
      status: string; visibility: string; is_contest_enabled: boolean;
    }>();
  if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });
  if (!league) return NextResponse.json({ error: "league_not_found" }, { status: 404 });

  // We always surface scheduling info; gating the contest experience
  // itself happens at by-date/today.
  const tz = league.timezone || "UTC";
  const today = todayInTimezone(tz);
  const windowStartDate = shiftDate(today, -days);
  const windowEndDate = shiftDate(today, days);
  const windowStartUtc = dayBoundsUtc(windowStartDate, tz).startUtc;
  const windowEndUtc = dayBoundsUtc(windowEndDate, tz).endUtc;

  const [contestsRes, gamesRes] = await Promise.all([
    supabase
      .from("basketball_contests")
      .select("id, basketball_league_id, date, status, lineup_lock_at")
      .eq("basketball_league_id", league.id)
      .gte("date", windowStartDate)
      .lte("date", windowEndDate),
    supabase
      .from("basketball_games")
      .select("id, scheduled_at")
      .eq("basketball_league_id", league.id)
      .gte("scheduled_at", windowStartUtc)
      .lte("scheduled_at", windowEndUtc),
  ]);
  if (contestsRes.error) {
    return NextResponse.json({ error: contestsRes.error.message }, { status: 500 });
  }
  if (gamesRes.error) {
    return NextResponse.json({ error: gamesRes.error.message }, { status: 500 });
  }

  // Group games into league-local dates so a 22:30-local game on May 12
  // doesn't end up filed under May 12 UTC = May 13 local for, say,
  // America/Los_Angeles. todayInTimezone(tz, instant) does the conversion.
  const gameCountByDate = new Map<string, number>();
  for (const g of gamesRes.data ?? []) {
    if (!g.scheduled_at) continue;
    const localDate = todayInTimezone(tz, new Date(g.scheduled_at));
    gameCountByDate.set(localDate, (gameCountByDate.get(localDate) ?? 0) + 1);
  }

  const contestByDate = new Map<string, ContestRow>();
  for (const c of (contestsRes.data ?? []) as ContestRow[]) {
    contestByDate.set(c.date, c);
  }

  const allDates = new Set<string>([
    ...contestByDate.keys(),
    ...gameCountByDate.keys(),
  ]);

  const entries: NearbyEntry[] = Array.from(allDates)
    .sort()
    .map((date) => {
      const contest = contestByDate.get(date);
      const count = gameCountByDate.get(date) ?? 0;
      if (contest) {
        return {
          id: contest.id,
          date: contest.date,
          status: contest.status,
          lineup_lock_at: contest.lineup_lock_at,
          placeholder: false,
          scheduled_game_count: count,
        };
      }
      return {
        id: null,
        date,
        status: "scheduled",
        lineup_lock_at: null,
        placeholder: true,
        scheduled_game_count: count,
      };
    });

  return NextResponse.json({
    league: {
      id: league.id,
      slug: league.slug,
      name: league.name,
      timezone: tz,
    },
    today,
    contests: entries,
  });
}
