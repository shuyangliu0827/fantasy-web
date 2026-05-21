// lib/auth/getCurrentUserRole.ts
//
// Unified server-side role resolver. Reads from the existing tables —
// platform_admins, basketball_league_admins, basketball_league_members,
// basketball_players — and returns a normalized RoleContext for use by
// pages, layouts, and the /api/me/roles endpoint.
//
// This is a thin aggregator on top of lib/basketball/access.ts. It does
// not introduce any new permission semantics; it only flattens the
// existing checks into a single record so client code can decide what
// chrome to render without scattering role queries everywhere.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCurrentUserIdFromRequest,
  isPlatformAdmin,
} from "@/lib/basketball/access";
import { serviceDb } from "@/lib/basketball/db";

export type TeamManagerScope = {
  leagueId: string;
  teamId: string;
};

export type PlayerScope = {
  leagueId: string;
  playerId: string;
};

export type RoleContext = {
  userId: string | null;
  isAppAdmin: boolean;
  /** basketball_league ids where the user is league_owner or league_admin. */
  leagueAdminOf: string[];
  /** (leagueId, teamId) pairs where the user is an approved team_manager. */
  teamManagerOf: TeamManagerScope[];
  /** (leagueId, playerId) pairs where the user has an approved player claim. */
  playerOf: PlayerScope[];
  /** True when the user can enter the League Management Center at all. */
  canAccessAnyAdmin: boolean;
};

export const EMPTY_ROLE_CONTEXT: RoleContext = {
  userId: null,
  isAppAdmin: false,
  leagueAdminOf: [],
  teamManagerOf: [],
  playerOf: [],
  canAccessAnyAdmin: false,
};

/**
 * Resolves the full role context for a userId. Pass a Supabase client
 * (typically serviceDb()) — callers that already have one should reuse it.
 */
export async function resolveRoleContext(
  supabase: SupabaseClient,
  userId: string | null,
): Promise<RoleContext> {
  if (!userId) return EMPTY_ROLE_CONTEXT;

  const [isAdmin, adminRows, memberRows, playerRows] = await Promise.all([
    isPlatformAdmin(supabase, userId),
    supabase
      .from("basketball_league_admins")
      .select("basketball_league_id")
      .eq("user_id", userId),
    supabase
      .from("basketball_league_members")
      .select("basketball_league_id, role, status, team_id")
      .eq("user_id", userId)
      .eq("status", "approved"),
    supabase
      .from("basketball_players")
      .select("id, basketball_league_id")
      .eq("claimed_by_user_id", userId)
      .eq("claim_status", "approved"),
  ]);

  const leagueAdminOf = new Set<string>(
    (adminRows.data ?? [])
      .map((r) => r.basketball_league_id as string | null)
      .filter((id): id is string => !!id),
  );

  const teamManagerOf: TeamManagerScope[] = [];
  for (const row of memberRows.data ?? []) {
    const role = row.role as string | null;
    const leagueId = row.basketball_league_id as string | null;
    const teamId = row.team_id as string | null;
    if (role === "league_admin" && leagueId) {
      leagueAdminOf.add(leagueId);
    }
    if (role === "team_manager" && leagueId && teamId) {
      teamManagerOf.push({ leagueId, teamId });
    }
  }

  const playerOf: PlayerScope[] = (playerRows.data ?? [])
    .map((r) => ({
      leagueId: r.basketball_league_id as string | null,
      playerId: r.id as string | null,
    }))
    .filter((p): p is PlayerScope => !!p.leagueId && !!p.playerId);

  const leagueAdminList = Array.from(leagueAdminOf);
  const canAccessAnyAdmin =
    isAdmin || leagueAdminList.length > 0 || teamManagerOf.length > 0;

  return {
    userId,
    isAppAdmin: isAdmin,
    leagueAdminOf: leagueAdminList,
    teamManagerOf,
    playerOf,
    canAccessAnyAdmin,
  };
}

/**
 * Resolves the role context for the current request's Bearer token.
 * Returns EMPTY_ROLE_CONTEXT for anonymous callers — never throws.
 */
export async function getCurrentUserRole(req: Request): Promise<RoleContext> {
  const userId = await getCurrentUserIdFromRequest(req);
  if (!userId) return EMPTY_ROLE_CONTEXT;
  return resolveRoleContext(serviceDb(), userId);
}
