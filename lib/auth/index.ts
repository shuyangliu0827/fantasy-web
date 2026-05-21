// lib/auth/index.ts
//
// Barrel for the unified auth/role-context layer. New code should import
// from "@/lib/auth" rather than reaching into individual files.

export {
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export {
  getCurrentUserRole,
  resolveRoleContext,
  EMPTY_ROLE_CONTEXT,
  type RoleContext,
  type TeamManagerScope,
  type PlayerScope,
} from "@/lib/auth/getCurrentUserRole";

export {
  useCurrentUserRoles,
  resetCurrentUserRoles,
} from "@/lib/auth/use-current-user-roles";

export {
  getPostLoginRedirect,
  isSafeInternalPath,
  type PostLoginArgs,
} from "@/lib/auth/getPostLoginRedirect";
