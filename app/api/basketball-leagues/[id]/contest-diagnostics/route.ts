export const dynamic = "force-dynamic";
// GET /api/basketball-leagues/[id]/contest-diagnostics?date=YYYY-MM-DD
//
// League-admin / platform-admin only. Returns the counts most useful for
// debugging "why is my contest not showing up?": league flags, league
// timezone, games on today/yesterday/tomorrow (league-local), teams
// playing today, and player roster coverage.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";
import { dayBoundsUtc, todayInTimezone } from "@/lib/basketball/contest-date";

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

async function countGamesInBounds(
  supabase: ReturnType<typeof serviceDb>,
  leagueId: string,
  startUtc: string,
  endUtc: string,
): Promise<number> {
  const { count } = await supabase
    .from("basketball_games")
    .select("id", { count: "exact", head: true })
    .eq("basketball_league_id", leagueId)
    .gte("scheduled_at", startUtc)
    .lte("scheduled_at", endUtc);
  return count ?? 0;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const { data: league, error: leagueErr } = await supabase
      .from("basketball_leagues")
      .select("id, slug, status, visibility, is_contest_enabled, timezone")
      .eq("id", id)
      .maybeSingle<{
        id: string; slug: string; status: string;
        visibility: string; is_contest_enabled: boolean; timezone: string;
      }>();
    if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });
    if (!league) return NextResponse.json({ error: "league_not_found" }, { status: 404 });

    const tz = league.timezone || "UTC";
    const url = new URL(req.url);
    const qDate = url.searchParams.get("date");
    const date = qDate && /^\d{4}-\d{2}-\d{2}$/.test(qDate)
      ? qDate
      : todayInTimezone(tz);

    const yesterday = shiftDate(date, -1);
    const tomorrow = shiftDate(date, 1);

    const today = dayBoundsUtc(date, tz);
    const yest = dayBoundsUtc(yesterday, tz);
    const tomo = dayBoundsUtc(tomorrow, tz);

    // Games today: also fetch team ids so we can summarize who plays.
    const [{ data: gamesToday, error: gtErr }, gamesYesterdayCount, gamesTomorrowCount] = await Promise.all([
      supabase
        .from("basketball_games")
        .select("id, home_team_id, away_team_id, scheduled_at, status")
        .eq("basketball_league_id", id)
        .gte("scheduled_at", today.startUtc)
        .lte("scheduled_at", today.endUtc),
      countGamesInBounds(supabase, id, yest.startUtc, yest.endUtc),
      countGamesInBounds(supabase, id, tomo.startUtc, tomo.endUtc),
    ]);
    if (gtErr) return NextResponse.json({ error: gtErr.message }, { status: 500 });

    const teamsPlayingToday = Array.from(
      new Set(
        (gamesToday ?? [])
          .flatMap((g) => [g.home_team_id, g.away_team_id])
          .filter((x): x is string => !!x),
      ),
    );

    const [
      { count: playersTotal },
      { count: playersWithTeam },
      { count: teamsTotal },
      playersPlayingTodayRes,
      { data: contest },
    ] = await Promise.all([
      supabase
        .from("basketball_players")
        .select("id", { count: "exact", head: true })
        .eq("basketball_league_id", id),
      supabase
        .from("basketball_players")
        .select("id", { count: "exact", head: true })
        .eq("basketball_league_id", id)
        .not("team_id", "is", null),
      supabase
        .from("basketball_teams")
        .select("id", { count: "exact", head: true })
        .eq("basketball_league_id", id),
      teamsPlayingToday.length > 0
        ? supabase
            .from("basketball_players")
            .select("id", { count: "exact", head: true })
            .eq("basketball_league_id", id)
            .in("team_id", teamsPlayingToday)
        : Promise.resolve({ count: 0 }),
      supabase
        .from("basketball_contests")
        .select("id, status, lineup_lock_at")
        .eq("basketball_league_id", id)
        .eq("date", date)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      league_id: league.id,
      slug: league.slug,
      timezone: tz,
      date,
      league: {
        status: league.status,
        visibility: league.visibility,
        is_contest_enabled: league.is_contest_enabled,
      },
      games: {
        today: gamesToday?.length ?? 0,
        yesterday: gamesYesterdayCount,
        tomorrow: gamesTomorrowCount,
      },
      teams_playing_today: teamsPlayingToday,
      players: {
        total: playersTotal ?? 0,
        with_team: playersWithTeam ?? 0,
        playing_today: playersPlayingTodayRes.count ?? 0,
      },
      teams: {
        total: teamsTotal ?? 0,
      },
      contest: contest
        ? { id: contest.id, status: contest.status, lineup_lock_at: contest.lineup_lock_at }
        : null,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
