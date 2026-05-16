export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/claim/route.ts
//
// POST   — any authenticated league member submits a claim on a basketball_player.
//          Sets claimed_by_user_id and claim_status='pending'.
//          Rejected with 409 if the caller already has another pending/approved
//          claim in the same league, or if the target player is already
//          approved for someone else.
// PATCH  — league admin / platform admin approves or rejects the claim.
// DELETE — league admin / platform admin unbinds a player. Resets the row to
//          claim_status='unclaimed' and clears claimed_by_user_id. Used to
//          release an approved binding before re-binding or deletion.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

async function loadPlayer(supabase: ReturnType<typeof serviceDb>, playerId: string) {
  const { data, error } = await supabase
    .from("basketball_players")
    .select("id, basketball_league_id, claimed_by_user_id, claim_status")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("player_not_found", 404);
  return data;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const player = await loadPlayer(supabase, id);

    // Caller must be either a platform/league admin or an approved member of
    // this league. Prevents non-league users from squatting on profiles.
    const isAdmin =
      (await isPlatformAdmin(supabase, userId)) ||
      (await getBasketballLeagueAdminRole(
        supabase,
        player.basketball_league_id,
        userId,
      )) !== null;
    if (!isAdmin) {
      const member = await getBasketballLeagueMemberRole(
        supabase,
        player.basketball_league_id,
        userId,
      );
      if (member.status !== "approved") {
        throw new AccessError("not_a_league_member", 403);
      }
    }

    if (
      player.claim_status === "approved" &&
      player.claimed_by_user_id &&
      player.claimed_by_user_id !== userId
    ) {
      throw new AccessError("player_already_claimed", 409);
    }

    // Disallow a second pending/approved row for the same (league, user).
    // The partial unique index in migration 036 is the backstop; this
    // gives a cleaner error than 23505 for the common case.
    const { data: existing } = await supabase
      .from("basketball_players")
      .select("id")
      .eq("basketball_league_id", player.basketball_league_id)
      .eq("claimed_by_user_id", userId)
      .in("claim_status", ["pending", "approved"])
      .neq("id", id)
      .limit(1)
      .maybeSingle();
    if (existing) {
      throw new AccessError("already_linked_in_league", 409);
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .update({
        claimed_by_user_id: userId,
        claim_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, claimed_by_user_id, claim_status")
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      const msg = error.code === "23505" ? "already_linked_in_league" : error.message;
      return NextResponse.json({ error: msg }, { status });
    }
    return NextResponse.json({ player: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
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
    const player = await loadPlayer(supabase, id);
    await requireLeagueAdmin(supabase, player.basketball_league_id, userId);

    const body = (await req.json()) as { claim_status?: string };
    if (body.claim_status !== "approved" && body.claim_status !== "rejected") {
      throw new AccessError("invalid_claim_status", 400);
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .update({
        claim_status: body.claim_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, claimed_by_user_id, claim_status")
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const player = await loadPlayer(supabase, id);

    // Self-unbind: the bound user can disconnect themselves at any time.
    // Otherwise the caller must be a league/platform admin (existing path).
    const isSelf = player.claimed_by_user_id === userId;
    if (!isSelf) {
      await requireLeagueAdmin(supabase, player.basketball_league_id, userId);
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .update({
        claim_status: "unclaimed",
        claimed_by_user_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, claimed_by_user_id, claim_status")
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
