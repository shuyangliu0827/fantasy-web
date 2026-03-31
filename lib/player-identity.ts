// lib/player-identity.ts
// Resolves synthetic player names → BallDontLie integer IDs via player_stats_cache.
// Used once at roster hydration time, not per-render.

import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Batch-resolves player names to BDL integer IDs.
 * Returns a map of name → player_id for any names found in player_stats_cache.
 * Names not found in the cache are omitted from the result.
 */
export async function resolveBdlIds(names: string[]): Promise<Map<string, number>> {
  if (names.length === 0) return new Map();
  const supabase = getSupabase();
  const { data } = await supabase
    .from("player_stats_cache")
    .select("name, player_id")
    .in("name", names);

  const result = new Map<string, number>();
  for (const row of data ?? []) {
    result.set(row.name, row.player_id);
  }
  return result;
}
