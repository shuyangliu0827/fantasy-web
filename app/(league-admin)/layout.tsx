"use client";

// app/(league-admin)/layout.tsx
//
// Defense-in-depth gate for every route under (league-admin)/league-admin/*.
// Renders children only when the authenticated user has any admin/manager
// role (app_admin, league_admin, or approved team_manager). Unauthenticated
// visitors see a sign-in prompt; signed-in users without a role see an
// access-denied screen.
//
// Note: Supabase sessions live in localStorage in this project, so we can't
// gate server-side from a Bearer token here. The check still happens at
// route handlers via /lib/basketball/access (requireLeagueAdmin etc.),
// which is the authoritative source. This layout is a UI fast-path that
// prevents the admin shell from flashing for unauthorized users.

import { useLang } from "@/lib/lang";
import { useCurrentUserRoles } from "@/lib/auth/use-current-user-roles";
import AccessDenied from "@/components/shared/AccessDenied";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

export default function LeagueAdminGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { t } = useLang();
  const { roles, loading } = useCurrentUserRoles();

  if (loading) {
    return (
      <div
        style={{
          minHeight: "50vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#64748b",
          fontSize: 14,
          fontFamily: FONT,
        }}
      >
        {t("加载中…", "Loading…")}
      </div>
    );
  }

  if (!roles.userId) {
    return <AccessDenied requireSignIn nextHref="/league-admin" />;
  }
  if (!roles.canAccessAnyAdmin) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

