export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/media/video/route.ts
//
// POST — league admin / platform admin uploads a video file as a highlight.
//
// Body: multipart/form-data with fields:
//   file       — the video file (required)
//   title      — optional caption
//   visibility — "public" | "members_only" (default "public")
//
// Flow:
//   1. Authorize caller via requireLeagueAdmin (same gate as the legacy
//      link-based POST /media route).
//   2. Validate the file (extension, MIME, size).
//   3. Upload to the basketball-game-videos bucket under
//      `{leagueId}/{gameId}/{uuid}.{ext}`.
//   4. Insert a basketball_game_media row with source_type='upload',
//      media_type='video', and the public URL.
//
// Legacy external-link highlights continue to flow through the existing
// POST /api/basketball-games/[id]/media JSON endpoint, which has been left
// in place for backwards compatibility but is no longer surfaced in the
// product UI.

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

const MAX_FILE_BYTES = 200 * 1024 * 1024; // 200MB MVP cap
const ALLOWED_TYPES = new Set([
  "video/mp4",
  "video/quicktime", // .mov
  "video/webm",
  "video/x-m4v",
]);
const ALLOWED_EXT = new Set(["mp4", "mov", "webm", "m4v"]);
const VISIBILITY = new Set(["public", "members_only"]);

function extFromFile(file: File): string {
  const fromName = (file.name || "").split(".").pop()?.toLowerCase();
  if (fromName && ALLOWED_EXT.has(fromName)) return fromName;
  const fromType = (file.type || "").split("/")[1]?.toLowerCase();
  if (fromType === "quicktime") return "mov";
  if (fromType && ALLOWED_EXT.has(fromType)) return fromType;
  return "mp4";
}

async function loadGame(supabase: ReturnType<typeof serviceDb>, gameId: string) {
  const { data, error } = await supabase
    .from("basketball_games")
    .select("id, basketball_league_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("game_not_found", 404);
  return data;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: gameId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    const game = await loadGame(supabase, gameId);
    await requireLeagueAdmin(supabase, game.basketball_league_id, userId);

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

    const title = ((formData.get("title") as string | null) ?? "").trim() || null;
    const visibilityRaw =
      ((formData.get("visibility") as string | null) ?? "public").trim() || "public";
    if (!VISIBILITY.has(visibilityRaw)) {
      throw new AccessError("invalid_visibility", 400);
    }

    const ext = extFromFile(file);
    const path = `${game.basketball_league_id}/${game.id}/${randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("basketball-game-videos")
      .upload(path, bytes, {
        upsert: false,
        contentType: file.type || "video/mp4",
      });
    if (uploadErr) {
      return NextResponse.json(
        { error: "upload_failed", details: uploadErr.message },
        { status: 500 },
      );
    }

    const { data: pub } = supabase.storage
      .from("basketball-game-videos")
      .getPublicUrl(path);

    const { data, error } = await supabase
      .from("basketball_game_media")
      .insert({
        basketball_league_id: game.basketball_league_id,
        game_id: gameId,
        uploaded_by: userId,
        media_type: "video",
        source_type: "upload",
        title,
        url: pub.publicUrl,
        storage_path: path,
        mime_type: file.type || "video/mp4",
        file_size_bytes: file.size,
        visibility: visibilityRaw,
      })
      .select()
      .single();
    if (error) {
      // Best-effort cleanup of the uploaded blob so we don't leave an
      // orphan file behind. If the cleanup fails we still surface the
      // original DB error.
      await supabase.storage
        .from("basketball-game-videos")
        .remove([path])
        .catch(() => undefined);
      return NextResponse.json(
        { error: error.message, code: error.code, hint: error.hint },
        { status: 500 },
      );
    }
    return NextResponse.json({ media: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
