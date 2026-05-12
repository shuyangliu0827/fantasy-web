"use client";

// Shared loader for /contest/[leagueSlug]/* pages.
// Resolves the League (by slug) and today's Contest (if any).
// Page components then fetch their own page-specific extras
// (pool/lineup for build, leaderboard entries for leaderboard).

import { useCallback, useEffect, useState } from "react";
import { basketballJson } from "@/lib/basketball/client";
import type { Contest, League } from "./types";

export type LeagueContestState = {
  loading: boolean;
  league: League | null;
  contest: Contest | null;
  /**
   * Reason the contest is unavailable, when known:
   *   - "league_not_found"    : league slug doesn't exist
   *   - "league_not_enabled"  : league exists but isn't approved + public + contest-enabled
   *   - "no_contest_today"    : league is enabled but has no contest today
   */
  unavailable: "league_not_found" | "league_not_enabled" | "no_contest_today" | null;
};

export function useLeagueContest(leagueSlug: string): LeagueContestState {
  const [state, setState] = useState<LeagueContestState>({
    loading: true,
    league: null,
    contest: null,
    unavailable: null,
  });

  const load = useCallback(async () => {
    const lRes = await basketballJson<{ league: League }>(
      `/api/basketball-leagues/by-slug/${leagueSlug}`,
    );
    if (lRes.status === 404 || !lRes.data) {
      setState({ loading: false, league: null, contest: null, unavailable: "league_not_found" });
      return;
    }
    const league = lRes.data.league;

    if (
      league.status !== "approved" ||
      league.visibility !== "public" ||
      !league.is_contest_enabled
    ) {
      setState({ loading: false, league, contest: null, unavailable: "league_not_enabled" });
      return;
    }

    const cRes = await basketballJson<{ contest: Contest }>(
      `/api/basketball-contests/today?leagueSlug=${encodeURIComponent(leagueSlug)}`,
    );
    if (cRes.status === 404 || !cRes.data) {
      setState({ loading: false, league, contest: null, unavailable: "no_contest_today" });
      return;
    }

    setState({ loading: false, league, contest: cRes.data.contest, unavailable: null });
  }, [leagueSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}
