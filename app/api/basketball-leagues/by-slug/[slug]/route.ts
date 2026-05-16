export const dynamic = "force-dynamic";
// GET /api/basketball-leagues/by-slug/[slug]
// Resolves a slug → league + access record (visibility-aware).
// Public leagues are readable by anyone; otherwise only members/admins.
// When access is denied, returns { league: {id,slug,name,visibility}, access }
// with status 200 so the page can render the appropriate wall.
//
// When the caller has a pending/approved claim on a player in this league,
// the response also includes `member_player` with the bound row so the UI
// can show "已绑定球员档案 · {name} #{jersey}" and link to the player page.

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

    let memberPlayer: {
      id: string;
      display_name: string;
      jersey_number: string | null;
      team_id: string | null;
      claim_status: string;
    } | null = null;
    let memberTeam: {
      id: string;
      name: string;
      logo_url: string | null;
    } | null = null;
    if (userId) {
      const { data: mp } = await supabase
        .from("basketball_players")
        .select("id, display_name, jersey_number, team_id, claim_status")
        .eq("basketball_league_id", league.id)
        .eq("claimed_by_user_id", userId)
        .in("claim_status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      if (mp) {
        memberPlayer = {
          id: mp.id as string,
          display_name: mp.display_name as string,
          jersey_number: (mp.jersey_number as string | null) ?? null,
          team_id: (mp.team_id as string | null) ?? null,
          claim_status: mp.claim_status as string,
        };
      }
      if (
        access.memberRole === "team_manager" &&
        access.memberStatus === "approved" &&
        access.memberTeamId
      ) {
        const { data: tm } = await supabase
          .from("basketball_teams")
          .select("id, name, logo_url")
          .eq("id", access.memberTeamId)
          .maybeSingle();
        if (tm) {
          memberTeam = {
            id: tm.id as string,
            name: tm.name as string,
            logo_url: (tm.logo_url as string | null) ?? null,
          };
        }
      }
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
        member_player: memberPlayer,
        member_team: memberTeam,
      });
    }
    return NextResponse.json({
      league,
      access,
      member_player: memberPlayer,
      member_team: memberTeam,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
