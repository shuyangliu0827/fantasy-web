import type { DailyLineupMap, LineupMap, RosterPlayer } from "./store.ts";
import { formatDateStr, parseDateStr } from "./week-utils.ts";

export type RosterHistoryRecord = {
  id?: string;
  league_id: string;
  team_id: string;
  player_id: string;
  player_payload: RosterPlayer;
  effective_start_at: string;
  effective_end_at: string | null;
  acquisition_type?: string | null;
};

export function dedupeRosterPlayers(roster: RosterPlayer[]): RosterPlayer[] {
  const byId = new Map<string, RosterPlayer>();
  for (const player of roster) {
    if (!player?.id) continue;
    const existing = byId.get(player.id);
    if (!existing || (player.acquiredAt ?? 0) >= (existing.acquiredAt ?? 0)) {
      byId.set(player.id, player);
    }
  }
  return [...byId.values()];
}

export function getRosterHistoryStateAtTimestamp(records: RosterHistoryRecord[], timestamp: string | Date): RosterPlayer[] {
  const at = timestamp instanceof Date ? timestamp.getTime() : new Date(timestamp).getTime();
  return dedupeRosterPlayers(
    records
      .filter((record) => {
        const start = new Date(record.effective_start_at).getTime();
        const end = record.effective_end_at ? new Date(record.effective_end_at).getTime() : Number.POSITIVE_INFINITY;
        return start <= at && at < end;
      })
      .sort((a, b) => a.player_payload.name.localeCompare(b.player_payload.name))
      .map((record) => record.player_payload),
  );
}

export function getRosterHistoryStateForDate(records: RosterHistoryRecord[], dateStr: string): RosterPlayer[] {
  return getRosterHistoryStateAtTimestamp(records, `${dateStr}T23:59:59.999Z`);
}

export function buildWeekRosterStates(records: RosterHistoryRecord[], dateStrings: string[]): Record<string, RosterPlayer[]> {
  return Object.fromEntries(dateStrings.map((dateStr) => [dateStr, getRosterHistoryStateForDate(records, dateStr)]));
}

export function mergeRosterStatesByDate(rostersByDate: Record<string, RosterPlayer[]>): RosterPlayer[] {
  const merged = new Map<string, RosterPlayer>();
  for (const dateStr of Object.keys(rostersByDate).sort()) {
    for (const player of rostersByDate[dateStr] || []) merged.set(player.id, player);
  }
  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getLineupSlotState(lineup: LineupMap | undefined, roster: RosterPlayer[]) {
  const rosterMap = new Map(roster.map((player) => [player.id, player]));
  const assignedIds = new Set<string>();
  const starters: Array<{ slot: string; player: RosterPlayer }> = [];
  const bench: Array<{ slot: string; player: RosterPlayer }> = [];
  const reserve: RosterPlayer[] = [];

  for (const [slot, playerId] of Object.entries(lineup || {})) {
    const player = playerId ? rosterMap.get(playerId) : undefined;
    if (!player) continue;
    assignedIds.add(player.id);
    if (["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"].includes(slot)) starters.push({ slot, player });
    else bench.push({ slot, player });
  }

  for (const player of roster) if (!assignedIds.has(player.id)) reserve.push(player);
  return { starters, bench, reserve };
}

export function pruneFutureLineupsAfterRemoval(
  dailyLineups: DailyLineupMap,
  removedPlayerIds: string[],
  effectiveDate: string = formatDateStr(new Date()),
): DailyLineupMap {
  if (removedPlayerIds.length === 0) return dailyLineups;
  const next = structuredClone(dailyLineups);
  for (const [dateStr, lineup] of Object.entries(next)) {
    if (dateStr < effectiveDate) continue;
    for (const [slot, playerId] of Object.entries(lineup)) {
      if (removedPlayerIds.includes(playerId)) delete lineup[slot];
    }
  }
  return next;
}

export function getHistoricalRosterForDate(history: RosterHistoryRecord[], fallbackRoster: RosterPlayer[], dateStr: string): RosterPlayer[] {
  if (history.length === 0) return dedupeRosterPlayers(fallbackRoster);
  return getRosterHistoryStateForDate(history, dateStr);
}

export function getEffectiveTimestampForDateView(dateStr: string): string {
  return parseDateStr(dateStr).toISOString();
}
