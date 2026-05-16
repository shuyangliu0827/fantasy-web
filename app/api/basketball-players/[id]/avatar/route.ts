export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/avatar/route.ts
//
// POST — accepts multipart/form-data with a "file" field. Server-side
// upload to the basketball-player-avatars bucket using the service-role
// Supabase client (which bypasses RLS), after validating the caller has
// permission to edit this player.
//
// Authorization (mirrors /profile PATCH self-service):
//   • the user who has an APPROVED claim on this player, OR
//   • a team_manager whose membership team_id equals the player's team_id, OR
//   • a league admin / platform admin.
//
// Returns { url: string } — the public URL of the uploaded object. The
// caller is responsible for PATCHing the player row's avatar_url with this
// URL (matching the existing client flow). On failure returns a JSON error
// with one of the codes the admin UI already maps to localized strings.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/avif",
]);

function extFromFile(file: File): string {
  const fromName = (file.name || "").split(".").pop()?.toLowerCase();
  if (fromName && fromName.length <= 5) return fromName;
  const fromType = (file.type || "").split("/")[1]?.toLowerCase();
  return fromType || "jpg";
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
    let isTeamManagerOfPlayer = false;
    if (!isOwner && !isAdmin) {
      const member = await getBasketballLeagueMemberRole(
        supabase,
        player.basketball_league_id,
        userId,
      );
      isTeamManagerOfPlayer =
        member.role === "team_manager" &&
        member.status === "approved" &&
        member.team_id != null &&
        member.team_id === player.team_id;
    }
    if (!isOwner && !isAdmin && !isTeamManagerOfPlayer) {
      throw new AccessError("forbidden", 403);
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new AccessError("invalid_multipart", 400);
    }
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AccessError("missing_file", 400);
    }
    if (file.size <= 0) {
      throw new AccessError("empty_file", 400);
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new AccessError("file_too_large", 413);
    }
    if (file.type && !ALLOWED_TYPES.has(file.type.toLowerCase())) {
      throw new AccessError("unsupported_file_type", 415);
    }

    const ext = extFromFile(file);
    const path = `${player.basketball_league_id}/${player.id}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("basketball-player-avatars")
      .upload(path, bytes, {
        upsert: true,
        contentType: file.type || "application/octet-stream",
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: "upload_failed", details: uploadErr.message },
        { status: 500 },
      );
    }
    const { data: pub } = supabase.storage
      .from("basketball-player-avatars")
      .getPublicUrl(path);

    return NextResponse.json({ url: pub.publicUrl });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
