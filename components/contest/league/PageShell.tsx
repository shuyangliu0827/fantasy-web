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
import LeagueLogo from "@/components/basketball/LeagueLogo";
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 20,
              flexWrap: "wrap",
            }}
          >
            <LeagueLogo name={league.name} logoUrl={league.logo_url} size={56} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: 4,
                }}
              >
                {t("社区联赛 · 每日竞赛", "Community League · Daily Contest")}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <h1
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#0f172a",
                    letterSpacing: "-0.025em",
                    margin: 0,
                    lineHeight: 1.15,
                  }}
                >
                  {league.name}
                </h1>
                <LeagueVisibilityBadge visibility={league.visibility} />
              </div>
            </div>
            <Link
              href={`/basketball-leagues/${league.slug}`}
              style={{
                fontSize: 13,
                color: "#1e3a8a",
                fontWeight: 800,
                textDecoration: "none",
                padding: "8px 14px",
                borderRadius: 999,
                border: "1px solid rgba(30, 58, 138, 0.15)",
                background: "rgba(239, 246, 255, 0.6)",
                whiteSpace: "nowrap",
              }}
            >
              {t("查看联赛详情 →", "View league →")}
            </Link>
          </div>
        )}
        {children}
      </main>
    </>
  );
}
