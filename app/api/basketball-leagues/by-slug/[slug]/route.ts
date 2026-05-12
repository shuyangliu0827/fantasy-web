export const dynamic = "force-dynamic";
// GET /api/basketball-leagues/by-slug/[slug]
// Resolves a slug → league + access record (visibility-aware).
// Public leagues are readable by anyone; otherwise only members/admins.
// When access is denied, returns { league: {id,slug,name,visibility}, access }
// with status 200 so the page can render the appropriate wall.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getBasketballLeagueAccess,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const supabase = serviceDb();

  const { data: league, error } = await supabase
    .from("basketball_leagues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!league) return NextResponse.json({ error: "league_not_found" }, { status: 404 });

  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const access = await getBasketballLeagueAccess(supabase, league.id, userId);

    // Pending leagues are invisible to the public — only admins/owners
    // can land on the slug while it's pending approval.
    const isAdminLike = access.isPlatformAdmin || access.leagueAdminRole !== null;
    if (league.status !== "approved" && !isAdminLike) {
      return NextResponse.json({ error: "league_not_found" }, { status: 404 });
    }

    if (!access.canView) {
      // Strip full league payload — return only what walls need to render.
      return NextResponse.json({
        league: {
          id: league.id,
          slug: league.slug,
          name: league.name,
          visibility: league.visibility,
        },
        access,
      });
    }
    return NextResponse.json({ league, access });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
