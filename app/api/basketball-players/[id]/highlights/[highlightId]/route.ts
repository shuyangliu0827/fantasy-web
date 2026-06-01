export const dynamic = "force-dynamic";
// app/api/basketball-players/[id]/highlights/[highlightId]/route.ts
//
// PATCH  — update a highlight. Permission: league admin / team-manager-of-
//          this-player / bound owner. Toggling `is_featured` requires
//          league admin.
// DELETE — remove a highlight. Permission: same as PATCH. Also deletes the
//          underlying storage object when `storage_path` is set (best-
//          effort; storage failure does not block the row delete).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";
import {
  canMutateHighlight,
  getHighlightPermissions,
  type HighlightMediaType,
  type HighlightVisibility,
} from "@/lib/basketball/highlights";

type PlayerRow = {
  id: string;
  basketball_league_id: string;
  team_id: string | null;
  claimed_by_user_id: string | null;
  claim_status: string;
};

const MEDIA_TYPES: HighlightMediaType[] = ["image", "video_link"];
const VISIBILITIES: HighlightVisibility[] = ["public", "members_only"];
const VIDEO_URL_RE = /^https?:\/\/[^\s]+$/i;

function sanitizeText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

async function loadContext(
  supabase: ReturnType<typeof serviceDb>,
  playerId: string,
  highlightId: string,
) {
  const [{ data: player, error: pErr }, { data: highlight, error: hErr }] =
    await Promise.all([
      supabase
        .from("basketball_players")
        .select(
          "id, basketball_league_id, team_id, claimed_by_user_id, claim_status",
        )
        .eq("id", playerId)
        .maybeSingle(),
      supabase
        .from("basketball_player_highlights")
        .select("*")
        .eq("id", highlightId)
        .maybeSingle(),
    ]);
  if (pErr) throw new AccessError(pErr.message, 500);
  if (!player) throw new AccessError("player_not_found", 404);
  if (hErr) throw new AccessError(hErr.message, 500);
  if (!highlight) throw new AccessError("highlight_not_found", 404);
  if (highlight.player_id !== playerId) {
    throw new AccessError("highlight_not_found", 404);
  }
  return { player: player as PlayerRow, highlight };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  const { id, highlightId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const { player, highlight } = await loadContext(
      supabase,
      id,
      highlightId,
    );
    const perms = await getHighlightPermissions(supabase, player, userId);
    if (!canMutateHighlight(perms)) throw new AccessError("forbidden", 403);

    const body = (await req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) throw new AccessError("invalid_body", 400);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("title" in body) {
      const title = sanitizeText(body.title, 160);
      if (!title) throw new AccessError("missing_title", 400);
      patch.title = title;
    }
    if ("description" in body) {
      patch.description = sanitizeText(body.description, 2000);
    }
    if ("game_opponent" in body) {
      patch.game_opponent = sanitizeText(body.game_opponent, 160);
    }
    if ("tag" in body) {
      patch.tag = sanitizeText(body.tag, 60);
    }
    if ("highlight_date" in body) {
      const raw = body.highlight_date;
      if (raw === null || raw === "") {
        patch.highlight_date = null;
      } else if (typeof raw === "string") {
        const d = raw.slice(0, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          throw new AccessError("invalid_date", 400);
        }
        patch.highlight_date = d;
      } else {
        throw new AccessError("invalid_date", 400);
      }
    }
    if ("media_type" in body) {
      if (
        typeof body.media_type !== "string" ||
        !MEDIA_TYPES.includes(body.media_type as HighlightMediaType)
      ) {
        throw new AccessError("invalid_media_type", 400);
      }
      patch.media_type = body.media_type;
    }
    if ("media_url" in body) {
      const url = sanitizeText(body.media_url, 2000);
      if (!url) throw new AccessError("missing_media_url", 400);
      const effectiveType = (patch.media_type ?? highlight.media_type) as
        | HighlightMediaType
        | undefined;
      if (effectiveType === "video_link" && !VIDEO_URL_RE.test(url)) {
        throw new AccessError("invalid_video_url", 400);
      }
      patch.media_url = url;
    }
    if ("storage_path" in body) {
      patch.storage_path = sanitizeText(body.storage_path, 500);
    }
    if ("visibility" in body) {
      if (
        typeof body.visibility !== "string" ||
        !VISIBILITIES.includes(body.visibility as HighlightVisibility)
      ) {
        throw new AccessError("invalid_visibility", 400);
      }
      patch.visibility = body.visibility;
    }
    if ("is_featured" in body) {
      const desired = body.is_featured === true;
      if (desired !== highlight.is_featured && !perms.canFeature) {
        throw new AccessError("forbidden_feature", 403);
      }
      patch.is_featured = desired;
      if (desired && !highlight.is_featured) {
        const { error: unsetErr } = await supabase
          .from("basketball_player_highlights")
          .update({ is_featured: false, updated_at: new Date().toISOString() })
          .eq("player_id", id)
          .eq("is_featured", true);
        if (unsetErr) throw new AccessError(unsetErr.message, 500);
      }
    }

    const { data, error } = await supabase
      .from("basketball_player_highlights")
      .update(patch)
      .eq("id", highlightId)
      .select()
      .single();
    if (error) throw new AccessError(error.message, 500);

    return NextResponse.json({ highlight: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; highlightId: string }> },
) {
  const { id, highlightId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const { player, highlight } = await loadContext(
      supabase,
      id,
      highlightId,
    );
    const perms = await getHighlightPermissions(supabase, player, userId);
    if (!canMutateHighlight(perms)) throw new AccessError("forbidden", 403);

    const { error } = await supabase
      .from("basketball_player_highlights")
      .delete()
      .eq("id", highlightId);
    if (error) throw new AccessError(error.message, 500);

    if (highlight.storage_path) {
      await supabase.storage
        .from("basketball-player-highlights")
        .remove([highlight.storage_path as string])
        .catch(() => {
          /* best-effort; storage cleanup failure does not block delete */
        });
    }

    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
