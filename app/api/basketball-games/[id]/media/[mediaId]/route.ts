export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/media/[mediaId]/route.ts
//
// DELETE — league admin / platform admin only.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; mediaId: string }> },
) {
  const { id, mediaId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);

    const { data: media, error: loadErr } = await supabase
      .from("basketball_game_media")
      .select("id, basketball_league_id, game_id")
      .eq("id", mediaId)
      .maybeSingle();
    if (loadErr) throw new AccessError(loadErr.message, 500);
    if (!media) throw new AccessError("media_not_found", 404);
    if (media.game_id !== id) throw new AccessError("media_wrong_game", 400);

    await requireLeagueAdmin(supabase, media.basketball_league_id, userId);

    const { error: delErr } = await supabase
      .from("basketball_game_media")
      .delete()
      .eq("id", mediaId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
