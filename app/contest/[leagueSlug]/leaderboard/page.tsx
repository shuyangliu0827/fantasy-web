"use client";

// /contest/[leagueSlug]/leaderboard?id=<contestId>
//
// If ?id= is present, loads that specific contest by id so the daily
// board stays tied to the slate the user came from.
// Otherwise falls back to today's contest via the same resolver used
// by the build page (timezone-aware), preserving Session 2 semantics.

import { Suspense, use, useEffect, useState } from "react";
import { redirect, useSearchParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueContestPageShell from "@/components/contest/league/PageShell";
import LeaderboardView from "@/components/contest/league/LeaderboardView";
import { ContestStatusHeader } from "@/components/contest/league/Builder";
import UnavailableNotice from "@/components/contest/league/UnavailableNotice";
import { useLeagueContest } from "@/components/contest/league/useLeagueContest";
import type { Contest, LeaderEntry, League } from "@/components/contest/league/types";
import { basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

export default function LeagueContestLeaderboardPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);
  if (leagueSlug === "nba") {
    redirect("/contest/nba/leaderboard");
  }
  return (
    <Suspense fallback={null}>
      <Inner leagueSlug={leagueSlug} />
    </Suspense>
  );
}

function Inner({ leagueSlug }: { leagueSlug: string }) {
  const sp = useSearchParams();
  const contestIdParam = sp.get("id");
  if (contestIdParam) {
    return <ByIdInner leagueSlug={leagueSlug} contestId={contestIdParam} />;
  }
  return <ByTodayInner leagueSlug={leagueSlug} />;
}

// ── Variant 1: explicit contest id from query string ─────────────────

function ByIdInner({
  leagueSlug,
  contestId,
}: {
  leagueSlug: string;
  contestId: string;
}) {
  const { t } = useLang();
  const [league, setLeague] = useState<League | null>(null);
  const [contest, setContest] = useState<Contest | null>(null);
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [leagueRes, contestRes] = await Promise.all([
        basketballJson<{ league: League }>(
          `/api/basketball-leagues/by-slug/${leagueSlug}`,
        ),
        basketballJson<{ contest: Contest }>(
          `/api/basketball-contests/${contestId}`,
        ),
      ]);
      if (cancelled) return;
      if (!leagueRes.data || !contestRes.data) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setLeague(leagueRes.data.league);
      setContest(contestRes.data.contest);

      const boardRes = await basketballJson<{ entries: LeaderEntry[] }>(
        `/api/basketball-contests/${contestId}/leaderboard`,
      );
      if (cancelled) return;
      setEntries(boardRes.data?.entries ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueSlug, contestId]);

  if (loading) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={contestId} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }
  if (notFound || !league || !contest) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该比赛。", "Contest not found.")}
        </main>
      </>
    );
  }

  return (
    <LeagueContestPageShell
      leagueSlug={leagueSlug}
      league={league}
      contestId={contest.id}
    >
      <ContestStatusHeader contest={contest} />
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.01em",
          margin: "8px 0 12px",
        }}
      >
        {t("每日榜", "Daily Board")}
      </h2>
      <LeaderboardView entries={entries} />
    </LeagueContestPageShell>
  );
}

// ── Variant 2: no id; fall back to today via the existing resolver ──

function ByTodayInner({ leagueSlug }: { leagueSlug: string }) {
  const { t } = useLang();
  const { loading, league, contest, unavailable, date, timezone } =
    useLeagueContest(leagueSlug);
  const [entries, setEntries] = useState<LeaderEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);

  useEffect(() => {
    if (!contest) {
      setEntriesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setEntriesLoading(true);
      const res = await basketballJson<{ entries: LeaderEntry[] }>(
        `/api/basketball-contests/${contest.id}/leaderboard`,
      );
      if (cancelled) return;
      setEntries(res.data?.entries ?? []);
      setEntriesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [contest]);

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
        <UnavailableNotice
          kind={unavailable ?? "no_contest_today"}
          date={date}
          timezone={timezone}
        />
      ) : (
        <>
          <ContestStatusHeader contest={contest} />
          <h2
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.01em",
              margin: "8px 0 12px",
            }}
          >
            {t("每日榜", "Daily Board")}
          </h2>
          {entriesLoading ? (
            <div style={{ color: "#94a3b8", fontSize: 14 }}>
              {t("加载中…", "Loading…")}
            </div>
          ) : (
            <LeaderboardView entries={entries} />
          )}
        </>
      )}
    </LeagueContestPageShell>
  );
}
