export const dynamic = "force-dynamic";
// app/api/contests/create-today/route.ts
//
// GET /api/contests/create-today
//
// Daily contest bootstrap. Safe to call multiple times (idempotent by default).
// If a contest already exists for today (UTC), returns it unchanged
// UNLESS ?force=true is passed, which rebuilds the player pool in-place
// without deleting user lineups.
//
// ── Authorization ─────────────────────────────────────────────
// Requires CRON_SECRET env var.  Accepted as:
//   Authorization: Bearer <CRON_SECRET>   ← Vercel Cron sends this automatically
//   ?secret=<CRON_SECRET>                 ← manual testing via browser/curl
//
// ── Player pool logic ─────────────────────────────────────────
// 1. Fetch today's BDL games → collect playing team abbreviations.
// 2. Query player_stats_cache filtered to ONLY those teams.
// 3. Exclude players whose injury starts with "Out".
// 4. No cap — include ALL non-injured players with a game today.
// 5. Sort by fpts_avg DESC, assign tiers by quartile (T1=top 25%, T2=next 25%,
//    T3=next 25%, T4=bottom 25%).
//
// ── Force-rebuild ─────────────────────────────────────────────
// ?force=true  Deletes contest_players for today's contest and rebuilds
//              the pool from scratch. The contest header and user lineups
//              are preserved. Use this whenever the pool needs to be
//              rebuilt (e.g. after the old capped pool was created with
//              stale code).
// Example: GET /api/contests/create-today?secret=X&force=true
//
// ── lineup_lock_at logic ──────────────────────────────────────
// Parses the earliest "H:MM pm ET"-style game status string.
// Falls back to 23:00 UTC (7 PM ET) if BDL is unavailable.
//
// ── Trigger options ───────────────────────────────────────────
// Manual:  GET /api/contests/create-today?secret=<CRON_SECRET>
// Rebuild: GET /api/contests/create-today?secret=<CRON_SECRET>&force=true
// Cron:    Vercel calls this at 14:00 UTC (10 AM ET) daily via vercel.json
//
// ── Sample response — already exists ─────────────────────────
// { "created": false, "contest": { "id": "...", "date": "2026-04-09", ... } }
//
// ── Sample response — freshly created ────────────────────────
// { "created": true, "contest": {...}, "pool_size": 74, "lock_source": "bdl",
//   "playing_teams": 14 }
//
// ── Sample response — force-rebuilt ──────────────────────────
// { "rebuilt": true, "contest": {...}, "pool_size": 74, "playing_teams": 14,
//   "lock_source": "bdl" }
//
// ── Sample response — no games today ─────────────────────────
// { "created": false, "reason": "no_games_today" }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   422 { "error": "player pool is empty — run /api/nba-stats first" }
//   500 { "error": "<db error message>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/nba/balldontlie";
import { normalizeTeamCode } from "@/lib/shared/i18n";
import { buildContestPool } from "@/lib/fantasy/daily/pool-builder";
import { getCurrentRosterForTeams } from "@/lib/nba/current-roster";

// Fallback lock: 23:00 UTC = 7 PM EDT (UTC-4), typical prime-time slate.
const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";

// per_player_trace is large (1 row per player considered) — only include
// when ?debug=1 is set to keep the normal response compact.
function stripTrace<T extends { per_player_trace?: unknown }>(diagnostics: T, debug: boolean): T {
  if (debug) return diagnostics;
  const { per_player_trace, ...rest } = diagnostics;
  void per_player_trace;
  return rest as T;
}

// ── Helpers ───────────────────────────────────────────────────

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

/**
 * Parses a BDL game status like "7:30 pm ET" into a UTC ISO string.
 * NBA games April–June use EDT (UTC-4).
 */
function parseEtStatusToUtc(status: string, dateStr: string): string | null {
  const m = status.trim().match(/^(\d{1,2}):(\d{2})\s+(am|pm)\s+ET$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min  = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  const utcHour   = hour + 4;
  const dayOffset = utcHour >= 24 ? 1 : 0;
  const finalHour = utcHour % 24;
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  base.setUTCHours(finalHour, min, 0, 0);
  return base.toISOString();
}

interface TodaySlate {
  lineupLockAt: string;
  lockSource:   "bdl" | "fallback";
  playingTeams: Set<string>; // normalized team abbreviations (same as player_stats_cache.team)
}

/**
 * Fetches today's BDL games.
 * Returns playing team abbreviations (normalized via normalizeTeamCode, matching
 * how player_stats_cache.team is written by nba-stats/route.ts) and the
 * earliest tip-off time as a UTC ISO string.
 * playingTeams is empty if BDL is unavailable or no games are scheduled.
 */
async function getTodaySlate(dateStr: string): Promise<TodaySlate> {
  try {
    const { data: games } = await getGames({ dates: [dateStr] });
    if (!games || games.length === 0) {
      return { lineupLockAt: `${dateStr}${FALLBACK_LOCK_SUFFIX}`, lockSource: "fallback", playingTeams: new Set() };
    }

    // Both player_stats_cache.team (written by nba-stats) and these game team
    // abbreviations come from BDL via normalizeTeamCode — so the filter is
    // self-consistent regardless of what abbreviation BDL uses.
    const playingTeams = new Set<string>();
    for (const g of games) {
      if (g.home_team?.abbreviation)    playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
      if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
    }

    // Earliest tip-off from BDL status strings ("7:30 pm ET")
    const candidates: string[] = [];
    for (const g of games) {
      const t = parseEtStatusToUtc(g.status ?? "", dateStr);
      if (t) candidates.push(t);
    }
    candidates.sort();

    return {
      lineupLockAt: candidates[0] ?? `${dateStr}${FALLBACK_LOCK_SUFFIX}`,
      lockSource:   candidates.length > 0 ? "bdl" : "fallback",
      playingTeams,
    };
  } catch {
    return { lineupLockAt: `${dateStr}${FALLBACK_LOCK_SUFFIX}`, lockSource: "fallback", playingTeams: new Set() };
  }
}

// ── Handler ───────────────────────────────────────────────────

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url    = new URL(req.url);
  const force  = url.searchParams.get("force") === "true";
  const debug  = url.searchParams.get("debug") === "1";
  const supabase = db();
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // ── 1. Idempotency check ─────────────────────────────────────
  const { data: existing, error: checkErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });

  if (existing && !force && existing.status !== "pending") {
    // Normal idempotent path — fully-created contest already exists.
    return NextResponse.json({ created: false, contest: existing });
  }
  // A "pending" stub (seeded by /api/contests/seed-upcoming) falls through
  // so its player pool can be populated and status upgraded to "open".

  // ── 2. Fetch today's slate from BDL ──────────────────────────
  const { lineupLockAt, lockSource, playingTeams } = await getTodaySlate(today);

  if (playingTeams.size === 0) {
    return NextResponse.json({ created: false, reason: "no_games_today" });
  }

  // ── 3. Resolve authoritative current rosters for today's teams ──
  // This is the hard validation gate: a player is eligible only when they
  // appear on the BDL /players/active roster for one of today's teams.
  // player_stats_cache.team is NEVER consulted for eligibility.
  const rosterResult = await getCurrentRosterForTeams(supabase, playingTeams);

  if (rosterResult.roster_source_used === "unavailable") {
    // No roster source available and the sync failed — fail loudly.
    return NextResponse.json(
      {
        error:        "Current roster validation failed; contest pool not rebuilt.",
        contest_date: today,
        roster_source_used: rosterResult.roster_source_used,
        sync_error:   rosterResult.sync_error,
      },
      { status: 503 },
    );
  }

  // ── 4. Build a fully-priced pool via the shared builder ──────
  const { rows: poolRows, diagnostics } = await buildContestPool(supabase, today, playingTeams, {
    currentRosterMap: rosterResult.map,
    rosterMeta: {
      roster_source_used: rosterResult.roster_source_used,
      source_updated_at:  rosterResult.source_updated_at,
      sync_attempted:     rosterResult.sync_attempted,
      sync_error:         rosterResult.sync_error,
      rows_by_team:       rosterResult.rows_by_team,
    },
  });

  if (diagnostics.cache_query_error) {
    return NextResponse.json(
      { error: "failed to read player_stats_cache", details: diagnostics.cache_query_error, diagnostics: stripTrace(diagnostics, debug) },
      { status: 500 },
    );
  }
  if (poolRows.length === 0) {
    return NextResponse.json(
      {
        error:       "player pool is empty — no eligible players for today's slate",
        contest_date: today,
        diagnostics: stripTrace(diagnostics, debug),
      },
      { status: 422 },
    );
  }

  // Defensive minimum: a daily lineup is 5 players; warn (but don't fail)
  // when fewer than 10 are eligible so an operator can spot the issue.
  const MIN_POOL = 10;
  const warning  = poolRows.length < MIN_POOL
    ? `only ${poolRows.length} eligible players — below the recommended minimum of ${MIN_POOL}`
    : null;

  const baseResponse = {
    contest_date:                          today,
    games_found:                           playingTeams.size,
    teams_playing_today:                   [...playingTeams].sort(),
    roster_source_used:                    diagnostics.roster_source_used,
    roster_players_loaded_total:           diagnostics.roster_players_loaded_total,
    roster_players_loaded_by_team:         diagnostics.roster_players_loaded_by_team,
    cache_players_loaded:                  diagnostics.cache_players_loaded,
    included_players_count:                diagnostics.included_players_count,
    excluded_stale_team_count:             diagnostics.excluded_stale_team_count,
    excluded_no_current_roster_count:      diagnostics.excluded_no_current_roster_count,
    excluded_team_not_playing_count:       diagnostics.excluded_team_not_playing_count,
    excluded_out_or_inactive_count:        diagnostics.excluded_out_or_inactive_count,
    excluded_missing_projection_count:     diagnostics.excluded_missing_projection_count,
    contest_players_inserted:              poolRows.length,
    lock_source:                           lockSource,
    diagnostics:                           stripTrace(diagnostics, debug),
    warning,
  };

  // ── Force-rebuild path ────────────────────────────────────────
  // Drop existing contest_players and replace them. The contest header
  // and any user lineups are preserved (they reference contest.id which
  // stays the same).
  if (existing && (force || existing.status === "pending")) {
    const { error: delErr } = await supabase
      .from("contest_players")
      .delete()
      .eq("contest_id", existing.id);

    if (delErr) return NextResponse.json({ error: delErr.message, diagnostics }, { status: 500 });

    const { error: insErr } = await supabase
      .from("contest_players")
      .insert(poolRows.map((row) => ({ ...row, contest_id: existing.id })));

    if (insErr) return NextResponse.json({ error: insErr.message, diagnostics }, { status: 500 });

    // Update lineup_lock_at with the real BDL tip-off time.
    // Also flip status to "open" when upgrading a seed-upcoming pending stub.
    const headerUpdate: Record<string, string> = { lineup_lock_at: lineupLockAt };
    if (existing.status === "pending") headerUpdate.status = "open";
    await supabase
      .from("contests")
      .update(headerUpdate)
      .eq("id", existing.id);

    console.log("[create-today] rebuilt", {
      contest_id: existing.id,
      ...baseResponse,
    });

    return NextResponse.json({
      ...baseResponse,
      rebuilt:       true,
      contest:       { ...existing, lineup_lock_at: lineupLockAt },
      pool_size:     poolRows.length,
      playing_teams: playingTeams.size,
    });
  }

  // ── Fresh creation path ───────────────────────────────────────
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .insert({ date: today, status: "open", lineup_lock_at: lineupLockAt })
    .select("id, date, status, lineup_lock_at")
    .single();

  if (contestErr) return NextResponse.json({ error: contestErr.message, diagnostics }, { status: 500 });

  const { error: cpErr } = await supabase
    .from("contest_players")
    .insert(poolRows.map((row) => ({ ...row, contest_id: contest.id })));

  if (cpErr) return NextResponse.json({ error: cpErr.message, diagnostics }, { status: 500 });

  console.log("[create-today] created", {
    contest_id: contest.id,
    ...baseResponse,
  });

  return NextResponse.json({
    ...baseResponse,
    created:       true,
    contest,
    pool_size:     poolRows.length,
    playing_teams: playingTeams.size,
  });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
