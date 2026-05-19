export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/teams/self/route.ts
//
// POST — approved team_manager creates a brand-new team in this league and
// is atomically bound as its manager. One team per manager: if the caller
// already has a team_id, returns 409.
//
// Mirrors app/api/basketball-leagues/[id]/players/self/route.ts in spirit:
// a self-service write that the manager performs without league-admin
// approval. League-admin and platform-admin team creation continues to use
// POST /api/basketball-leagues/[id]/teams.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const member = await getBasketballLeagueMemberRole(supabase, id, userId);
    if (!member.role || member.status !== "approved") {
      throw new AccessError("not_a_league_member", 403);
    }
    if (member.role !== "team_manager") {
      throw new AccessError("forbidden", 403);
    }
    if (member.team_id) {
      throw new AccessError("already_bound_to_team", 409);
    }

    const body = (await req.json()) as {
      name?: string;
      abbreviation?: string;
      city?: string;
      bio?: string;
      logo_url?: string;
    };
    const name = body.name?.trim();
    if (!name) throw new AccessError("missing_name", 400);

    const { data: team, error: teamErr } = await supabase
      .from("basketball_teams")
      .insert({
        basketball_league_id: id,
        name,
        abbreviation: body.abbreviation?.trim() || null,
        city: body.city?.trim() || null,
        bio: body.bio?.trim() || null,
        logo_url: body.logo_url ?? null,
      })
      .select("id, name, abbreviation, city, logo_url, bio")
      .single();
    if (teamErr) {
      const status = teamErr.code === "23505" ? 409 : 500;
      const msg = teamErr.code === "23505" ? "duplicate_team_name" : teamErr.message;
      return NextResponse.json({ error: msg }, { status });
    }

    const { error: bindErr } = await supabase
      .from("basketball_league_members")
      .update({ team_id: team.id, updated_at: new Date().toISOString() })
      .eq("basketball_league_id", id)
      .eq("user_id", userId);
    if (bindErr) {
      // Roll back the team we just created so the manager isn't blocked
      // from retrying — we don't want an orphan team owning no manager.
      await supabase.from("basketball_teams").delete().eq("id", team.id);
      return NextResponse.json({ error: bindErr.message }, { status: 500 });
    }

    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
