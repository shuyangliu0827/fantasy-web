// lib/league-management/index.ts
//
// Façade for the **basketball** League Management Center domain.
// Surfaces the access-control + supporting helpers used by routes
// under /league-admin and the API handlers they call.
//
// This is a re-export layer over lib/basketball/*. The legacy paths
// remain importable for backward compatibility — new code should
// prefer "@/lib/league-management" so the surface stays stable as
// internals move.
//
// IMPORTANT (Rule E):
//   This domain covers `basketball_*` tables (real-world leagues,
//   custom games, custom box scores) ONLY. Fantasy season-long
//   leagues (the `leagues` table, BDL integer IDs, commissioner_id)
//   are a separate domain — do NOT import from here for fantasy work.
//   See lib/fantasy/* and lib/scoring/* for fantasy helpers.

// ── Access / authorization ─────────────────────────────────────────
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
  getCurrentUserIdFromRequest,
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

// ── Server-side DB client (service role with anon fallback) ────────
export { serviceDb, type Db } from "@/lib/basketball/db";

// ── Client-side fetch wrapper (attaches Supabase Bearer token) ─────
export { basketballFetch, basketballJson } from "@/lib/basketball/client";

// ── Label helpers (UI strings for roles / statuses / stat keys) ────
export * from "@/lib/basketball/role-labels";
export * from "@/lib/basketball/status-labels";
export * from "@/lib/basketball/stat-labels";

// ── Storage / uploads ──────────────────────────────────────────────
export * from "@/lib/basketball/uploads";

// ── Game events ────────────────────────────────────────────────────
export * from "@/lib/basketball/events";

// ── Contest helpers (built on top of basketball_* contests) ────────
export * from "@/lib/basketball/aggregate";
export * from "@/lib/basketball/contest-date";
export * from "@/lib/basketball/contest-positions";
export * from "@/lib/basketball/contest-resolver";
export * from "@/lib/basketball/contest-salary";
export * from "@/lib/basketball/contest-settler";
