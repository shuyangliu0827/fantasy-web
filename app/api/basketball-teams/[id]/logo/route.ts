export const dynamic = "force-dynamic";
// app/api/basketball-teams/[id]/logo/route.ts
//
// POST — accepts multipart/form-data with a "file" field. Server-side
// upload to the basketball-team-logos bucket using the service-role
// Supabase client. Authorization is platform admin / league admin only.
//
// Returns { url } — the public URL. Caller is responsible for PATCHing
// the team row's logo_url with this value (matches the existing client
// flow).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
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

    const { data: team, error: tErr } = await supabase
      .from("basketball_teams")
      .select("id, basketball_league_id")
      .eq("id", id)
      .maybeSingle();
    if (tErr) throw new AccessError(tErr.message, 500);
    if (!team) throw new AccessError("team_not_found", 404);

    const isAdmin =
      (await isPlatformAdmin(supabase, userId)) ||
      (await getBasketballLeagueAdminRole(
        supabase,
        team.basketball_league_id,
        userId,
      )) !== null;
    if (!isAdmin) {
      const member = await getBasketballLeagueMemberRole(
        supabase,
        team.basketball_league_id,
        userId,
      );
      const isManagerOfTeam =
        member.role === "team_manager" &&
        member.status === "approved" &&
        member.team_id === team.id;
      if (!isManagerOfTeam) throw new AccessError("forbidden", 403);
    }

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
    const path = `${team.basketball_league_id}/${team.id}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("basketball-team-logos")
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
      .from("basketball-team-logos")
      .getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
