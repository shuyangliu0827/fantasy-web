export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/teams/route.ts
//
// GET  — visibility-gated list of teams.
// POST — league admin / platform admin creates a team.

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
      .from("basketball_teams")
      .select("*")
      .eq("basketball_league_id", id)
      .order("name");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ teams: data ?? [] });
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
      name?: string;
      abbreviation?: string;
      city?: string;
      logo_url?: string;
    };
    if (!body.name?.trim()) throw new AccessError("missing_name", 400);

    const { data, error } = await supabase
      .from("basketball_teams")
      .insert({
        basketball_league_id: id,
        name: body.name.trim(),
        abbreviation: body.abbreviation ?? null,
        city: body.city ?? null,
        logo_url: body.logo_url ?? null,
      })
      .select()
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ team: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
