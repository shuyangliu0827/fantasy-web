export const dynamic = "force-dynamic";
// GET /api/basketball-contests/by-date?leagueSlug=...&date=YYYY-MM-DD
// Resolves a specific date. Same auto-seed semantics as /today.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import { resolveContestForDate } from "@/lib/basketball/contest-resolver";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("leagueSlug");
  const date = url.searchParams.get("date");
  if (!slug || !date) {
    return NextResponse.json({ error: "missing_params" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "bad_date" }, { status: 400 });
  }
  const supabase = serviceDb();

  const { data: league } = await supabase
    .from("basketball_leagues")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!league) return NextResponse.json({ error: "league_not_found" }, { status: 404 });

  const res = await resolveContestForDate(supabase, league.id, date);
  switch (res.kind) {
    case "ok":
      return NextResponse.json({ contest: res.contest });
    case "no_games":
      return NextResponse.json({ error: "no_games_on_date", date: res.date }, { status: 404 });
    case "league_not_enabled":
      return NextResponse.json({ error: "league_not_enabled" }, { status: 404 });
    case "error":
      return NextResponse.json({ error: res.message }, { status: 500 });
  }
}
