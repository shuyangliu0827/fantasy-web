import { supabase } from "./supabase.ts";
import type { RosterPlayer } from "./store.ts";
import {
  dedupeRosterPlayers,
  pruneFutureLineupsAfterRemoval,
  getHistoricalRosterForDate,
  getRosterHistoryStateAtTimestamp,
  getRosterHistoryStateForDate,
  buildWeekRosterStates,
  mergeRosterStatesByDate,
  getLineupSlotState,
  getEffectiveTimestampForDateView,
  type RosterHistoryRecord,
} from "./fantasy-roster-history-core.ts";

export {
  dedupeRosterPlayers,
  pruneFutureLineupsAfterRemoval,
  getHistoricalRosterForDate,
  getRosterHistoryStateAtTimestamp,
  getRosterHistoryStateForDate,
  buildWeekRosterStates,
  mergeRosterStatesByDate,
  getLineupSlotState,
  getEffectiveTimestampForDateView,
};
export type { RosterHistoryRecord };

export async function fetchRosterHistoryFromDB(leagueId: string, teamId: string): Promise<RosterHistoryRecord[]> {
  const { data, error } = await supabase
    .from("roster_history")
    .select("id, league_id, team_id, player_id, player_payload, effective_start_at, effective_end_at, acquisition_type")
    .eq("league_id", leagueId)
    .eq("team_id", teamId)
    .order("effective_start_at", { ascending: true });

  if (error || !Array.isArray(data)) return [];
  return data as RosterHistoryRecord[];
}

export async function syncRosterHistoryWithCurrentRoster(
  leagueId: string,
  teamId: string,
  roster: RosterPlayer[],
  effectiveAt: string = new Date().toISOString(),
): Promise<void> {
  const normalizedRoster = dedupeRosterPlayers(roster);
  const { data, error } = await supabase
    .from("roster_history")
    .select("id, league_id, team_id, player_id, player_payload, effective_start_at, effective_end_at, acquisition_type")
    .eq("league_id", leagueId)
    .eq("team_id", teamId)
    .is("effective_end_at", null);

  if (error) return;

  const activeRecords = (data || []) as RosterHistoryRecord[];
  const activeIds = new Set(activeRecords.map((record) => record.player_id));
  const nextIds = new Set(normalizedRoster.map((player) => player.id));

  await Promise.all(
    activeRecords
      .filter((record) => !nextIds.has(record.player_id))
      .map((record) => supabase.from("roster_history").update({ effective_end_at: effectiveAt }).eq("id", record.id!)),
  );

  const opens = normalizedRoster
    .filter((player) => !activeIds.has(player.id))
    .map((player) => ({
      league_id: leagueId,
      team_id: teamId,
      player_id: player.id,
      player_payload: player,
      effective_start_at: effectiveAt,
      effective_end_at: null,
      acquisition_type: player.acquiredVia || null,
    }));

  if (opens.length > 0) await supabase.from("roster_history").insert(opens);
}
