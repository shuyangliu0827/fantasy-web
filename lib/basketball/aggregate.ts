// lib/basketball/aggregate.ts
//
// Server-side: rebuilds the basketball_player_game_stats row for a given
// (game_id, player_id) by replaying every event row. Recomputes
// fantasy_points via calcFantasyPoints from
// lib/fantasy/shared/scoring-config.ts — the single source of truth for
// scoring across NBA and custom basketball.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calcFantasyPoints,
  ESPN_DEFAULT_WEIGHTS,
} from "@/lib/fantasy/shared/scoring-config";
import { totalsFromEvents, StatEventType } from "./events";

type GameRef = { id: string; basketball_league_id: string };

export async function recomputeBoxScore(
  supabase: SupabaseClient,
  game: GameRef,
  playerId: string,
): Promise<{ stats: Record<string, unknown> | null; error: string | null }> {
  const { data: events, error: evErr } = await supabase
    .from("basketball_stat_events")
    .select("event_type, team_id")
    .eq("game_id", game.id)
    .eq("player_id", playerId);
  if (evErr) return { stats: null, error: evErr.message };

  const totals = totalsFromEvents(
    (events ?? []).map((e) => ({ event_type: e.event_type as StatEventType })),
  );

  // team_id: derive from the player's current team (events may omit it).
  // Fall back to the most-recent event's team_id, else null.
  let teamId: string | null = null;
  if (events && events.length > 0) {
    const last = events[events.length - 1] as { team_id: string | null };
    teamId = last.team_id ?? null;
  }
  if (!teamId) {
    const { data: player } = await supabase
      .from("basketball_players")
      .select("team_id")
      .eq("id", playerId)
      .maybeSingle();
    teamId = player?.team_id ?? null;
  }

  const fantasy_points = calcFantasyPoints(totals, ESPN_DEFAULT_WEIGHTS);
  const now = new Date().toISOString();

  // If there are no events, remove any stale aggregate row so the UI shows 0/null.
  if ((events ?? []).length === 0) {
    await supabase
      .from("basketball_player_game_stats")
      .delete()
      .eq("game_id", game.id)
      .eq("player_id", playerId);
    return { stats: null, error: null };
  }

  const { data, error } = await supabase
    .from("basketball_player_game_stats")
    .upsert(
      {
        basketball_league_id: game.basketball_league_id,
        game_id: game.id,
        player_id: playerId,
        team_id: teamId,
        min: 0,
        ...totals,
        fantasy_points,
        updated_at: now,
      },
      { onConflict: "game_id,player_id" },
    )
    .select()
    .single();
  if (error) return { stats: null, error: error.message };
  return { stats: data, error: null };
}
