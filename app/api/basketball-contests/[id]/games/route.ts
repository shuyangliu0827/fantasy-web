export const dynamic = "force-dynamic";
// GET /api/basketball-contests/[id]/games
//
// The scheduled games that power this contest's slate, with team names
// joined for display. Used by the league build page to render a compact
// "Team A vs Team B — 8:00 PM" summary.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import { dayBoundsUtc } from "@/lib/basketball/contest-date";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();

  const { data: contest, error: cErr } = await supabase
    .from("basketball_contests")
    .select("id, basketball_league_id, date")
    .eq("id", id)
    .maybeSingle<{ id: string; basketball_league_id: string; date: string }>();
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  const { data: league } = await supabase
    .from("basketball_leagues")
    .select("timezone")
    .eq("id", contest.basketball_league_id)
    .maybeSingle<{ timezone: string }>();
  const tz = league?.timezone || "UTC";
  const { startUtc, endUtc } = dayBoundsUtc(contest.date, tz);

  const { data: games, error: gamesErr } = await supabase
    .from("basketball_games")
    .select("id, scheduled_at, status, home_team_id, away_team_id, home_score, away_score")
    .eq("basketball_league_id", contest.basketball_league_id)
    .gte("scheduled_at", startUtc)
    .lte("scheduled_at", endUtc)
    .order("scheduled_at", { ascending: true });
  if (gamesErr) return NextResponse.json({ error: gamesErr.message }, { status: 500 });

  const teamIds = Array.from(
    new Set(
      (games ?? [])
        .flatMap((g) => [g.home_team_id, g.away_team_id])
        .filter((x): x is string => !!x),
    ),
  );
  const { data: teams } = teamIds.length > 0
    ? await supabase
        .from("basketball_teams")
        .select("id, name, abbreviation")
        .in("id", teamIds)
    : { data: [] as { id: string; name: string; abbreviation: string | null }[] };
  const teamById = new Map(
    (teams ?? []).map((t) => [t.id, t]),
  );

  const rows = (games ?? []).map((g) => ({
    id: g.id,
    scheduled_at: g.scheduled_at,
    status: g.status,
    home_team: g.home_team_id ? teamById.get(g.home_team_id) ?? null : null,
    away_team: g.away_team_id ? teamById.get(g.away_team_id) ?? null : null,
    home_score: g.home_score,
    away_score: g.away_score,
  }));

  return NextResponse.json({
    contest_id: contest.id,
    date: contest.date,
    timezone: tz,
    games: rows,
  });
}
