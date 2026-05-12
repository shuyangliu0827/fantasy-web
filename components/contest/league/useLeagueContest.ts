"use client";

// Shared loader for /contest/[leagueSlug]/* pages.
// Resolves the League (by slug) and today's Contest (if any).
// Page components then fetch their own page-specific extras
// (pool/lineup for build, leaderboard entries for leaderboard).

import { useCallback, useEffect, useState } from "react";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import type { Contest, League } from "./types";

export type UnavailableKind =
  | "league_not_found"
  | "league_not_enabled"
  | "no_contest_today"
  | "no_teams_in_games"
  | "no_players_in_pool";

export type LeagueContestState = {
  loading: boolean;
  league: League | null;
  contest: Contest | null;
  unavailable: UnavailableKind | null;
  /** Local date the resolver looked at — only set for no_contest_today / no_teams_in_games / no_players_in_pool. */
  date: string | null;
  /** League timezone for that same date. */
  timezone: string | null;
};

type TodayBody =
  | { contest: Contest }
  | { error: string; date?: string; timezone?: string };

export function useLeagueContest(leagueSlug: string): LeagueContestState {
  const [state, setState] = useState<LeagueContestState>({
    loading: true,
    league: null,
    contest: null,
    unavailable: null,
    date: null,
    timezone: null,
  });

  const load = useCallback(async () => {
    const lRes = await basketballJson<{ league: League }>(
      `/api/basketball-leagues/by-slug/${leagueSlug}`,
    );
    if (lRes.status === 404 || !lRes.data) {
      setState({
        loading: false, league: null, contest: null,
        unavailable: "league_not_found", date: null, timezone: null,
      });
      return;
    }
    const league = lRes.data.league;

    if (
      league.status !== "approved" ||
      league.visibility !== "public" ||
      !league.is_contest_enabled
    ) {
      setState({
        loading: false, league, contest: null,
        unavailable: "league_not_enabled", date: null, timezone: null,
      });
      return;
    }

    const res = await basketballFetch(
      `/api/basketball-contests/today?leagueSlug=${encodeURIComponent(leagueSlug)}`,
    );
    const body = (await res.json().catch(() => null)) as TodayBody | null;

    if (res.ok && body && "contest" in body) {
      setState({
        loading: false, league, contest: body.contest,
        unavailable: null, date: null, timezone: null,
      });
      return;
    }

    const err = body && "error" in body ? body.error : `http_${res.status}`;
    const date = body && "date" in body ? body.date ?? null : null;
    const timezone = body && "timezone" in body ? body.timezone ?? null : null;
    const kind = mapUnavailable(err);
    setState({
      loading: false, league, contest: null,
      unavailable: kind, date, timezone,
    });
  }, [leagueSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return state;
}

function mapUnavailable(err: string | undefined): UnavailableKind {
  switch (err) {
    case "no_contest_today":    return "no_contest_today";
    case "no_teams_in_games":   return "no_teams_in_games";
    case "no_players_in_pool":  return "no_players_in_pool";
    case "league_not_enabled":  return "league_not_enabled";
    case "league_not_found":    return "league_not_found";
    default:                    return "no_contest_today";
  }
}
