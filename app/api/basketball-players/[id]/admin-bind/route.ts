export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/admin-bind/route.ts
//
// POST — league admin / team manager initiates binding a Blueprint user to
// this player by UUID. Sets claimed_by_user_id = body.user_id and
// claim_status = 'approved'. There is no pending state — the caller is
// already authorized in the league, so we skip the user-initiated claim →
// admin approval handshake.
//
// Authorization:
//   • platform admin / league admin → may bind for any player in the league
//   • team_manager (approved, bound to the player's team) → may bind only
//     for players on their own team
//
// Invariants (server-enforced; the partial unique index from migration 036
// is the storage-level backstop):
//   • target user exists in public.users
//   • player not already pending/approved-bound to a different user
//   • target user has no other pending/approved binding in this league

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
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

    const body = (await req.json()) as { user_id?: string };
    const targetUserId = (body.user_id ?? "").trim();
    if (!targetUserId) throw new AccessError("missing_user_id", 400);

    const { data: player, error: pErr } = await supabase
      .from("basketball_players")
      .select("id, basketball_league_id, team_id, claimed_by_user_id, claim_status")
      .eq("id", id)
      .maybeSingle();
    if (pErr) throw new AccessError(pErr.message, 500);
    if (!player) throw new AccessError("player_not_found", 404);

    // Caller authorization
    const platform = await isPlatformAdmin(supabase, userId);
    const leagueAdmin = !platform
      ? await getBasketballLeagueAdminRole(supabase, player.basketball_league_id, userId)
      : null;
    let allowed = platform || leagueAdmin !== null;
    if (!allowed) {
      const caller = await getBasketballLeagueMemberRole(
        supabase,
        player.basketball_league_id,
        userId,
      );
      const adminLikeMember =
        caller.role === "league_admin" && caller.status === "approved";
      const managerOfTeam =
        caller.role === "team_manager" &&
        caller.status === "approved" &&
        caller.team_id != null &&
        caller.team_id === player.team_id;
      if (adminLikeMember) allowed = true;
      else if (managerOfTeam) allowed = true;
      else if (caller.role === "team_manager" && caller.status === "approved") {
        // Authenticated manager but scoped to a different team.
        throw new AccessError("not_your_team_player", 403);
      }
    }
    if (!allowed) throw new AccessError("forbidden", 403);

    // Target user must exist
    const { data: targetUser, error: uErr } = await supabase
      .from("users")
      .select("id")
      .eq("id", targetUserId)
      .maybeSingle();
    if (uErr) throw new AccessError(uErr.message, 500);
    if (!targetUser) throw new AccessError("user_not_found", 404);

    // Player must not already be bound to a different (pending/approved) user
    if (
      player.claim_status === "pending" ||
      player.claim_status === "approved"
    ) {
      if (player.claimed_by_user_id && player.claimed_by_user_id !== targetUserId) {
        throw new AccessError("player_already_claimed", 409);
      }
    }

    // Target user must not have another pending/approved binding in this league
    const { data: conflict } = await supabase
      .from("basketball_players")
      .select("id")
      .eq("basketball_league_id", player.basketball_league_id)
      .eq("claimed_by_user_id", targetUserId)
      .in("claim_status", ["pending", "approved"])
      .neq("id", id)
      .limit(1)
      .maybeSingle();
    if (conflict) {
      throw new AccessError("user_already_linked_in_league", 409);
    }

    const { data, error } = await supabase
      .from("basketball_players")
      .update({
        claimed_by_user_id: targetUserId,
        claim_status: "approved",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("id, claimed_by_user_id, claim_status")
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      const msg =
        error.code === "23505" ? "user_already_linked_in_league" : error.message;
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
