"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { useCurrentUserRoles } from "@/lib/auth/use-current-user-roles";
import { supabase } from "@/lib/shared/supabase";
import { leagueStatusLabel } from "@/lib/basketball/status-labels";
import AccessDenied from "@/components/shared/AccessDenied";

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

type LeagueRow = {
  id: string;
  name: string | null;
  slug: string | null;
  description: string | null;
  status: string | null;
  visibility: string | null;
  logo_url: string | null;
  created_at: string | null;
};

export default function LeagueAdminLanding() {
  const { t, lang } = useLang();
  const { roles, loading } = useCurrentUserRoles();
  const [leagues, setLeagues] = useState<LeagueRow[]>([]);
  const [leaguesLoading, setLeaguesLoading] = useState(false);

  // RoleContext gives us only IDs; fetch display fields for each managed
  // league so we never show raw UUIDs as the primary name.
  useEffect(() => {
    if (loading || !roles.canAccessAnyAdmin) return;
    const ids = Array.from(
      new Set([
        ...roles.leagueAdminOf,
        ...roles.teamManagerOf.map((s) => s.leagueId),
      ]),
    );
    let cancelled = false;
    if (ids.length === 0) {
      // Defer to next microtask so we're not synchronously calling
      // setState during effect body.
      Promise.resolve().then(() => {
        if (!cancelled) setLeagues([]);
      });
      return () => {
        cancelled = true;
      };
    }
    (async () => {
      setLeaguesLoading(true);
      const { data } = await supabase
        .from("basketball_leagues")
        .select(
          "id, name, slug, description, status, visibility, logo_url, created_at",
        )
        .in("id", ids);
      if (cancelled) return;
      // Preserve role-list order so league_admin entries come before
      // team-manager-only entries.
      const byId = new Map<string, LeagueRow>(
        (data ?? []).map((r) => [r.id as string, r as LeagueRow]),
      );
      const ordered: LeagueRow[] = [];
      for (const id of ids) {
        const row = byId.get(id);
        if (row) ordered.push(row);
        else
          ordered.push({
            id,
            name: null,
            slug: null,
            description: null,
            status: null,
            visibility: null,
            logo_url: null,
            created_at: null,
          });
      }
      setLeagues(ordered);
      setLeaguesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loading, roles.canAccessAnyAdmin, roles.leagueAdminOf, roles.teamManagerOf]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "40vh",
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

  return (
    <main
      style={{
        minHeight: "calc(100vh - 64px)",
        background: "#f8fafc",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "32px 24px 64px",
        }}
      >
        {/* ── Hero / Intro ── */}
        <section
          style={{
            background:
              "linear-gradient(135deg, #1e3a8a 0%, #1e40af 60%, #2563eb 100%)",
            borderRadius: 20,
            padding: "32px 32px 28px",
            color: "#fff",
            position: "relative",
            overflow: "hidden",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              position: "absolute",
              right: -60,
              top: -60,
              width: 240,
              height: 240,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.06)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 80,
              bottom: -80,
              width: 180,
              height: 180,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              display: "inline-block",
              padding: "4px 12px",
              background: "rgba(255,255,255,0.15)",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
              marginBottom: 14,
            }}
          >
            {t("管理中心", "Management Center")}
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.5px",
              lineHeight: 1.15,
            }}
          >
            {t("联赛管理中心", "League Management Center")}
          </h1>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 14,
              color: "rgba(255,255,255,0.82)",
              lineHeight: 1.7,
              maxWidth: 720,
            }}
          >
            {t(
              "管理真实联赛的数据、球队、球员、赛程、记分与权限。这些数据将驱动公开联赛主页、球员档案、排行榜以及未来的 Fantasy 玩法。",
              "Manage real league data, teams, players, games, scoring, and permissions. This data powers public league pages, player profiles, rankings, and future Fantasy experiences.",
            )}
          </p>
        </section>

        {/* ── Platform Management (app_admin only) ── */}
        {roles.isAppAdmin && (
          <section
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 16,
              padding: "20px 24px",
              marginBottom: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {t("平台管理", "Platform Management")}
              </h2>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.55,
                }}
              >
                {t(
                  "审批联赛、分配联赛管理员、查看所有联赛。",
                  "Approve leagues, assign league admins, and view all leagues.",
                )}
              </p>
            </div>
            <Link
              href="/admin/platform/basketball-leagues"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 18px",
                background: "#0f172a",
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {t("打开平台管理 →", "Open Platform Management →")}
            </Link>
          </section>
        )}

        {/* ── Managed leagues ── */}
        <section>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: 16,
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.2px",
              }}
            >
              {t("我可以管理的联赛", "Leagues I Manage")}
            </h2>
            {leagues.length > 0 && (
              <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 600 }}>
                {leagues.length}
              </span>
            )}
          </div>

          {leaguesLoading ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: "40px 24px",
                textAlign: "center",
                color: "#94a3b8",
                fontSize: 14,
              }}
            >
              {t("加载中…", "Loading leagues…")}
            </div>
          ) : leagues.length === 0 ? (
            <div
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 16,
                padding: "48px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 15,
                  fontWeight: 700,
                  color: "#0f172a",
                }}
              >
                {t(
                  "你目前还没有可以管理的联赛。",
                  "No managed leagues yet.",
                )}
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: "#64748b",
                  lineHeight: 1.6,
                  maxWidth: 480,
                  marginLeft: "auto",
                  marginRight: "auto",
                }}
              >
                {t(
                  "当你被添加为联赛管理员或球队经理后，相关联赛会显示在这里。",
                  "Once you are added as a league admin or team manager, your leagues will appear here.",
                )}
              </p>
            </div>
          ) : (
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "grid",
                gap: 16,
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              }}
            >
              {leagues.map((league) => {
                const shortId = league.id.slice(0, 8);
                const displayName =
                  league.name?.trim() ||
                  league.slug?.trim() ||
                  `League ${shortId}`;
                const isLeagueAdmin = roles.leagueAdminOf.includes(league.id);
                const roleLabel = isLeagueAdmin
                  ? t("联赛管理员", "League Admin")
                  : t("球队经理", "Team Manager");
                return (
                  <li
                    key={league.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 16,
                      padding: "18px 18px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                      transition: "border-color 0.15s, transform 0.15s",
                    }}
                  >
                    <div
                      style={{ display: "flex", gap: 12, alignItems: "center" }}
                    >
                      <LogoBlock
                        logoUrl={league.logo_url}
                        fallback={displayName}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: 15,
                            fontWeight: 800,
                            color: "#0f172a",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={displayName}
                        >
                          {displayName}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#94a3b8",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={league.slug ?? league.id}
                        >
                          {league.slug ? `/${league.slug}` : `#${shortId}`}
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        alignItems: "center",
                      }}
                    >
                      {league.status && (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 999,
                            fontSize: 11,
                            fontWeight: 700,
                            background: "#eff6ff",
                            color: "#1e40af",
                          }}
                        >
                          {leagueStatusLabel(league.status, lang)}
                        </span>
                      )}
                      <span
                        style={{
                          padding: "3px 10px",
                          borderRadius: 999,
                          fontSize: 11,
                          fontWeight: 700,
                          background: isLeagueAdmin ? "#fef3c7" : "#f1f5f9",
                          color: isLeagueAdmin ? "#92400e" : "#475569",
                        }}
                      >
                        {roleLabel}
                      </span>
                    </div>

                    {league.description && (
                      <p
                        style={{
                          margin: 0,
                          fontSize: 13,
                          color: "#64748b",
                          lineHeight: 1.55,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {league.description}
                      </p>
                    )}

                    <div style={{ marginTop: "auto", paddingTop: 4 }}>
                      <Link
                        href={`/league-admin/${league.id}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "8px 16px",
                          background: "#1e3a8a",
                          color: "#fff",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          textDecoration: "none",
                        }}
                      >
                        {t("打开联赛管理 →", "Open Management →")}
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function LogoBlock({
  logoUrl,
  fallback,
}: {
  logoUrl: string | null;
  fallback: string;
}) {
  const initial = fallback.trim().charAt(0).toUpperCase() || "?";
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt=""
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          objectFit: "cover",
          flexShrink: 0,
          background: "#f1f5f9",
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        background: "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 18,
        fontWeight: 800,
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
