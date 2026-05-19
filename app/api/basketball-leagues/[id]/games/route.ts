export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/games/route.ts
//
// GET  — visibility-gated list of games (newest scheduled_at first).
// POST — league admin / platform admin / approved stat keeper creates a game.
//        Strict validation: home, away, and scheduled_at are required;
//        home != away; both teams must belong to this league.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
  requireViewPermission,
} from "@/lib/basketball/access";

const GAME_STATUS = new Set(["scheduled", "live", "final", "cancelled"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    await requireViewPermission(supabase, id, userId);
    const { data, error } = await supabase
      .from("basketball_games")
      .select("*")
      .eq("basketball_league_id", id)
      .order("scheduled_at", { ascending: false, nullsFirst: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ games: data ?? [] });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

type InvalidReason =
  | "missing_home_team"
  | "missing_away_team"
  | "missing_scheduled_at"
  | "same_team"
  | "invalid_scheduled_at"
  | "team_not_in_league"
  | "invalid_status";

function invalid(reason: InvalidReason) {
  return NextResponse.json({ error: "invalid_game", reason }, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reqStart = Date.now();
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    // Stats permission covers admins + stat keepers per spec.
    await requireStatsPermission(supabase, id, userId);

    const body = (await req.json()) as {
      home_team_id?: string | null;
      away_team_id?: string | null;
      scheduled_at?: string | null;
      status?: string;
      home_score?: number | null;
      away_score?: number | null;
    };

    const home = (body.home_team_id ?? "").trim();
    const away = (body.away_team_id ?? "").trim();
    const sched = (body.scheduled_at ?? "").trim();
    if (!home) return invalid("missing_home_team");
    if (!away) return invalid("missing_away_team");
    if (!sched) return invalid("missing_scheduled_at");
    if (home === away) return invalid("same_team");

    const schedDate = new Date(sched);
    if (Number.isNaN(schedDate.getTime())) return invalid("invalid_scheduled_at");

    const status = body.status ?? "scheduled";
    if (!GAME_STATUS.has(status)) return invalid("invalid_status");

    // Both teams must belong to this league.
    const { data: teams, error: teamsErr } = await supabase
      .from("basketball_teams")
      .select("id")
      .eq("basketball_league_id", id)
      .in("id", [home, away]);
    if (teamsErr) return NextResponse.json({ error: teamsErr.message }, { status: 500 });
    if (!teams || teams.length !== 2) return invalid("team_not_in_league");

    const insertStart = Date.now();
    const { data, error } = await supabase
      .from("basketball_games")
      .insert({
        basketball_league_id: id,
        home_team_id: home,
        away_team_id: away,
        scheduled_at: schedDate.toISOString(),
        status,
        home_score: body.home_score ?? null,
        away_score: body.away_score ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    console.info("[perf][api] POST /api/basketball-leagues/[id]/games", {
      leagueId: id,
      insertMs: Date.now() - insertStart,
      totalMs: Date.now() - reqStart,
    });
    return NextResponse.json({ game: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
