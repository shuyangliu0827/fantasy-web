// lib/basketball/highlights.ts
//
// Types and permission helper for the player-highlights feature.
//
// Editor rules (matches the spec):
//   • League admin / platform admin → full access (create/edit/delete/feature
//     any highlight on any player in the league).
//   • Team manager → create/edit/delete on players whose team_id matches the
//     manager's membership team_id. Cannot toggle `is_featured`.
//   • Bound player (claim_status='approved' on this player) → create/edit/
//     delete on their own profile. Cannot toggle `is_featured`.
//   • Everyone else → view only (subject to the league's visibility wall).

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  isPlatformAdmin,
} from "@/lib/basketball/access";

export type HighlightMediaType = "image" | "video_link";
export type HighlightVisibility = "public" | "members_only";

export type PlayerHighlight = {
  id: string;
  basketball_league_id: string;
  player_id: string;
  created_by: string;
  media_type: HighlightMediaType;
  media_url: string;
  storage_path: string | null;
  title: string;
  description: string | null;
  game_opponent: string | null;
  highlight_date: string | null;
  tag: string | null;
  is_featured: boolean;
  visibility: HighlightVisibility;
  created_at: string;
  updated_at: string;
};

export type HighlightPermissions = {
  canCreate: boolean;
  canEditAny: boolean;
  canFeature: boolean;
  // True when caller may edit/delete a specific highlight row.
  // Resolved per-row in the route, but exposed in the list response so the
  // client can show edit/delete affordances without a second round-trip.
  isAdminLike: boolean;
  isTeamManagerOfPlayer: boolean;
  isOwnerOfPlayer: boolean;
};

export type PlayerRefForHighlights = {
  basketball_league_id: string;
  team_id: string | null;
  claimed_by_user_id: string | null;
  claim_status: string;
};

export async function getHighlightPermissions(
  supabase: SupabaseClient,
  player: PlayerRefForHighlights,
  userId: string | null,
): Promise<HighlightPermissions> {
  if (!userId) {
    return {
      canCreate: false,
      canEditAny: false,
      canFeature: false,
      isAdminLike: false,
      isTeamManagerOfPlayer: false,
      isOwnerOfPlayer: false,
    };
  }

  const [platformAdmin, adminRole, member] = await Promise.all([
    isPlatformAdmin(supabase, userId),
    getBasketballLeagueAdminRole(
      supabase,
      player.basketball_league_id,
      userId,
    ),
    getBasketballLeagueMemberRole(
      supabase,
      player.basketball_league_id,
      userId,
    ),
  ]);

  const isAdminLike = platformAdmin || adminRole !== null;
  const isTeamManagerOfPlayer =
    member.role === "team_manager" &&
    member.status === "approved" &&
    member.team_id != null &&
    member.team_id === player.team_id;
  const isOwnerOfPlayer =
    player.claimed_by_user_id === userId && player.claim_status === "approved";

  const canEditAny = isAdminLike;
  const canCreate = isAdminLike || isTeamManagerOfPlayer || isOwnerOfPlayer;
  const canFeature = isAdminLike;

  return {
    canCreate,
    canEditAny,
    canFeature,
    isAdminLike,
    isTeamManagerOfPlayer,
    isOwnerOfPlayer,
  };
}

export function canMutateHighlight(perms: HighlightPermissions): boolean {
  return (
    perms.isAdminLike || perms.isTeamManagerOfPlayer || perms.isOwnerOfPlayer
  );
}
