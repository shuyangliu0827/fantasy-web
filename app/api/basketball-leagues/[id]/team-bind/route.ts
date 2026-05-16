export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/team-bind/route.ts
//
// POST   — approved team_manager binds themselves to a team in this league.
//          One team_manager per (league, team). If the caller already has a
//          team_id, returns 409.
// DELETE — self-unbind. Clears the caller's team_id so they can re-bind.
//
// After binding, the team_manager is allowed to:
//   • PATCH their team (basketball_teams) — name/abbreviation/city/logo/bio
//   • POST/PATCH/DELETE their team's players — add/edit/remove
//   • upload the team logo
//   …all enforced at the per-resource API layer.

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
    if (member.status !== "approved" || member.role !== "team_manager") {
      throw new AccessError("forbidden", 403);
    }
    if (member.team_id) {
      throw new AccessError("already_bound_to_team", 409);
    }

    const body = (await req.json()) as { team_id?: string };
    const teamId = (body.team_id ?? "").trim();
    if (!teamId) throw new AccessError("missing_team_id", 400);

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

    // Team must not already have an approved team_manager.
    const { data: existing } = await supabase
      .from("basketball_league_members")
      .select("user_id")
      .eq("basketball_league_id", id)
      .eq("team_id", teamId)
      .eq("role", "team_manager")
      .eq("status", "approved")
      .neq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (existing) {
      throw new AccessError("team_already_managed", 409);
    }

    const { data, error } = await supabase
      .from("basketball_league_members")
      .update({
        team_id: teamId,
        updated_at: new Date().toISOString(),
      })
      .eq("basketball_league_id", id)
      .eq("user_id", userId)
      .select("user_id, role, status, team_id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const member = await getBasketballLeagueMemberRole(supabase, id, userId);
    if (member.status !== "approved" || member.role !== "team_manager") {
      throw new AccessError("forbidden", 403);
    }

    const { data, error } = await supabase
      .from("basketball_league_members")
      .update({
        team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("basketball_league_id", id)
      .eq("user_id", userId)
      .select("user_id, role, status, team_id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
