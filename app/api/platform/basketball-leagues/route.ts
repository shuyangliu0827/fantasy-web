export const dynamic = "force-dynamic";
// GET /api/platform/basketball-leagues — platform admin only.
// Returns every basketball league (any visibility, any status).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requirePlatformAdmin,
} from "@/lib/basketball/access";

export async function GET(req: Request) {
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requirePlatformAdmin(supabase, userId);

    const { data, error } = await supabase
      .from("basketball_leagues")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ leagues: data ?? [] });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
