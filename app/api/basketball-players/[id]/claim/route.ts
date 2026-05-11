export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/claim/route.ts
//
// POST  — any authenticated user submits a claim on a basketball_player.
//         Sets claimed_by_user_id and claim_status='pending'.
// PATCH — league admin / platform admin approves or rejects the claim.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
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

    if (
      player.claim_status === "approved" &&
      player.claimed_by_user_id &&
      player.claimed_by_user_id !== userId
    ) {
      throw new AccessError("player_already_claimed", 409);
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
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
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
