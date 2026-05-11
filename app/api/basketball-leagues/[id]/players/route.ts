export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/players/route.ts
//
// GET  — visibility-gated list of custom basketball players in the league.
// POST — league admin / platform admin creates a player (UUID, NOT a BDL id).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
  requireViewPermission,
} from "@/lib/basketball/access";

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
      .from("basketball_players")
      .select("*")
      .eq("basketball_league_id", id)
      .order("display_name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ players: data ?? [] });
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
    await requireLeagueAdmin(supabase, id, userId);

    const body = (await req.json()) as {
      display_name?: string;
      team_id?: string | null;
      position?: string;
      jersey_number?: string;
      height?: string;
      weight?: string;
      bio?: string;
      avatar_url?: string;
      external_provider?: string;
      external_player_id?: string;
    };
    if (!body.display_name?.trim()) throw new AccessError("missing_display_name", 400);

    const { data, error } = await supabase
      .from("basketball_players")
      .insert({
        basketball_league_id: id,
        team_id: body.team_id ?? null,
        display_name: body.display_name.trim(),
        position: body.position ?? null,
        jersey_number: body.jersey_number ?? null,
        height: body.height ?? null,
        weight: body.weight ?? null,
        bio: body.bio ?? null,
        avatar_url: body.avatar_url ?? null,
        external_provider: body.external_provider ?? null,
        external_player_id: body.external_player_id ?? null,
      })
      .select()
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ player: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
