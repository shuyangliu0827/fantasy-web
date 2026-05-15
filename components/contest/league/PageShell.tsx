"use client";

// Shared chrome for every /contest/[leagueSlug]/* page:
// LightHeader, scope-aware ContestNav, league name + visibility row.
//
// The page component supplies the loaded League (or loading/error sentinels)
// and the contest body as children. Keeps page files small and consistent.

import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import { useLang } from "@/lib/lang";
import type { League } from "./types";

type Props = {
  leagueSlug: string;
  league: League | null;
  contestId?: string | null;
  children: React.ReactNode;
};

export default function LeagueContestPageShell({
  leagueSlug,
  league,
  contestId,
  children,
}: Props) {
  const { t } = useLang();
  return (
    <>
      <LightHeader activeHref="/contest" />
      <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={contestId ?? null} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
        {league && (
          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 4,
              }}
            >
              <h1
                style={{
                  fontSize: 26,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {t(`${league.name} 每日竞赛`, `${league.name} Daily Contest`)}
              </h1>
              <LeagueVisibilityBadge visibility={league.visibility} />
              <Link
                href={`/basketball-leagues/${league.slug}`}
                style={{
                  fontSize: 13,
                  color: "#1e3a8a",
                  fontWeight: 800,
                  textDecoration: "none",
                }}
              >
                {t("查看联赛详情 →", "View League Details →")}
              </Link>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", fontWeight: 600 }}>
              {t(
                `社区联赛 · ${league.name}`,
                `Community League · ${league.name}`,
              )}
            </div>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
