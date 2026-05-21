// lib/permissions/index.ts
//
// Centralized permission façade. Re-exports the backend permission
// primitives from lib/basketball/access.ts, the action-level capability
// helpers from ./capabilities, plus the role-hierarchy constants used
// across the basketball League Management Center.
//
// IMPORTANT (Rule E):
//   Every helper here describes basketball-domain access
//   (platform_admins, basketball_league_admins,
//   basketball_league_members). Fantasy commissioner status lives on
//   `leagues.commissioner_id` and is intentionally NOT modeled here.
//   Fantasy commissioner checks remain a simple
//   `user.id === league.commissioner_id` comparison inside the
//   /league/[slug]/* surface.
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

// Action-level capability checks (can(action, access)) — see
// ./capabilities for the action enum.
export { can, type LeagueAction } from "@/lib/permissions/capabilities";

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
