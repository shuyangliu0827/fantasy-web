export const dynamic = "force-dynamic";
// app/api/contests/[id]/players/route.ts
//
// GET /api/contests/[id]/players
//
// Returns the player pool for the contest. Public — no auth required.
//
// ── Player identity ───────────────────────────────────────────
// contest_players.player_id is TEXT = String(bdl_integer_id), matching
// player_day_stats.player_id exactly.  Display metadata (name, team,
// position, fpts_avg, injury) comes from player_stats_cache, joined by
// casting: player_stats_cache.player_id = contest_players.player_id::integer
//
// ── Pool size ─────────────────────────────────────────────────
// MVP pool is capped at the top 80 players by rank (4 tiers),
// excluding 'Out' injuries.  Populated at contest creation time.
// This route simply reads what is stored — no dynamic filtering.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "contest_id": "b1c2d3e4-...",
//   "status": "open",
//   "players": [
//     {
//       "player_id": "666",
//       "tier": 1,                      // display/filter only — no longer enforced
//       "fpts_scored": null,
//       "name": "Nikola Jokic",
//       "team": "DEN",
//       "position": "C",
//       "fpts_avg": 62.4,
//       "salary": 12000,                // $3000-$12000, snapped to $100
//       "projected_points": 50.2,       // 0.6*last5 + 0.4*season
//       "last_5_avg_fp": 55.4,
//       "season_avg_fp": 62.4,
//       "value": 4.18,                  // projected_points / salary * 1000
//       "injury": null,
//       "injury_status": null,
//       "is_available": true
//     },
//     ...
//   ]
// }
//
// ── Sample response 404 ──────────────────────────────────────
// { "error": "contest_not_found" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCanonicalPlayerPosition } from "@/lib/player-metadata";
import { calcFantasyPoints } from "@/lib/scoring-config";
import { calcValue } from "@/lib/contest-salary";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  // Verify contest exists
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });
  if (!contest)   return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  // Fetch pool rows. Salary-related fields come from migration 025; tier
  // is retained as a display/filter aid (no longer enforced).
  const { data: pool, error: poolErr } = await supabase
    .from("contest_players")
    .select("player_id, tier, fpts_scored, salary, projected_points, last_5_avg_fp, season_avg_fp, injury_status, is_available")
    .eq("contest_id", id)
    .order("salary", { ascending: false });

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if (!pool || pool.length === 0) {
    return NextResponse.json({ contest_id: id, status: contest.status, players: [] });
  }

  // Enrich with display metadata from player_stats_cache.
  // contest_players.player_id is TEXT ("123"); player_stats_cache.player_id is INTEGER.
  // Cast TEXT → integer for the IN query.
  const intIds = pool.map((r) => parseInt(r.player_id, 10)).filter(Number.isFinite);

  // Select all 11 per-game average columns so fpts_avg is computed at
  // read time via calcFantasyPoints — identical to how nba-stats/route.ts
  // produces its fpts_avg, ensuring consistent values across pages.
  const { data: statsRows, error: statsErr } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, team, position, pts_avg, fgm_avg, fga_avg, fg3m_avg, ftm_avg, fta_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg, injury")
    .in("player_id", intIds);

  if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 });

  // Build lookup: integer id → display row
  const statsMap = new Map<number, typeof statsRows[0]>();
  for (const row of statsRows ?? []) statsMap.set(row.player_id, row);

  const players = pool.map((cp) => {
    const intId = parseInt(cp.player_id, 10);
    const meta  = statsMap.get(intId);
    const projected = Number(cp.projected_points) || 0;
    const salary    = Number(cp.salary) || 0;
    return {
      player_id:        cp.player_id,           // TEXT — consistent with rest of contest system
      tier:             cp.tier,
      fpts_scored:      cp.fpts_scored ?? null, // null until scoring job runs
      name:             meta?.name     ?? "",
      team:             meta?.team     ?? "",
      position:         getCanonicalPlayerPosition(meta?.name ?? "", meta?.position ?? "N/A"),
      // Compute fpts_avg from the 11 avg stat fields, matching the nba-stats
      // read path exactly (same calcFantasyPoints call, same ESPN_DEFAULT_WEIGHTS).
      fpts_avg: meta ? Math.round(calcFantasyPoints({
        pts:  meta.pts_avg  || 0,
        fgm:  meta.fgm_avg  || 0,
        fga:  meta.fga_avg  || 0,
        fg3m: meta.fg3m_avg || 0,
        ftm:  meta.ftm_avg  || 0,
        fta:  meta.fta_avg  || 0,
        reb:  meta.reb_avg  || 0,
        ast:  meta.ast_avg  || 0,
        stl:  meta.stl_avg  || 0,
        blk:  meta.blk_avg  || 0,
        tov:  meta.tov_avg  || 0,
      }) * 10) / 10 : 0,
      injury:           meta?.injury ?? null,
      // Salary-cap fields populated by migration 025 + contest-pool-builder.
      salary,
      projected_points: projected,
      last_5_avg_fp:    Number(cp.last_5_avg_fp) || 0,
      season_avg_fp:    Number(cp.season_avg_fp) || 0,
      value:            Math.round(calcValue(projected, salary) * 100) / 100,
      injury_status:    cp.injury_status ?? null,
      is_available:     cp.is_available !== false,
    };
  });

  return NextResponse.json({ contest_id: id, status: contest.status, players });
}
