// lib/auth/getPostLoginRedirect.ts
//
// Centralized post-login redirect logic. Pure function — no I/O, no
// framework imports — so it can be reused from any auth surface (login,
// signup confirm, magic-link callback) and unit-tested in isolation.
//
// Priority order:
//   1. A safe `next` query param wins above all role defaults.
//   2. Otherwise, users with any basketball management role land on
//      /league-admin (Phase 0/1's RoleContext.canAccessAnyAdmin).
//   3. Everyone else (fans, fantasy-league commissioners with no
//      basketball role, players-without-a-role) lands on `fallback`
//      (default "/").
//
// Fantasy `leagues.commissioner_id` is intentionally NOT consulted here.
// RoleContext only knows about basketball_* tables (platform_admins,
// basketball_league_admins, basketball_league_members) per Rule E, so a
// fantasy commissioner without a basketball role goes to "/" and reaches
// their league via the public hub at /league/[slug], not /league-admin.

import type { RoleContext } from "@/lib/auth/getCurrentUserRole";

/**
 * Returns true when `path` is a same-origin URL path that's safe to
 * pass to router.push() / router.replace(). Rejects external URLs,
 * protocol-relative URLs, javascript:/data: scheme abuse, and control
 * characters that can confuse path parsers.
 */
export function isSafeInternalPath(path: string | null | undefined): boolean {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  // Block protocol-relative URLs like //evil.com that browsers interpret
  // as absolute.
  if (path.startsWith("//")) return false;
  // Block "/\evil.com" — backslashes get normalized to forward slashes
  // by some user agents.
  if (path.includes("\\")) return false;
  // Reject embedded protocol schemes anywhere before the first slash.
  // e.g. "javascript:alert(1)", "data:text/html,...".
  if (/^[^/]*:/.test(path)) return false;
  // Reject control characters that could be stripped during URL parsing
  // and re-expose an external destination.
  if (/[\x00-\x1f\x7f]/.test(path)) return false;
  return true;
}

export type PostLoginArgs = {
  /** Raw `next` query param (or null/undefined if absent). */
  next?: string | null;
  /** RoleContext for the user who just authenticated. */
  roles: RoleContext;
  /** Destination when no `next` and the user has no admin roles. */
  fallback?: string;
};

/**
 * Resolves the URL to navigate to after a successful login or signup.
 * Always returns an internal path; never throws.
 */
export function getPostLoginRedirect({
  next,
  roles,
  fallback = "/",
}: PostLoginArgs): string {
  if (isSafeInternalPath(next)) return next as string;
  if (roles.canAccessAnyAdmin) return "/league-admin";
  return fallback;
}
