export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/highlights/route.ts
//
// GET   — list highlights for a player. Visibility-gated by the league wall;
//         `members_only` highlights are hidden from non-members.
// POST  — create a new highlight. Allowed for league admin / team-manager-
//         of-this-player / bound-player (owner). `is_featured=true` is only
//         honored for league admins; when set, the previously featured
//         highlight for this player is automatically unset.
//
// All writes use the service-role client and go through the highlights
// permission helper (lib/basketball/highlights.ts).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireViewPermission,
} from "@/lib/basketball/access";
import {
  getHighlightPermissions,
  type HighlightMediaType,
  type HighlightVisibility,
  type PlayerHighlight,
} from "@/lib/basketball/highlights";

type PlayerRow = {
  id: string;
  basketball_league_id: string;
  team_id: string | null;
  claimed_by_user_id: string | null;
  claim_status: string;
};

async function loadPlayer(
  supabase: ReturnType<typeof serviceDb>,
  playerId: string,
): Promise<PlayerRow> {
  const { data, error } = await supabase
    .from("basketball_players")
    .select("id, basketball_league_id, team_id, claimed_by_user_id, claim_status")
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("player_not_found", 404);
  return data as PlayerRow;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const player = await loadPlayer(supabase, id);
    const access = await requireViewPermission(
      supabase,
      player.basketball_league_id,
      userId,
    );
    const perms = await getHighlightPermissions(supabase, player, userId);

    const { data, error } = await supabase
      .from("basketball_player_highlights")
      .select("*")
      .eq("player_id", id)
      .order("is_featured", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new AccessError(error.message, 500);

    const allRows = (data ?? []) as PlayerHighlight[];
    const isMember =
      access.canManageLeague ||
      access.memberStatus === "approved" ||
      access.isPlatformAdmin;
    const visible = isMember
      ? allRows
      : allRows.filter((h) => h.visibility === "public");

    return NextResponse.json({
      highlights: visible,
      permissions: perms,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

const MEDIA_TYPES: HighlightMediaType[] = ["image", "video_file", "video_link"];
const VISIBILITIES: HighlightVisibility[] = ["public", "members_only"];
const URL_RE = /^https?:\/\/[^\s]+$/i;

function sanitizeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
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
    const perms = await getHighlightPermissions(supabase, player, userId);
    if (!perms.canCreate) throw new AccessError("forbidden", 403);

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) throw new AccessError("invalid_body", 400);

    const title = sanitizeText(body.title, 160);
    if (!title) throw new AccessError("missing_title", 400);

    const mediaType = body.media_type;
    if (
      typeof mediaType !== "string" ||
      !MEDIA_TYPES.includes(mediaType as HighlightMediaType)
    ) {
      throw new AccessError("invalid_media_type", 400);
    }

    const mediaUrl = sanitizeText(body.media_url, 2000);
    const externalUrl = sanitizeText(body.external_url, 2000);
    const thumbnailUrl = sanitizeText(body.thumbnail_url, 2000);

    if (mediaType === "video_link") {
      if (!externalUrl) throw new AccessError("missing_external_url", 400);
      if (!URL_RE.test(externalUrl)) {
        throw new AccessError("invalid_video_url", 400);
      }
    } else {
      // image or video_file → uploaded asset; media_url must be set.
      if (!mediaUrl) throw new AccessError("missing_media_url", 400);
    }

    let visibility: HighlightVisibility = "public";
    if (typeof body.visibility === "string") {
      if (!VISIBILITIES.includes(body.visibility as HighlightVisibility)) {
        throw new AccessError("invalid_visibility", 400);
      }
      visibility = body.visibility as HighlightVisibility;
    }

    const requestedFeatured = body.is_featured === true;
    if (requestedFeatured && !perms.canFeature) {
      throw new AccessError("forbidden_feature", 403);
    }

    let highlightDate: string | null = null;
    if (typeof body.highlight_date === "string" && body.highlight_date) {
      const d = body.highlight_date.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        throw new AccessError("invalid_date", 400);
      }
      highlightDate = d;
    }

    const storagePath = sanitizeText(body.storage_path, 500);

    const row = {
      basketball_league_id: player.basketball_league_id,
      player_id: player.id,
      created_by: userId,
      media_type: mediaType,
      media_url: mediaType === "video_link" ? null : mediaUrl,
      external_url: mediaType === "video_link" ? externalUrl : null,
      thumbnail_url: thumbnailUrl,
      storage_path: storagePath,
      title,
      description: sanitizeText(body.description, 2000),
      game_opponent: sanitizeText(body.game_opponent, 160),
      highlight_date: highlightDate,
      tag: sanitizeText(body.tag, 60),
      is_featured: requestedFeatured,
      visibility,
    };

    if (requestedFeatured) {
      const { error: unsetErr } = await supabase
        .from("basketball_player_highlights")
        .update({ is_featured: false, updated_at: new Date().toISOString() })
        .eq("player_id", id)
        .eq("is_featured", true);
      if (unsetErr) throw new AccessError(unsetErr.message, 500);
    }

    const { data, error } = await supabase
      .from("basketball_player_highlights")
      .insert(row)
      .select()
      .single();
    if (error) throw new AccessError(error.message, 500);

    return NextResponse.json({ highlight: data }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
