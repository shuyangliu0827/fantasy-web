export const dynamic = "force-dynamic";
// app/api/contests/[id]/snapshot-debug/route.ts
//
// GET /api/contests/[id]/snapshot-debug
//
// Operator diagnostic: shows, per contest player, whether the daily read path
// is serving the frozen contest snapshot (contest_players) or a stale/fallback
// source. Use it to confirm a contest displays real names/teams/tiers and to
// spot rows that still need a backfill / force-rebuild.
//
// Public read (no secrets exposed) — every field is already visible on the
// build / leaderboard pages; this just lines the sources up side by side.
//
// Sample row:
// {
//   "contest_id": "...", "date": "2026-05-23", "player_id": "115",
//   "display_name": "Nikola Jokic", "snapshot_team": "DEN",
//   "snapshot_position": "C", "snapshot_tier": 1,
//   "stats_cache_team": "DEN", "roster_source": "bdl_players_active",
//   "display_source": "contest_players", "missing_snapshot_fields": []
// }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeTeamCode } from "@/lib/shared/i18n";
import { getContestSnapshot, resolveSnapshotFallback } from "@/lib/fantasy/daily/contest-snapshot";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = db();

  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status")
    .eq("id", id)
    .maybeSingle();
  if (cErr)     return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  const { rows: snapshot, snapshot_available, error: snapErr } = await getContestSnapshot(supabase, id);
  if (snapErr) return NextResponse.json({ error: snapErr }, { status: 500 });

  const playerIds = snapshot.map((p) => p.player_id);

  // stats_cache_team comparison source + fallback resolution.
  const [{ data: pscRows }, fallbackMap] = await Promise.all([
    supabase
      .from("player_stats_cache")
      .select("player_id, team")
      .in("player_id", playerIds.map((p) => parseInt(p, 10)).filter(Number.isFinite)),
    resolveSnapshotFallback(supabase, playerIds),
  ]);
  const statsCacheTeam = new Map<string, string>();
  for (const r of (pscRows as { player_id: string | number; team: string | null }[] | null) ?? []) {
    statsCacheTeam.set(String(r.player_id), normalizeTeamCode(r.team));
  }

  let missingSnapshotRows = 0;
  const players = snapshot.map((p) => {
    const missing: string[] = [];
    if (!p.display_name) missing.push("display_name");
    if (!p.team)         missing.push("team");
    if (!p.position)     missing.push("position");
    if (p.tier == null)  missing.push("tier");
    if (missing.length > 0) missingSnapshotRows++;

    const fb = fallbackMap.get(p.player_id);
    // What the read path actually shows for each display field.
    const display_source =
      p.display_name && p.team && p.position ? "contest_players"
        : fb?.resolved ? `fallback_${fb.team_source}`
        : "player_id";

    return {
      contest_id:        id,
      date:              contest.date,
      player_id:         p.player_id,
      display_name:      p.display_name || fb?.name || p.player_id,
      snapshot_team:     p.team || null,
      snapshot_position: p.position || null,
      snapshot_tier:     p.tier,
      stats_cache_team:  statsCacheTeam.get(p.player_id) ?? null,
      fallback_team:     fb?.team || null,
      roster_source:     p.roster_source,
      display_source,
      missing_snapshot_fields: missing,
    };
  });

  return NextResponse.json(
    {
      contest_id:           id,
      date:                 contest.date,
      status:               contest.status,
      snapshot_available,
      contest_players:      snapshot.length,
      missing_snapshot_rows: missingSnapshotRows,
      players,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
