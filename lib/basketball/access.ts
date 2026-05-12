// lib/basketball/access.ts
//
// Access-control helpers for the basketball_* tables. Two permission layers:
//   1. Platform admins   — Blueprint staff (platform_admins table).
//   2. League admins     — Per-league owners/admins (basketball_league_admins).
//   3. League members    — stat_keeper / player / viewer (basketball_league_members).
//
// API handlers gate writes/reads via the `requireXxx` helpers and `AccessError`.
// RLS on the underlying tables is permissive; real enforcement lives here.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/fantasy/daily/auth";

export type LeagueVisibility = "public" | "invite_only" | "private";
export type LeagueAdminRole = "league_owner" | "league_admin";
export type MemberRole = "stat_keeper" | "player" | "viewer";
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
): Promise<{ role: MemberRole | null; status: MemberStatus | null }> {
  if (!userId) return { role: null, status: null };
  const { data, error } = await supabase
    .from("basketball_league_members")
    .select("role, status")
    .eq("basketball_league_id", leagueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return { role: null, status: null };
  return {
    role: (data.role as MemberRole) ?? null,
    status: (data.status as MemberStatus) ?? null,
  };
}

export type BasketballLeagueAccess = {
  isPlatformAdmin: boolean;
  leagueAdminRole: LeagueAdminRole | null;
  memberRole: MemberRole | null;
  memberStatus: MemberStatus | null;
  visibility: LeagueVisibility;
  canView: boolean;
  canManageLeague: boolean;
  canManageMembers: boolean;
  canManageTeamsPlayersGames: boolean;
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
  const isAdminLike = isAdmin || adminRole !== null;

  const canView =
    isAdminLike ||
    memberApproved ||
    visibility === "public";

  const canManageLeague = isAdminLike;
  const canManageMembers = isAdminLike;
  const canManageTeamsPlayersGames = isAdminLike;
  const canInputStats =
    isAdminLike || (member.role === "stat_keeper" && memberApproved);
  const canEditOwnPlayerProfile = !!(claim && (claim as { data?: unknown }).data);

  return {
    isPlatformAdmin: isAdmin,
    leagueAdminRole: adminRole,
    memberRole: member.role,
    memberStatus: member.status,
    visibility,
    canView,
    canManageLeague,
    canManageMembers,
    canManageTeamsPlayersGames,
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

/** Platform admin / league admin / approved stat_keeper. */
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
  if (member.role === "stat_keeper" && member.status === "approved") return;
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
