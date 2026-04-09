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
// 5. Compute fpts via calcFantasyPoints() from avg stat columns, sort DESC,
//    then assign tiers by quartile (T1=top 25%, T2=next 25%,
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
import { getGames } from "@/lib/balldontlie";
import { normalizeTeamCode } from "@/lib/i18n";
import { calcFantasyPoints } from "@/lib/scoring-config";

// Fallback lock: 23:00 UTC = 7 PM EDT (UTC-4), typical prime-time slate.
const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";

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
 * Assigns tier by quartile of the full pool.
 * rank is 1-based; total is the pool size.
 * Quartile boundaries use the exact count / 4 so uneven pools
 * distribute extra players into the next tier.
 */
function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q)     return 1;
  if (rank <= q * 2) return 2;
  if (rank <= q * 3) return 3;
  return 4;
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

/**
 * Build the contest player pool for a given set of playing teams.
 * Returns all non-injured players on those teams, sorted by fpts_avg DESC.
 * No cap — the full same-day slate is the pool.
 */
async function buildPool(supabase: ReturnType<typeof db>, playingTeams: Set<string>) {
  const { data: cacheRows, error } = await supabase
    .from("player_stats_cache")
    .select("player_id, injury, team, pts_avg, fgm_avg, fga_avg, fg3m_avg, ftm_avg, fta_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg")
    .in("team", [...playingTeams]);

  if (error) return { poolRows: null, error };

  // Filter out "Out*" injuries in JS — PostgREST NOT ILIKE drops NULLs.
  // No cap: ALL non-injured players on a playing team enter the pool.
  const poolRows = (cacheRows ?? [])
    .filter((r) => !r.injury?.toLowerCase().startsWith("out"))
    .map((r) => ({
      ...r,
      computed_fpts_avg: calcFantasyPoints({
        pts: r.pts_avg || 0,
        fgm: r.fgm_avg || 0,
        fga: r.fga_avg || 0,
        fg3m: r.fg3m_avg || 0,
        ftm: r.ftm_avg || 0,
        fta: r.fta_avg || 0,
        reb: r.reb_avg || 0,
        ast: r.ast_avg || 0,
        stl: r.stl_avg || 0,
        blk: r.blk_avg || 0,
        tov: r.tov_avg || 0,
      }),
    }))
    .sort((a, b) => b.computed_fpts_avg - a.computed_fpts_avg);

  return { poolRows, error: null };
}

// ── Handler ───────────────────────────────────────────────────

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url    = new URL(req.url);
  const force  = url.searchParams.get("force") === "true";
  const supabase = db();
  const today  = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // ── 1. Idempotency check ─────────────────────────────────────
  const { data: existing, error: checkErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });

  if (existing && !force) {
    // Normal idempotent path — contest already exists, nothing to do.
    return NextResponse.json({ created: false, contest: existing });
  }

  // ── 2. Fetch today's slate from BDL ──────────────────────────
  const { lineupLockAt, lockSource, playingTeams } = await getTodaySlate(today);

  if (playingTeams.size === 0) {
    return NextResponse.json({ created: false, reason: "no_games_today" });
  }

  // ── 3. Build pool: all non-injured players on playing teams ───
  const { poolRows, error: poolErr } = await buildPool(supabase, playingTeams);
  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if (!poolRows || poolRows.length === 0) {
    return NextResponse.json(
      { error: "player pool is empty — run /api/nba-stats first to populate player_stats_cache" },
      { status: 422 },
    );
  }

  const contestPlayers = poolRows.map((row, i) => ({
    player_id: String(row.player_id),
    tier:      tierFor(i + 1, poolRows.length),
  }));

  // ── Force-rebuild path ────────────────────────────────────────
  // Drop existing contest_players and replace them. The contest header
  // and any user lineups are preserved (they reference contest.id which
  // stays the same).
  if (existing && force) {
    const { error: delErr } = await supabase
      .from("contest_players")
      .delete()
      .eq("contest_id", existing.id);

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

    const { error: insErr } = await supabase
      .from("contest_players")
      .insert(contestPlayers.map((cp) => ({ ...cp, contest_id: existing.id })));

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

    // Update lineup_lock_at in case BDL now has accurate tip-off times.
    await supabase
      .from("contests")
      .update({ lineup_lock_at: lineupLockAt })
      .eq("id", existing.id);

    return NextResponse.json({
      rebuilt:       true,
      contest:       { ...existing, lineup_lock_at: lineupLockAt },
      pool_size:     contestPlayers.length,
      playing_teams: playingTeams.size,
      lock_source:   lockSource,
    });
  }

  // ── Fresh creation path ───────────────────────────────────────
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .insert({ date: today, status: "open", lineup_lock_at: lineupLockAt })
    .select("id, date, status, lineup_lock_at")
    .single();

  if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });

  const { error: cpErr } = await supabase
    .from("contest_players")
    .insert(contestPlayers.map((cp) => ({ ...cp, contest_id: contest.id })));

  if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 });

  return NextResponse.json({
    created:       true,
    contest,
    pool_size:     contestPlayers.length,
    playing_teams: playingTeams.size,
    lock_source:   lockSource,
  });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
