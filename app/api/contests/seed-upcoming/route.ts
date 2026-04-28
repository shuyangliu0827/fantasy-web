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
//   - Skip if a contest row already exists for that date.
//   - Call BDL to get scheduled games. Skip if none.
//   - Insert a contest row with status="pending" and a fallback lock time.
//   - Build a provisional contest_players pool from player_stats_cache:
//       same logic as create-today (playing teams → non-injured players →
//       sort by fpts_avg → quartile tiers).
//
// On game-day morning, /api/contests/create-today upgrades the pending row:
//   status → "open", lineup_lock_at → real BDL tip-off, pool → rebuilt fresh.
// That rebuild replaces the provisional pool with the authoritative one.
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
//   "seeded": 2, "backfilled": 1, "skipped": 1,
//   "results": [
//     { "date": "2026-04-19", "action": "created",    "pool_size": 68 },
//     { "date": "2026-04-20", "action": "exists"                      },
//     { "date": "2026-04-21", "action": "backfilled", "pool_size": 54 },
//     { "date": "2026-04-22", "action": "no_games"                    }
//   ]
// }
// "created"    — new contest stub + pool inserted.
// "backfilled" — contest existed but had 0 contest_players; pool added.
// "exists"     — contest existed and already had a pool; skipped.
// "no_games"   — BDL returned no games for this date; skipped.
//
// Error responses:
//   401 { "error": "unauthorized" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/balldontlie";
import { normalizeTeamCode } from "@/lib/i18n";
import { buildContestPool } from "@/lib/contest-pool-builder";

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
  let seeded  = 0;
  let noGames = 0;

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

    // If it exists, check whether it already has a player pool.
    if (existing) {
      const { count } = await supabase
        .from("contest_players")
        .select("id", { count: "exact", head: true })
        .eq("contest_id", existing.id);

      if ((count ?? 0) > 0) {
        // Pool already present — nothing to do.
        results.push({ date: dateStr, action: "exists" });
        continue;
      }
      // Pool is empty (seeded before provisional pool was added) — fall
      // through to BDL + pool-building using the existing contest id.
    }

    // 2. Fetch BDL games for this date to collect playing teams.
    //    Same normalisation as create-today so team codes match player_stats_cache.
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
      results.push({ date: dateStr, action: "no_games" });
      noGames++;
      continue;
    }

    // 3. Create the contest stub only if one doesn't already exist.
    let contestId: string;
    let action: string;
    if (existing) {
      // Backfill path: use the existing (empty-pool) contest.
      contestId = existing.id;
      action    = "backfilled";
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
    //    Computes last-5 fpts averages → projected_points → salary + tier.
    const poolRows = (await buildContestPool(supabase, dateStr, playingTeams)) ?? [];
    if (poolRows.length > 0) {
      const { error: cpErr } = await supabase
        .from("contest_players")
        .insert(poolRows.map((row) => ({ ...row, contest_id: contestId })));

      // Surface the insert failure in the per-date result so a missing
      // migration / schema mismatch doesn't silently leave an empty pool.
      if (cpErr) {
        results.push({ date: dateStr, action: `error: ${cpErr.message}`, id: contestId });
        continue;
      }
    }

    results.push({ date: dateStr, action, id: contestId, pool_size: poolRows.length });
    seeded++;
  }

  const backfilled = results.filter((r) => r.action === "backfilled").length;
  return NextResponse.json({ seeded, backfilled, skipped: noGames, results });
}
