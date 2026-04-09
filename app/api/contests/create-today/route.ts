export const dynamic = "force-dynamic";
// app/api/contests/create-today/route.ts
//
// GET /api/contests/create-today
//
// Idempotent daily contest bootstrap. Safe to call multiple times.
// If a contest already exists for today (UTC), returns it unchanged.
// If not, creates the contest and populates the player pool.
//
// ── Authorization ─────────────────────────────────────────────
// Requires CRON_SECRET env var.  Accepted as:
//   Authorization: Bearer <CRON_SECRET>   ← Vercel Cron sends this automatically
//   ?secret=<CRON_SECRET>                 ← manual testing via browser/curl
//
// ── Player pool logic ─────────────────────────────────────────
// 1. Fetch today's BDL games → extract playing team abbreviations.
// 2. Filter player_stats_cache to ONLY players on those teams.
// 3. Exclude players whose injury starts with "Out".
// 4. Sort by fpts_avg DESC, take top 80 survivors → four tiers of 20.
//
// Step 1 is the key change from the naive top-80-overall approach:
// players not scheduled to play today are excluded from the pool.
//
// ── lineup_lock_at logic ──────────────────────────────────────
// Parses the earliest "H:MM pm ET"-style game status string.
// Falls back to 23:00 UTC (7 PM ET) if BDL is unavailable.
//
// ── Trigger options ───────────────────────────────────────────
// Manual:  GET /api/contests/create-today?secret=<CRON_SECRET>
// Cron:    Vercel calls this at 14:00 UTC (10 AM ET) daily via vercel.json
//
// ── Tier rules (MVP) ──────────────────────────────────────────
// T1 (Elite):   rank  1-20   max 2 per lineup
// T2 (Solid):   rank 21-40
// T3 (Value):   rank 41-60   ┐ at least 1 from T3 or T4 required
// T4 (Deep Cut): rank 61-80  ┘
//
// ── Sample response — already exists ─────────────────────────
// { "created": false, "contest": { "id": "...", "date": "2026-04-09", ... } }
//
// ── Sample response — freshly created ────────────────────────
// { "created": true, "contest": {...}, "pool_size": 74, "lock_source": "bdl",
//   "playing_teams": 14 }
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

// ── Config ────────────────────────────────────────────────────

// No static pool size cap — include ALL non-injured players with a game today.
// Tiers are assigned by quartile of the full pool (25% each).

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
 * rank is 1-based; total is pool size.
 * Each quartile is 25% of the pool — if pool doesn't divide evenly,
 * extra players fall into the next tier.
 */
function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q)       return 1;
  if (rank <= q * 2)   return 2;
  if (rank <= q * 3)   return 3;
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
  lineupLockAt:  string;
  lockSource:    "bdl" | "fallback";
  playingTeams:  Set<string>; // normalized team abbreviations from TEAM_MAP
}

/**
 * Fetches today's BDL games.
 * Returns playing team abbreviations (normalized) and the earliest tip-off time.
 * playingTeams is empty if BDL is unavailable or no games are scheduled.
 */
async function getTodaySlate(dateStr: string): Promise<TodaySlate> {
  try {
    const { data: games } = await getGames({ dates: [dateStr] });
    if (!games || games.length === 0) {
      return { lineupLockAt: `${dateStr}${FALLBACK_LOCK_SUFFIX}`, lockSource: "fallback", playingTeams: new Set() };
    }

    // Collect playing teams — apply normalizeTeamCode so abbreviations match
    // what player_stats_cache.team stores (also written via normalizeTeamCode).
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

  const supabase = db();
  const today    = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // ── 1. Idempotency check ─────────────────────────────────────
  const { data: existing, error: checkErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();

  if (checkErr) return NextResponse.json({ error: checkErr.message }, { status: 500 });
  if (existing) return NextResponse.json({ created: false, contest: existing });

  // ── 2. Fetch today's slate from BDL ──────────────────────────
  const { lineupLockAt, lockSource, playingTeams } = await getTodaySlate(today);

  // No games scheduled today → no contest.
  if (playingTeams.size === 0) {
    return NextResponse.json({ created: false, reason: "no_games_today" });
  }

  // ── 3. Build player pool: only players with a game today ──────
  // player_stats_cache.team uses the same normalized abbreviations as
  // game.home_team.abbreviation after normalizeTeamCode().
  const { data: cacheRows, error: cacheErr } = await supabase
    .from("player_stats_cache")
    .select("player_id, fpts_avg, injury, team")
    .in("team", [...playingTeams])          // ← game-day filter
    .order("fpts_avg", { ascending: false });

  if (cacheErr) return NextResponse.json({ error: cacheErr.message }, { status: 500 });

  // Filter out "Out*" injuries in JS (PostgREST NOT ILIKE drops NULLs).
  // No cap — include ALL non-injured players with a game today.
  const poolRows = (cacheRows ?? [])
    .filter((r) => !r.injury?.toLowerCase().startsWith("out"));

  if (poolRows.length === 0) {
    return NextResponse.json(
      { error: "player pool is empty — run /api/nba-stats first to populate player_stats_cache" },
      { status: 422 },
    );
  }

  // ── 4. Insert contest header ─────────────────────────────────
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .insert({ date: today, status: "open", lineup_lock_at: lineupLockAt })
    .select("id, date, status, lineup_lock_at")
    .single();

  if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });

  // ── 5. Insert contest_players ────────────────────────────────
  // player_id stored as TEXT = String(bdl_integer_id), matching player_day_stats.
  const contestPlayers = poolRows.map((row, i) => ({
    contest_id: contest.id,
    player_id:  String(row.player_id),
    tier:       tierFor(i + 1, poolRows.length),
  }));

  const { error: cpErr } = await supabase
    .from("contest_players")
    .insert(contestPlayers);

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
