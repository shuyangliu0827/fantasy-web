export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/profile/route.ts
//
// PATCH — update a basketball_player's profile.
//
// Allowed editors:
//   • the user who has an APPROVED claim on this player, OR
//   • a league admin / platform admin
//
// Editable fields (whitelist — anything else is rejected as 400):
//   display_name, position, jersey_number, height, weight, height_cm,
//   weight_kg, birth_year, bio, avatar_url
//
// Players cannot edit team_id, is_active, stats, fantasy_points, or
// game records. Phase-1: stats remain off-limits to players regardless
// of whether they are claimed.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
  getBasketballLeagueAdminRole,
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
      .select("id, basketball_league_id, claimed_by_user_id, claim_status")
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
    if (!isOwner && !isAdmin) throw new AccessError("forbidden", 403);

    const body = (await req.json()) as Record<string, unknown>;
    const patch: Partial<Record<SafeField, unknown>> & {
      updated_at: string;
    } = { updated_at: new Date().toISOString() };

    for (const key of Object.keys(body)) {
      if (!(SAFE_FIELDS as readonly string[]).includes(key)) {
        throw new AccessError(`field_not_editable:${key}`, 403);
      }
      patch[key as SafeField] = body[key];
    }

    // Position, if changed, must be one of the canonical fantasy values.
    // Null/empty is permitted only for non-DFS-eligible legacy rows; new
    // values must be canonical so the lineup builder can apply slot rules.
    if ("position" in patch && patch.position != null && patch.position !== "") {
      if (typeof patch.position !== "string" || !isCanonicalPosition(patch.position)) {
        throw new AccessError("invalid_position", 400);
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
