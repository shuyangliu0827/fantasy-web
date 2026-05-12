export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/media/route.ts
//
// GET  — visibility-gated. Returns media for the game. members_only items
//        are hidden from non-members of invite_only / private leagues.
// POST — league admin / platform admin only. Body: { url, title?, media_type?, visibility? }.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  getBasketballLeagueAccess,
  requireLeagueAdmin,
  requireViewPermission,
} from "@/lib/basketball/access";

const MEDIA_TYPES = new Set(["link", "video", "image"]);
const MEDIA_VISIBILITY = new Set(["public", "members_only"]);

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const game = await loadGame(supabase, id);
    const access = await requireViewPermission(supabase, game.basketball_league_id, userId);

    const { data, error } = await supabase
      .from("basketball_game_media")
      .select("*")
      .eq("game_id", id)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const memberOrAdmin =
      access.isPlatformAdmin ||
      access.leagueAdminRole !== null ||
      access.memberStatus === "approved";
    const filtered = (data ?? []).filter(
      (m) => m.visibility === "public" || memberOrAdmin,
    );
    return NextResponse.json({ media: filtered });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    const game = await loadGame(supabase, id);
    await requireLeagueAdmin(supabase, game.basketball_league_id, userId);

    const body = (await req.json()) as {
      url?: string;
      title?: string;
      media_type?: string;
      visibility?: string;
    };
    if (!body.url?.trim()) throw new AccessError("missing_url", 400);
    const mediaType = body.media_type ?? "link";
    if (!MEDIA_TYPES.has(mediaType)) throw new AccessError("invalid_media_type", 400);
    const visibility = body.visibility ?? "public";
    if (!MEDIA_VISIBILITY.has(visibility)) throw new AccessError("invalid_visibility", 400);

    const { data, error } = await supabase
      .from("basketball_game_media")
      .insert({
        basketball_league_id: game.basketball_league_id,
        game_id: id,
        uploaded_by: userId,
        url: body.url.trim(),
        title: body.title?.trim() || null,
        media_type: mediaType,
        visibility,
      })
      .select()
      .single();
    if (error) {
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
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
