export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/highlights/image/route.ts
//
// POST — accepts multipart/form-data { file } and uploads the image to the
// basketball-player-highlights bucket via the service-role client.
// Returns { url, storage_path } so the client can include them in the
// follow-up POST /highlights call.
//
// Permission mirrors POST /highlights: league admin / team-manager-of-this-
// player / bound owner.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";
import { getHighlightPermissions } from "@/lib/basketball/highlights";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
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
      .select(
        "id, basketball_league_id, team_id, claimed_by_user_id, claim_status",
      )
      .eq("id", id)
      .maybeSingle();
    if (pErr) throw new AccessError(pErr.message, 500);
    if (!player) throw new AccessError("player_not_found", 404);

    const perms = await getHighlightPermissions(supabase, player, userId);
    if (!perms.canCreate) throw new AccessError("forbidden", 403);

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      throw new AccessError("invalid_multipart", 400);
    }
    const file = formData.get("file");
    if (!(file instanceof File)) throw new AccessError("missing_file", 400);
    if (file.size <= 0) throw new AccessError("empty_file", 400);
    if (file.size > MAX_FILE_BYTES) throw new AccessError("file_too_large", 413);
    if (file.type && !ALLOWED_TYPES.has(file.type.toLowerCase())) {
      throw new AccessError("unsupported_file_type", 415);
    }

    const ext = extFromFile(file);
    const path = `${player.basketball_league_id}/${player.id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("basketball-player-highlights")
      .upload(path, bytes, {
        upsert: false,
        contentType: file.type || "application/octet-stream",
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: "upload_failed", details: uploadErr.message },
        { status: 500 },
      );
    }
    const { data: pub } = supabase.storage
      .from("basketball-player-highlights")
      .getPublicUrl(path);

    return NextResponse.json({ url: pub.publicUrl, storage_path: path });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
