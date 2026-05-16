export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/players/self/route.ts
//
// POST — invited player self-creates their own player profile in the
// league and is auto-bound to it (claimed_by_user_id = self,
// claim_status = 'approved'). One profile per (league, user). The
// existing partial unique index `uniq_bball_players_league_user_active`
// from migration 036 is the storage-level backstop.
//
// Authorization:
//   • caller must be an approved basketball_league_members row
//     with role = 'player' for this league, AND
//   • caller must not already hold a pending/approved claim on any
//     player in this league.
//
// (Team managers bind themselves to a team via /team-bind; they do not
//  use this endpoint. Platform/league admins use POST
//  /api/basketball-leagues/{id}/players to create rosters on behalf of
//  others.)

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";
import { isCanonicalPosition } from "@/lib/basketball/contest-positions";

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
    if (member.status !== "approved" || !member.role) {
      throw new AccessError("not_a_league_member", 403);
    }
    if (member.role !== "player") {
      throw new AccessError("forbidden", 403);
    }

    const { data: existing } = await supabase
      .from("basketball_players")
      .select("id")
      .eq("basketball_league_id", id)
      .eq("claimed_by_user_id", userId)
      .in("claim_status", ["pending", "approved"])
      .limit(1)
      .maybeSingle();
    if (existing) {
      throw new AccessError("already_linked_in_league", 409);
    }

    const body = (await req.json()) as {
      display_name?: string;
      team_id?: string | null;
      position?: string;
      jersey_number?: string;
      height_cm?: number | null;
      weight_kg?: number | null;
      birth_year?: number | null;
      bio?: string;
    };
    const displayName = body.display_name?.trim();
    if (!displayName) throw new AccessError("missing_display_name", 400);

    const teamId = (body.team_id ?? "").trim();
    if (!teamId) throw new AccessError("missing_team_id", 400);

    const positionRaw = (body.position ?? "").trim();
    if (!positionRaw) throw new AccessError("missing_position", 400);
    if (!isCanonicalPosition(positionRaw)) {
      throw new AccessError("invalid_position", 400);
    }

    const { data: team, error: teamErr } = await supabase
      .from("basketball_teams")
      .select("id, basketball_league_id")
      .eq("id", teamId)
      .maybeSingle();
    if (teamErr) throw new AccessError(teamErr.message, 500);
    if (!team) throw new AccessError("invalid_team_id", 400);
    if (team.basketball_league_id !== id) {
      throw new AccessError("team_not_in_league", 400);
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .insert({
        basketball_league_id: id,
        team_id: teamId,
        display_name: displayName,
        position: positionRaw,
        jersey_number: body.jersey_number ?? null,
        height_cm: body.height_cm ?? null,
        weight_kg: body.weight_kg ?? null,
        birth_year: body.birth_year ?? null,
        bio: body.bio ?? null,
        is_active: true,
        claimed_by_user_id: userId,
        claim_status: "approved",
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "already_linked_in_league" },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ player: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
