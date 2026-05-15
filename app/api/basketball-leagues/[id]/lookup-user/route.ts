export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/lookup-user/route.ts
//
// GET /api/basketball-leagues/{id}/lookup-user?u=<username>
//
// Admin-gated helper for the league members invite UI. Resolves a
// platform username to a uuid + display info so admins do not have to
// know auth UUIDs. Returns 404 when the username is not found.
//
// Authorization: league admin or platform admin only (so this is not
// usable as a general username-to-id directory).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const url = new URL(req.url);
    const username = url.searchParams.get("u")?.trim();
    if (!username) throw new AccessError("missing_username", 400);

    const { data, error } = await supabase
      .from("users")
      .select("id, username, name, avatar_url")
      .eq("username", username)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    return NextResponse.json({
      user_id: data.id,
      username: data.username,
      name: data.name ?? null,
      avatar_url: data.avatar_url ?? null,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
