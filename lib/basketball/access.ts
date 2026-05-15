// lib/basketball/access.ts
//
// Access-control helpers for the basketball_* tables. Two permission layers:
//   1. Platform admins   — Blueprint staff (platform_admins table).
//   2. League admins     — Per-league owners/admins (basketball_league_admins).
//   3. League members    — league-scoped roles in basketball_league_members:
//                          league_admin / team_manager / player /
//                          referee / scorekeeper / viewer.
//
// API handlers gate writes/reads via the `requireXxx` helpers and `AccessError`.
// RLS on the underlying tables is permissive; real enforcement lives here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/fantasy/daily/auth";

export type LeagueVisibility = "public" | "invite_only" | "private";
export type LeagueAdminRole = "league_owner" | "league_admin";
export type MemberRole =
  | "league_admin"
  | "team_manager"
  | "player"
  | "referee"
  | "scorekeeper"
  | "viewer";
export type MemberStatus = "pending" | "approved" | "rejected" | "removed";

export class AccessError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AccessError";
    this.status = status;
  }
}

/** Returns the Supabase Auth user id from the request's Bearer token, or null. */
export async function getCurrentUserIdFromRequest(
  req: Request,
): Promise<string | null> {
  return getAuthUserId(req);
}

/** True when the user is listed in platform_admins (any role). */
export async function isPlatformAdmin(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getBasketballLeagueAdminRole(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<LeagueAdminRole | null> {
  if (!userId) return null;
  const { data, error } = await supabase
    .from("basketball_league_admins")
    .select("role")
    .eq("basketball_league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data.role as LeagueAdminRole) ?? null;
}

export async function getBasketballLeagueMemberRole(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<{
  role: MemberRole | null;
  status: MemberStatus | null;
  team_id: string | null;
}> {
  if (!userId) return { role: null, status: null, team_id: null };
  const { data, error } = await supabase
    .from("basketball_league_members")
    .select("role, status, team_id")
    .eq("basketball_league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { role: null, status: null, team_id: null };
  return {
    role: (data.role as MemberRole) ?? null,
    status: (data.status as MemberStatus) ?? null,
    team_id: (data.team_id as string | null) ?? null,
  };
}

/**
 * Role-aware permission helpers requested by the Phase-1 spec. These all
 * resolve `true` when the user satisfies the named role for the given
 * league. `isLeagueAdmin` also returns true for platform admins.
 */
export async function isLeagueAdmin(
  supabase: SupabaseClient,
  userId: string | null,
  leagueId: string,
): Promise<boolean> {
  if (!userId) return false;
  if (await isPlatformAdmin(supabase, userId)) return true;
  const adminRole = await getBasketballLeagueAdminRole(supabase, leagueId, userId);
  if (adminRole) return true;
  const member = await getBasketballLeagueMemberRole(supabase, leagueId, userId);
  return member.role === "league_admin" && member.status === "approved";
}

export async function isTeamManager(
  supabase: SupabaseClient,
  userId: string | null,
  leagueId: string,
  teamId?: string | null,
): Promise<boolean> {
  if (!userId) return false;
  const member = await getBasketballLeagueMemberRole(supabase, leagueId, userId);
  if (member.role !== "team_manager" || member.status !== "approved") return false;
  if (teamId == null) return true;
  return member.team_id === teamId;
}

export async function isScorekeeper(
  supabase: SupabaseClient,
  userId: string | null,
  leagueId: string,
): Promise<boolean> {
  if (!userId) return false;
  const member = await getBasketballLeagueMemberRole(supabase, leagueId, userId);
  return member.role === "scorekeeper" && member.status === "approved";
}

export async function isReferee(
  supabase: SupabaseClient,
  userId: string | null,
  leagueId: string,
): Promise<boolean> {
  if (!userId) return false;
  const member = await getBasketballLeagueMemberRole(supabase, leagueId, userId);
  return member.role === "referee" && member.status === "approved";
}

export type BasketballLeagueAccess = {
  isPlatformAdmin: boolean;
  leagueAdminRole: LeagueAdminRole | null;
  memberRole: MemberRole | null;
  memberStatus: MemberStatus | null;
  memberTeamId: string | null;
  visibility: LeagueVisibility;
  canView: boolean;
  canManageLeague: boolean;
  canManageMembers: boolean;
  canManageTeamsPlayersGames: boolean;
  canManageOwnTeam: boolean;
  canInputStats: boolean;
  canEditOwnPlayerProfile: boolean;
};

/**
 * Computes the full access record for a (league, user) pair.
 * Loads the league's visibility, then runs the three role queries in parallel.
 * Throws AccessError(404) if the league does not exist.
 */
export async function getBasketballLeagueAccess(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<BasketballLeagueAccess> {
  const { data: league, error: leagueErr } = await supabase
    .from("basketball_leagues")
    .select("id, visibility")
    .eq("id", leagueId)
    .maybeSingle();
  if (leagueErr) throw new AccessError(leagueErr.message, 500);
  if (!league) throw new AccessError("league_not_found", 404);
  const visibility = (league.visibility as LeagueVisibility) ?? "invite_only";

  const [isAdmin, adminRole, member, claim] = await Promise.all([
    isPlatformAdmin(supabase, userId),
    getBasketballLeagueAdminRole(supabase, leagueId, userId),
    getBasketballLeagueMemberRole(supabase, leagueId, userId),
    userId
      ? supabase
          .from("basketball_players")
          .select("id")
          .eq("basketball_league_id", leagueId)
          .eq("claimed_by_user_id", userId)
          .eq("claim_status", "approved")
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const memberApproved = member.status === "approved";
  const isAdminLike =
    isAdmin || adminRole !== null || (member.role === "league_admin" && memberApproved);

  const canView =
    isAdminLike ||
    memberApproved ||
    visibility === "public";

  const canManageLeague = isAdminLike;
  const canManageMembers = isAdminLike;
  const canManageTeamsPlayersGames = isAdminLike;
  const canManageOwnTeam =
    isAdminLike || (member.role === "team_manager" && memberApproved);
  const canInputStats =
    isAdminLike || (member.role === "scorekeeper" && memberApproved);
  const canEditOwnPlayerProfile = !!(claim && (claim as { data?: unknown }).data);

  return {
    isPlatformAdmin: isAdmin,
    leagueAdminRole: adminRole,
    memberRole: member.role,
    memberStatus: member.status,
    memberTeamId: member.team_id,
    visibility,
    canView,
    canManageLeague,
    canManageMembers,
    canManageTeamsPlayersGames,
    canManageOwnTeam,
    canInputStats,
    canEditOwnPlayerProfile,
  };
}

export async function requirePlatformAdmin(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<void> {
  if (!userId) throw new AccessError("unauthorized", 401);
  if (!(await isPlatformAdmin(supabase, userId))) {
    throw new AccessError("forbidden", 403);
  }
}

/** Platform admin OR league_owner/league_admin for this league. */
export async function requireLeagueAdmin(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<void> {
  if (!userId) throw new AccessError("unauthorized", 401);
  if (await isPlatformAdmin(supabase, userId)) return;
  const role = await getBasketballLeagueAdminRole(supabase, leagueId, userId);
  if (role === "league_owner" || role === "league_admin") return;
  throw new AccessError("forbidden", 403);
}

/** Platform admin / league admin / approved scorekeeper. */
export async function requireStatsPermission(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<void> {
  if (!userId) throw new AccessError("unauthorized", 401);
  if (await isPlatformAdmin(supabase, userId)) return;
  const role = await getBasketballLeagueAdminRole(supabase, leagueId, userId);
  if (role === "league_owner" || role === "league_admin") return;
  const member = await getBasketballLeagueMemberRole(supabase, leagueId, userId);
  if (member.role === "scorekeeper" && member.status === "approved") return;
  throw new AccessError("forbidden", 403);
}

/**
 * Visibility-aware view gate.
 *   public      → anyone (including unauthenticated)
 *   invite_only → platform admin, league admin, or approved member
 *   private     → platform admin, league admin, or approved member
 */
export async function requireViewPermission(
  supabase: SupabaseClient,
  leagueId: string,
  userId: string | null,
): Promise<BasketballLeagueAccess> {
  const access = await getBasketballLeagueAccess(supabase, leagueId, userId);
  if (!access.canView) {
    throw new AccessError(
      access.visibility === "private" ? "private_league" : "invite_only_league",
      403,
    );
  }
  return access;
}
