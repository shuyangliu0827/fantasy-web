import { computeCanonicalWeeklyResult, type CanonicalResolvedMatchup } from "./canonical-weekly-result.ts";
import { generateMatchupsForWeek } from "./fantasy-matchups.ts";
import type { DateStatsMap, PlayerGameStats } from "./fantasy-scoring.ts";
import type { League, LeagueMember, RosterPlayer } from "./store.ts";
import { getOfficialLeagueStartDate, getScoringWeekRange, getWeekStatus } from "./week-utils.ts";
import { supabase } from "./supabase.ts";

type CachedPlayerStats = {
  id: number;
  name: string;
};

type TeamSnapshot = {
  id: string;
  user_id: string;
  name?: string;
  wins?: number;
  losses?: number;
  roster_data: RosterPlayer[] | null;
  lineup_data: Record<string, Record<string, string>> | null;
};

export interface CanonicalWeekSnapshot {
  week: number;
  weekRange: ReturnType<typeof getScoringWeekRange>;
  weekStatus: ReturnType<typeof getWeekStatus>;
  teamIdByUserId: Record<string, string>;
  results: Array<CanonicalResolvedMatchup & {
    matchupIndex: number;
    homeMember: LeagueMember;
    awayMember: LeagueMember;
  }>;
}

async function fetchPlayerStatsIndex(): Promise<Map<string, CachedPlayerStats>> {
  const response = await fetch("/api/nba-stats", { cache: "no-store" });
  const payload = await response.json();
  const map = new Map<string, CachedPlayerStats>();
  if (payload.status === "success" && Array.isArray(payload.players)) {
    for (const player of payload.players) {
      map.set(String(player.id), { id: player.id, name: player.name });
    }
  }
  return map;
}

async function fetchDateStats(dateStr: string): Promise<DateStatsMap> {
  const response = await fetch(`/api/nba-game-stats?date=${dateStr}`, { cache: "no-store" });
  const payload = await response.json();
  return payload.status === "success" ? (payload.stats as DateStatsMap) : {};
}

async function fetchTeamSnapshots(leagueId: string): Promise<TeamSnapshot[]> {
  const { data } = await supabase
    .from("fantasy_teams")
    .select("id, user_id, name, wins, losses, roster_data, lineup_data")
    .eq("league_id", leagueId);
  return (data || []) as TeamSnapshot[];
}

function createStatsResolver(
  weekDayStats: Record<string, DateStatsMap>,
  playerStatsCache: Map<string, CachedPlayerStats>,
) {
  return (player: RosterPlayer, dateStr: string): PlayerGameStats | null => {
    const dayMap = weekDayStats[dateStr];
    if (!dayMap) return null;
    if (dayMap[player.id]) return dayMap[player.id];

    for (const cached of playerStatsCache.values()) {
      if (cached.name === player.name && dayMap[String(cached.id)]) {
        return dayMap[String(cached.id)];
      }
    }

    return null;
  };
}

export async function loadCanonicalWeekSnapshot(
  league: League,
  members: LeagueMember[],
  week: number,
): Promise<CanonicalWeekSnapshot> {
  const leagueStart = getOfficialLeagueStartDate(league.draft_completed_at ?? null);
  const weekRange = getScoringWeekRange(week, leagueStart);
  const weekStatus = getWeekStatus(week, leagueStart);
  if (!weekRange) {
    return { week, weekRange, weekStatus, teamIdByUserId: {}, results: [] };
  }

  const [teams, playerStatsCache, weekDayStatsEntries] = await Promise.all([
    fetchTeamSnapshots(league.id),
    fetchPlayerStatsIndex(),
    Promise.all(weekRange.dateStrings.map(async (dateStr) => [dateStr, await fetchDateStats(dateStr)] as const)),
  ]);

  const teamIdByUserId = Object.fromEntries(teams.map((team) => [team.user_id, team.id]));
  const teamByUserId = new Map(teams.map((team) => [team.user_id, team]));
  const weekDayStats = Object.fromEntries(weekDayStatsEntries);
  const resolvePlayerStats = createStatsResolver(weekDayStats, playerStatsCache);

  const results = generateMatchupsForWeek(members, league.id, week).map((matchup) => {
    const homeTeam = teamByUserId.get(matchup.home.user_id);
    const awayTeam = teamByUserId.get(matchup.away.user_id);

    const canonical = computeCanonicalWeeklyResult({
      homeTeamId: homeTeam?.id || matchup.home.user_id,
      awayTeamId: awayTeam?.id || matchup.away.user_id,
      homeRoster: homeTeam?.roster_data || [],
      awayRoster: awayTeam?.roster_data || [],
      homeDailyLineups: homeTeam?.lineup_data || {},
      awayDailyLineups: awayTeam?.lineup_data || {},
      dateStrings: weekRange.dateStrings,
      resolvePlayerStats,
      weekStatus,
    });

    return {
      matchupKey: `${week}-${matchup.id}`,
      week,
      matchupIndex: matchup.id,
      homeMember: matchup.home,
      awayMember: matchup.away,
      homeTeamId: homeTeam?.id || matchup.home.user_id,
      awayTeamId: awayTeam?.id || matchup.away.user_id,
      ...canonical,
    };
  });

  return {
    week,
    weekRange,
    weekStatus,
    teamIdByUserId,
    results,
  };
}

export async function loadCanonicalSeasonSnapshots(
  league: League,
  members: LeagueMember[],
  weeks: number[],
): Promise<CanonicalWeekSnapshot[]> {
  const snapshots = await Promise.all(
    weeks.map((week) => loadCanonicalWeekSnapshot(league, members, week)),
  );
  return snapshots.sort((a, b) => a.week - b.week);
}
