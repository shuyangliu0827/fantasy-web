export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/games/route.ts
//
// GET  — visibility-gated list of games (newest scheduled_at first).
// POST — league admin / platform admin / approved stat keeper creates a game.

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

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
    const status = body.status ?? "scheduled";
    if (!GAME_STATUS.has(status)) throw new AccessError("invalid_status", 400);

    const { data, error } = await supabase
      .from("basketball_games")
      .insert({
        basketball_league_id: id,
        home_team_id: body.home_team_id ?? null,
        away_team_id: body.away_team_id ?? null,
        scheduled_at: body.scheduled_at ?? null,
        status,
        home_score: body.home_score ?? null,
        away_score: body.away_score ?? null,
      })
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ game: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
