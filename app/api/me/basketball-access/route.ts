export const dynamic = "force-dynamic";
// GET /api/me/basketball-access
// Returns whether the current user is a platform admin and lists their
// league-admin roles. Used by /admin UIs to decide what to render.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";

export async function GET(req: Request) {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json({
      user_id: null,
      is_platform_admin: false,
      league_admin_of: [],
    });
  }
  const supabase = serviceDb();
  const [isAdmin, { data: rows }] = await Promise.all([
    isPlatformAdmin(supabase, userId),
    supabase
      .from("basketball_league_admins")
      .select("basketball_league_id, role")
      .eq("user_id", userId),
  ]);
  return NextResponse.json({
    user_id: userId,
    is_platform_admin: isAdmin,
    league_admin_of: rows ?? [],
  });
}
