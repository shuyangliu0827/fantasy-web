export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/profile/route.ts
//
// PATCH — update a basketball_player's profile.
//
// Allowed editors:
//   • the user who has an APPROVED claim on this player (self-service), OR
//   • a team_manager whose membership team_id equals the player's team_id, OR
//   • a league admin / platform admin.
//
// Self-service fields (any allowed editor):
//   display_name, position, jersey_number, height, weight, height_cm,
//   weight_kg, birth_year, bio, avatar_url
//
// Admin-only fields (platform/league admin only):
//   team_id (must belong to the same league), is_active
//
// Team managers may PATCH self-service fields on their own team's players
// but cannot move a player to another team or deactivate them.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";
import { isCanonicalPosition } from "@/lib/basketball/contest-positions";

const SAFE_FIELDS = [
  "display_name",
  "position",
  "jersey_number",
  "height",
  "weight",
  "height_cm",
  "weight_kg",
  "birth_year",
  "bio",
  "avatar_url",
] as const;
type SafeField = (typeof SAFE_FIELDS)[number];

const ADMIN_FIELDS = ["team_id", "is_active"] as const;
type AdminField = (typeof ADMIN_FIELDS)[number];

type AnyField = SafeField | AdminField;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const { data: player, error: pErr } = await supabase
      .from("basketball_players")
      .select("id, basketball_league_id, team_id, claimed_by_user_id, claim_status")
      .eq("id", id)
      .maybeSingle();
    if (pErr) throw new AccessError(pErr.message, 500);
    if (!player) throw new AccessError("player_not_found", 404);

    const isOwner =
      player.claimed_by_user_id === userId && player.claim_status === "approved";
    const isAdmin =
      (await isPlatformAdmin(supabase, userId)) ||
      (await getBasketballLeagueAdminRole(
        supabase,
        player.basketball_league_id,
        userId,
      )) !== null;
    const member = isAdmin
      ? null
      : await getBasketballLeagueMemberRole(
          supabase,
          player.basketball_league_id,
          userId,
        );
    const isTeamManagerOfPlayer =
      !!member &&
      member.role === "team_manager" &&
      member.status === "approved" &&
      member.team_id != null &&
      member.team_id === player.team_id;

    if (!isOwner && !isAdmin && !isTeamManagerOfPlayer) {
      throw new AccessError("forbidden", 403);
    }

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Partial<Record<AnyField, unknown>> & {
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    for (const key of Object.keys(body)) {
      const isSafe = (SAFE_FIELDS as readonly string[]).includes(key);
      const isAdminField = (ADMIN_FIELDS as readonly string[]).includes(key);
      if (!isSafe && !isAdminField) {
        throw new AccessError(`field_not_editable:${key}`, 403);
      }
      if (isAdminField && !isAdmin) {
        // Owner & team manager cannot move teams or toggle is_active.
        throw new AccessError(`field_not_editable:${key}`, 403);
      }
      patch[key as AnyField] = body[key];
    }

    if ("position" in patch && patch.position != null && patch.position !== "") {
      if (typeof patch.position !== "string" || !isCanonicalPosition(patch.position)) {
        throw new AccessError("invalid_position", 400);
      }
    }

    if ("team_id" in patch) {
      const newTeamId = patch.team_id;
      if (newTeamId == null || newTeamId === "") {
        throw new AccessError("invalid_team_id", 400);
      }
      if (typeof newTeamId !== "string") {
        throw new AccessError("invalid_team_id", 400);
      }
      const { data: team, error: teamErr } = await supabase
        .from("basketball_teams")
        .select("id, basketball_league_id")
        .eq("id", newTeamId)
        .maybeSingle();
      if (teamErr) throw new AccessError(teamErr.message, 500);
      if (!team) throw new AccessError("invalid_team_id", 400);
      if (team.basketball_league_id !== player.basketball_league_id) {
        throw new AccessError("team_not_in_league", 400);
      }
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ player: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
