// lib/permissions/index.ts
//
// Centralized permission façade. Re-exports the backend permission
// primitives from lib/basketball/access.ts plus the role-hierarchy
// constants used across the League Management Center.
//
// New code should import from "@/lib/permissions"; existing code in
// lib/basketball/* may continue to import directly until migrated.

export {
  AccessError,
  isPlatformAdmin,
  isLeagueAdmin,
  isTeamManager,
  isScorekeeper,
  isReferee,
  getBasketballLeagueAccess,
  getBasketballLeagueAdminRole,
  getBasketballLeagueMemberRole,
  requirePlatformAdmin,
  requireLeagueAdmin,
  requireStatsPermission,
  requireViewPermission,
  type LeagueVisibility,
  type LeagueAdminRole,
  type MemberRole,
  type MemberStatus,
  type BasketballLeagueAccess,
} from "@/lib/basketball/access";

/**
 * Product-level role hierarchy. Higher index = lower privilege.
 * Used by navigation, redirects, and access-denied messaging.
 */
export const ROLE_HIERARCHY = [
  "app_admin",
  "league_admin",
  "team_manager",
  "player",
  "fan",
] as const;

export type ProductRole = (typeof ROLE_HIERARCHY)[number];
