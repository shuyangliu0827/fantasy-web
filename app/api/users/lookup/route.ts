export const dynamic = "force-dynamic";
// app/api/users/lookup/route.ts
//
// GET /api/users/lookup?id=<uuid>
//
// Resolves a Blueprint user by UUID for the community-league "invite by
// UUID" flow. Restricted to authenticated callers who already hold an
// admin or team-manager role in at least one basketball league — this
// prevents the endpoint being used as a generic public user-by-UUID
// lookup.
//
// Returns the minimum identity needed for the preview card:
//   { id, username, name, avatar_url }

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";

export async function GET(req: Request) {
  const supabase = serviceDb();
  try {
    const callerId = await getCurrentUserIdFromRequest(req);
    if (!callerId) throw new AccessError("unauthorized", 401);

    const url = new URL(req.url);
    const targetId = (url.searchParams.get("id") ?? "").trim();
    if (!targetId) throw new AccessError("missing_id", 400);

    // The caller must already be an admin/manager somewhere. Platform admins
    // pass unconditionally. Otherwise check basketball_league_admins or an
    // approved league_admin/team_manager row in basketball_league_members.
    let allowed = await isPlatformAdmin(supabase, callerId);
    if (!allowed) {
      const { data: adminRow } = await supabase
        .from("basketball_league_admins")
        .select("id")
        .eq("user_id", callerId)
        .limit(1)
        .maybeSingle();
      if (adminRow) allowed = true;
    }
    if (!allowed) {
      const { data: memberRow } = await supabase
        .from("basketball_league_members")
        .select("id")
        .eq("user_id", callerId)
        .eq("status", "approved")
        .in("role", ["league_admin", "team_manager"])
        .limit(1)
        .maybeSingle();
      if (memberRow) allowed = true;
    }
    if (!allowed) throw new AccessError("forbidden", 403);

    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, name, avatar_url")
      .eq("id", targetId)
      .maybeSingle();
    if (error) throw new AccessError(error.message, 500);
    if (!user) throw new AccessError("user_not_found", 404);

    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
