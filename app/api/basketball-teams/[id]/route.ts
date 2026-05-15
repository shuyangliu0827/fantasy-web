export const dynamic = "force-dynamic";
// app/api/basketball-teams/[id]/route.ts
//
// GET   — visibility-gated. Team detail with roster and upcoming/recent games.
// PATCH — league admin / platform admin. Edit team profile fields
//         (name, abbreviation, city, logo_url, bio).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
  requireViewPermission,
} from "@/lib/basketball/access";

const TEAM_EDITABLE_FIELDS = [
  "name",
  "abbreviation",
  "city",
  "logo_url",
  "bio",
] as const;
type TeamEditableField = (typeof TEAM_EDITABLE_FIELDS)[number];

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const { data: team, error: loadErr } = await supabase
      .from("basketball_teams")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!team) throw new AccessError("team_not_found", 404);

    const access = await requireViewPermission(
      supabase,
      team.basketball_league_id,
      userId,
    );

    const [{ data: roster }, { data: games }] = await Promise.all([
      supabase
        .from("basketball_players")
        .select("id, display_name, position, jersey_number, avatar_url, claim_status")
        .eq("team_id", id)
        .order("display_name"),
      supabase
        .from("basketball_games")
        .select("*")
        .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
        .order("scheduled_at", { ascending: false, nullsFirst: false }),
    ]);

    return NextResponse.json({
      team,
      roster: roster ?? [],
      games: games ?? [],
      access,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);

    const { data: team, error: loadErr } = await supabase
      .from("basketball_teams")
      .select("id, basketball_league_id")
      .eq("id", id)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!team) throw new AccessError("team_not_found", 404);

    await requireLeagueAdmin(supabase, team.basketball_league_id, userId);

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Partial<Record<TeamEditableField, unknown>> & {
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    for (const key of Object.keys(body)) {
      if (!(TEAM_EDITABLE_FIELDS as readonly string[]).includes(key)) {
        throw new AccessError(`field_not_editable:${key}`, 403);
      }
      patch[key as TeamEditableField] = body[key];
    }

    if ("name" in patch) {
      const name = patch.name;
      if (typeof name !== "string" || !name.trim()) {
        throw new AccessError("invalid_name", 400);
      }
      patch.name = name.trim();
    }

    const { data, error } = await supabase
      .from("basketball_teams")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ team: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
