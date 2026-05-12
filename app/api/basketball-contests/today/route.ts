export const dynamic = "force-dynamic";
// GET /api/basketball-contests/today?leagueSlug=...
//
// Returns today's contest for the league (UTC). Auto-seeds the contest +
// player pool on first access when at least one game is scheduled today.
//
// Public — anyone can read. Lineup mutation routes do their own auth.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import { resolveTodayContest } from "@/lib/basketball/contest-resolver";

export async function GET(req: Request) {
  const slug = new URL(req.url).searchParams.get("leagueSlug");
  if (!slug) {
    return NextResponse.json({ error: "missing_league_slug" }, { status: 400 });
  }
  const supabase = serviceDb();

  const { data: league, error: leagueErr } = await supabase
    .from("basketball_leagues")
    .select("id, slug")
    .eq("slug", slug)
    .maybeSingle();
  if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });
  if (!league) return NextResponse.json({ error: "league_not_found" }, { status: 404 });

  const res = await resolveTodayContest(supabase, league.id);
  switch (res.kind) {
    case "ok":
      return NextResponse.json({ contest: res.contest });
    case "no_games":
      return NextResponse.json({ error: "no_contest_today", date: res.date }, { status: 404 });
    case "league_not_enabled":
      return NextResponse.json({ error: "league_not_enabled" }, { status: 404 });
    case "error":
      return NextResponse.json({ error: res.message }, { status: 500 });
  }
}
