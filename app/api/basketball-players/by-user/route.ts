export const dynamic = "force-dynamic";
// app/api/basketball-players/by-user/route.ts
//
// GET — list APPROVED basketball player profiles bound to a given user.
// Query: ?username=…  OR  ?user_id=<uuid>
// Returns bindings whose league is publicly viewable (visibility='public').
// Private/invite-only league bindings are stripped so they aren't leaked
// on the public user profile page.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";

type Out = {
  player_id: string;
  display_name: string;
  jersey_number: string | null;
  avatar_url: string | null;
  position: string | null;
  league_id: string;
  league_slug: string;
  league_name: string;
  league_logo_url: string | null;
  team_id: string | null;
  team_name: string | null;
};

export async function GET(req: Request) {
  const supabase = serviceDb();
  const url = new URL(req.url);
  const username = url.searchParams.get("username");
  const userId = url.searchParams.get("user_id");

  let resolvedUserId: string | null = userId;
  if (!resolvedUserId && username) {
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    resolvedUserId = (user as { id?: string } | null)?.id ?? null;
  }
  if (!resolvedUserId) return NextResponse.json({ players: [] });

  const { data: rows, error } = await supabase
    .from("basketball_players")
    .select(`
      id,
      display_name,
      jersey_number,
      avatar_url,
      position,
      team_id,
      basketball_league_id,
      basketball_leagues!inner ( id, slug, name, logo_url, visibility, status ),
      basketball_teams ( id, name )
    `)
    .eq("claimed_by_user_id", resolvedUserId)
    .eq("claim_status", "approved")
    .eq("is_active", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    id: string;
    display_name: string;
    jersey_number: string | null;
    avatar_url: string | null;
    position: string | null;
    team_id: string | null;
    basketball_league_id: string;
    basketball_leagues: {
      id: string;
      slug: string;
      name: string;
      logo_url: string | null;
      visibility: string;
      status: string;
    } | null;
    basketball_teams: { id: string; name: string } | null;
  };

  const players: Out[] = (rows as unknown as Row[] | null ?? [])
    .filter(
      (r) =>
        r.basketball_leagues &&
        r.basketball_leagues.visibility === "public" &&
        r.basketball_leagues.status === "approved",
    )
    .map((r) => ({
      player_id: r.id,
      display_name: r.display_name,
      jersey_number: r.jersey_number,
      avatar_url: r.avatar_url,
      position: r.position,
      league_id: r.basketball_leagues!.id,
      league_slug: r.basketball_leagues!.slug,
      league_name: r.basketball_leagues!.name,
      league_logo_url: r.basketball_leagues!.logo_url,
      team_id: r.team_id,
      team_name: r.basketball_teams?.name ?? null,
    }));

  return NextResponse.json({ players });
}
