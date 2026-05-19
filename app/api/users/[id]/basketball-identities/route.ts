export const dynamic = "force-dynamic";
// app/api/users/[id]/basketball-identities/route.ts
//
// GET — aggregated community-basketball-league identities for a user, for
// the public profile "社区联赛身份" section. Three identity flavors:
//
//   league_admin  — row in basketball_league_admins
//   team_manager  — approved basketball_league_members row with team_id
//   player        — approved binding on basketball_players
//
// Each row is left-joined to basketball_identity_visibility to attach a
// per-(user, identity) visibility flag (default false = hidden).
//
// When the requester is the profile owner, every identity is returned so
// they can flip visibility from the profile UI. Otherwise only rows whose
// `visible` is true are returned. Identities tied to non-approved leagues
// are omitted in both cases — pending/archived leagues should not surface
// on a public profile.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import { getCurrentUserIdFromRequest } from "@/lib/basketball/access";

type LeagueLite = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  status: string;
};

type Identity =
  | {
      identity_type: "league_admin";
      identity_ref_id: string;
      visible: boolean;
      league: LeagueLite;
      admin_role: string;
    }
  | {
      identity_type: "team_manager";
      identity_ref_id: string;
      visible: boolean;
      league: LeagueLite;
      team: { id: string; name: string } | null;
    }
  | {
      identity_type: "player";
      identity_ref_id: string;
      visible: boolean;
      league: LeagueLite;
      team: { id: string; name: string } | null;
      player: {
        id: string;
        display_name: string;
        jersey_number: string | null;
        avatar_url: string | null;
      };
    };

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetUserId } = await params;
  const supabase = serviceDb();
  const callerId = await getCurrentUserIdFromRequest(req);
  const isOwner = !!callerId && callerId === targetUserId;

  const [adminsRes, managersRes, playersRes, visRes] = await Promise.all([
    supabase
      .from("basketball_league_admins")
      .select(
        `id, role, basketball_leagues!inner ( id, slug, name, logo_url, status )`,
      )
      .eq("user_id", targetUserId),
    supabase
      .from("basketball_league_members")
      .select(
        `id, team_id,
         basketball_leagues!inner ( id, slug, name, logo_url, status ),
         basketball_teams ( id, name )`,
      )
      .eq("user_id", targetUserId)
      .eq("role", "team_manager")
      .eq("status", "approved")
      .not("team_id", "is", null),
    supabase
      .from("basketball_players")
      .select(
        `id, display_name, jersey_number, avatar_url,
         basketball_leagues!inner ( id, slug, name, logo_url, status ),
         basketball_teams ( id, name )`,
      )
      .eq("claimed_by_user_id", targetUserId)
      .eq("claim_status", "approved")
      .eq("is_active", true),
    supabase
      .from("basketball_identity_visibility")
      .select("identity_type, identity_ref_id, visible")
      .eq("user_id", targetUserId),
  ]);

  const visMap = new Map<string, boolean>();
  for (const v of (visRes.data ?? []) as Array<{
    identity_type: string;
    identity_ref_id: string;
    visible: boolean;
  }>) {
    visMap.set(`${v.identity_type}:${v.identity_ref_id}`, v.visible);
  }
  const isVisible = (type: string, ref: string) =>
    visMap.get(`${type}:${ref}`) ?? false;

  const identities: Identity[] = [];

  type AdminRow = {
    id: string;
    role: string;
    basketball_leagues: LeagueLite | null;
  };
  for (const row of ((adminsRes.data ?? []) as unknown as AdminRow[])) {
    if (!row.basketball_leagues || row.basketball_leagues.status !== "approved") continue;
    identities.push({
      identity_type: "league_admin",
      identity_ref_id: row.id,
      visible: isVisible("league_admin", row.id),
      league: row.basketball_leagues,
      admin_role: row.role,
    });
  }

  type ManagerRow = {
    id: string;
    team_id: string | null;
    basketball_leagues: LeagueLite | null;
    basketball_teams: { id: string; name: string } | null;
  };
  for (const row of ((managersRes.data ?? []) as unknown as ManagerRow[])) {
    if (!row.basketball_leagues || row.basketball_leagues.status !== "approved") continue;
    identities.push({
      identity_type: "team_manager",
      identity_ref_id: row.id,
      visible: isVisible("team_manager", row.id),
      league: row.basketball_leagues,
      team: row.basketball_teams,
    });
  }

  type PlayerRow = {
    id: string;
    display_name: string;
    jersey_number: string | null;
    avatar_url: string | null;
    basketball_leagues: LeagueLite | null;
    basketball_teams: { id: string; name: string } | null;
  };
  for (const row of ((playersRes.data ?? []) as unknown as PlayerRow[])) {
    if (!row.basketball_leagues || row.basketball_leagues.status !== "approved") continue;
    identities.push({
      identity_type: "player",
      identity_ref_id: row.id,
      visible: isVisible("player", row.id),
      league: row.basketball_leagues,
      team: row.basketball_teams,
      player: {
        id: row.id,
        display_name: row.display_name,
        jersey_number: row.jersey_number,
        avatar_url: row.avatar_url,
      },
    });
  }

  const filtered = isOwner ? identities : identities.filter((i) => i.visible);
  return NextResponse.json({ identities: filtered, is_owner: isOwner });
}
