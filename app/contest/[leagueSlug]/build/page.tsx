"use client";

import { use } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueContestPageShell from "@/components/contest/league/PageShell";
import ContestBuilder from "@/components/contest/league/Builder";
import { useLeagueContest } from "@/components/contest/league/useLeagueContest";
import { useLang } from "@/lib/lang";

export default function LeagueContestBuildPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);
  if (leagueSlug === "nba") {
    redirect("/contest/nba/build");
  }
  return <Inner leagueSlug={leagueSlug} />;
}

function Inner({ leagueSlug }: { leagueSlug: string }) {
  const { t } = useLang();
  const { loading, league, contest, unavailable } = useLeagueContest(leagueSlug);

  if (loading) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }
  if (unavailable === "league_not_found" || !league) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该联赛。", "League not found.")}
        </main>
      </>
    );
  }
  if (unavailable === "league_not_enabled") {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{league.name}</div>
          <p>{t("该联赛暂未开放每日竞赛。", "This league is not available for fantasy contest yet.")}</p>
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              background: "#1e3a8a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            {t("查看联赛详情 →", "View League Details →")}
          </Link>
        </main>
      </>
    );
  }

  return (
    <LeagueContestPageShell
      leagueSlug={leagueSlug}
      league={league}
      contestId={contest?.id ?? null}
    >
      {!contest ? (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: "40px 24px",
            textAlign: "center",
            color: "#64748b",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
          <p style={{ margin: 0 }}>
            {t(
              "今日没有比赛。请等待联赛安排下一场比赛后再来。",
              "No games scheduled today. Check back once the league schedules its next game.",
            )}
          </p>
        </div>
      ) : (
        <ContestBuilder contest={contest} />
      )}
    </LeagueContestPageShell>
  );
}
