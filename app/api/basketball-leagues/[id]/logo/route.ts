export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/logo/route.ts
//
// POST — multipart upload of the league logo. League/platform admin only.
// Server-side via the service-role client; bucket: basketball-league-logos.
// Returns { url }; the caller PATCHes the league row's logo_url.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
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
    await requireLeagueAdmin(supabase, id, userId);

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
    const path = `${id}/logo.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: uploadErr } = await supabase.storage
      .from("basketball-league-logos")
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
      .from("basketball-league-logos")
      .getPublicUrl(path);
    return NextResponse.json({ url: pub.publicUrl });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
