"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { useCurrentUserRoles } from "@/lib/auth/use-current-user-roles";
import AccessDenied from "@/components/shared/AccessDenied";

export default function LeagueAdminLanding() {
  const { t } = useLang();
  const { roles, loading } = useCurrentUserRoles();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-sm text-neutral-500">
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

  const managedLeagueIds = Array.from(
    new Set([
      ...roles.leagueAdminOf,
      ...roles.teamManagerOf.map((s) => s.leagueId),
    ]),
  );

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("联赛管理中心", "League Management Center")}
        </h1>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400 max-w-2xl">
          {t(
            "管理真实联赛的数据、球队、球员、赛程、记分与权限。这些数据将驱动公开联赛主页、球员档案、排行榜以及未来的 Fantasy 玩法。",
            "Manage real league data, teams, players, games, scoring, and permissions. This data powers public league pages, player profiles, rankings, and future fantasy experiences.",
          )}
        </p>
      </header>

      {roles.isAppAdmin && (
        <section className="mb-8 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-medium">
                {t("平台管理", "Platform Admin")}
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                {t(
                  "审批联赛、授权联赛管理员、查看所有联赛。",
                  "Approve leagues, grant league-admin permissions, view all leagues.",
                )}
              </p>
            </div>
            <Link
              href="/admin/platform/basketball-leagues"
              className="inline-flex items-center px-4 py-2 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90"
            >
              {t("打开平台管理", "Open Platform Admin")}
            </Link>
          </div>
        </section>
      )}

      <section>
        <h2 className="font-medium mb-3">
          {t("我可以管理的联赛", "Leagues you can manage")}
        </h2>
        {managedLeagueIds.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {t(
              "您目前没有可管理的联赛。请联系平台管理员或联赛创建者申请权限。",
              "You don't have any leagues to manage yet. Contact a platform admin or league owner to request access.",
            )}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {managedLeagueIds.map((id) => (
              <li
                key={id}
                className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-4"
              >
                <div className="font-mono text-xs text-neutral-500 mb-2">
                  {id}
                </div>
                <Link
                  href={`/league-admin/${id}`}
                  className="text-sm font-medium text-blue-700 dark:text-blue-400 hover:underline"
                >
                  {t("打开联赛管理 →", "Open league management →")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
