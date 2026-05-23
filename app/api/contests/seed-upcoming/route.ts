export const dynamic = "force-dynamic";
// app/api/contests/seed-upcoming/route.ts
//
// GET /api/contests/seed-upcoming
//
// Idempotent. Seeds pending contest rows with provisional player pools
// for the next N days so they appear in /api/contests/nearby's Upcoming
// bucket before game-day morning, and already have a browseable pool.
//
// For each day in [today+1 … today+days]:
//   - Skip non-pending (open/locked/scored) contests — those have user lineups.
//   - Call BDL to get currently-scheduled games. Skip if none.
//   - If no games but a pending contest with pool exists (stale if-necessary
//     game was removed from schedule) → clear the stale pool so phantom
//     players don't appear.
//   - Create a "pending" contest stub if one doesn't exist yet.
//   - Always rebuild the provisional pool for pending contests so eliminated
//     playoff teams are evicted from the pool the next day after their series ends.
//
// On game-day morning, /api/contests/create-today upgrades the pending row:
//   status → "open", lineup_lock_at → real BDL tip-off, pool → rebuilt fresh.
// That rebuild is the authoritative one.
//
// ── Authorization ─────────────────────────────────────────────
// Same CRON_SECRET as create-today.
//   Authorization: Bearer <CRON_SECRET>
//   ?secret=<CRON_SECRET>
//
// ── Query params ──────────────────────────────────────────────
//   days   Days ahead to check, default 7, max 14.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "seeded": 2, "refreshed": 1, "skipped": 1,
//   "results": [
//     { "date": "2026-04-19", "action": "created",   "pool_size": 68 },
//     { "date": "2026-04-20", "action": "exists"                     },  ← open/scored
//     { "date": "2026-04-21", "action": "refreshed", "pool_size": 54 },  ← pending, rebuilt
//     { "date": "2026-04-22", "action": "no_games"                   },
//     { "date": "2026-04-23", "action": "cleared_no_games"           }   ← stale pool cleared
//   ]
// }
// "created"          — new contest stub + pool inserted.
// "refreshed"        — pending contest pool rebuilt from fresh BDL data.
// "backfilled"       — pending contest had 0 players; pool added.
// "exists"           — non-pending contest (has user lineups); skipped.
// "no_games"         — BDL returned no games, no contest row.
// "cleared_no_games" — BDL returned no games; stale pending pool cleared.
//
// Error responses:
//   401 { "error": "unauthorized" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/nba/balldontlie";
import { normalizeTeamCode } from "@/lib/shared/i18n";
import { buildContestPool } from "@/lib/fantasy/daily/pool-builder";
import { getCurrentRosterForTeams } from "@/lib/nba/current-roster";

const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";
const DEFAULT_DAYS = 7;
const MAX_DAYS     = 14;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("Authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;
  return false;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url  = new URL(req.url);
  const days = Math.min(
    Math.max(parseInt(url.searchParams.get("days") ?? String(DEFAULT_DAYS), 10), 1),
    MAX_DAYS,
  );

  const supabase = db();
  const todayUtc = new Date();
  todayUtc.setUTCHours(0, 0, 0, 0);

  const results: { date: string; action: string; id?: string; pool_size?: number }[] = [];
  let seeded    = 0;
  let noGames   = 0;

  for (let i = 1; i <= days; i++) {
    const d = new Date(todayUtc);
    d.setUTCDate(todayUtc.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    // 1. Check if a contest row already exists for this date.
    const { data: existing } = await supabase
      .from("contests")
      .select("id, status")
      .eq("date", dateStr)
      .maybeSingle();

    // Non-pending contests (open/locked/scored) may have user lineups.
    // Only create-today (or ?force=true) is allowed to rebuild those.
    if (existing && existing.status !== "pending") {
      results.push({ date: dateStr, action: "exists" });
      continue;
    }

    // 2. Fetch BDL games for this date to collect currently-scheduled teams.
    //    Re-fetching every day for pending contests lets us evict teams whose
    //    playoff series ended since the pool was first seeded.
    const playingTeams = new Set<string>();
    try {
      const { data: games } = await getGames({ dates: [dateStr] });
      if (Array.isArray(games)) {
        for (const g of games) {
          if (g.home_team?.abbreviation)    playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
          if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
        }
      }
    } catch {
      // BDL unavailable — treat as no games, skip this date.
    }

    if (playingTeams.size === 0) {
      if (existing) {
        // Stale pending contest: a once-scheduled game (e.g. playoff if-necessary)
        // has been removed from BDL's schedule. Clear the pool so phantom
        // players from eliminated teams no longer appear to users.
        await supabase.from("contest_players").delete().eq("contest_id", existing.id);
        results.push({ date: dateStr, action: "cleared_no_games", id: existing.id });
      } else {
        results.push({ date: dateStr, action: "no_games" });
      }
      noGames++;
      continue;
    }

    // 3. Create the contest stub only if one doesn't already exist.
    let contestId: string;
    let hadPool   = false;
    let action: string;

    if (existing) {
      // Check whether the pending contest already has a pool.
      const { count } = await supabase
        .from("contest_players")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", existing.id);

      hadPool   = (count ?? 0) > 0;
      contestId = existing.id;

      if (hadPool) {
        // Clear the stale provisional pool before rebuilding with fresh BDL data.
        // Pending contests have no user lineups so this is safe.
        await supabase.from("contest_players").delete().eq("contest_id", existing.id);
        action = "refreshed";
      } else {
        action = "backfilled";
      }
    } else {
      const { data: created, error: insertErr } = await supabase
        .from("contests")
        .insert({
          date:           dateStr,
          status:         "pending",
          lineup_lock_at: `${dateStr}${FALLBACK_LOCK_SUFFIX}`,
        })
        .select("id")
        .single();

      if (insertErr) {
        results.push({ date: dateStr, action: `error: ${insertErr.message}` });
        continue;
      }
      contestId = created.id;
      action    = "created";
    }

    // 4. Build a fully-priced provisional player pool via the shared builder.
    //    Computes last-5 fpts averages → projected_points → salary + tier,
    //    gated by the authoritative current-roster source.
    const rosterResult = await getCurrentRosterForTeams(supabase, playingTeams);
    if (rosterResult.roster_source_used === "unavailable") {
      // Skip this date — better to leave the existing pool than to overwrite
      // it with one that bypassed the current-roster gate.
      results.push({ date: dateStr, action: "roster_source_unavailable", id: contestId });
      continue;
    }

    const { rows: poolRows } = await buildContestPool(supabase, dateStr, playingTeams, {
      currentRosterMap: rosterResult.map,
      rosterMeta: {
        roster_source_used: rosterResult.roster_source_used,
        source_updated_at:  rosterResult.source_updated_at,
        sync_attempted:     rosterResult.sync_attempted,
        sync_error:         rosterResult.sync_error,
        rows_by_team:       rosterResult.rows_by_team,
      },
    });
    if (poolRows.length > 0) {
      const { error: cpErr } = await supabase
        .from("contest_players")
        .insert(poolRows.map((row) => ({ ...row, contest_id: contestId })));

      if (cpErr) {
        results.push({ date: dateStr, action: `error: ${cpErr.message}`, id: contestId });
        continue;
      }
    }

    results.push({ date: dateStr, action, id: contestId, pool_size: poolRows.length });
    seeded++;
  }

  const refreshed  = results.filter((r) => r.action === "refreshed").length;
  const backfilled = results.filter((r) => r.action === "backfilled").length;
  return NextResponse.json({ seeded, refreshed, backfilled, skipped: noGames, results });
}
