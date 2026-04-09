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
// Reads player_stats_cache, sorted by fpts_avg DESC.
// Excludes players whose injury starts with "Out".
// Takes the top 80 survivors, split into four tiers of 20.
//
// ── lineup_lock_at logic ──────────────────────────────────────
// Fetches today's games from BDL, parses the earliest "H:MM pm ET"-style
// status string into UTC.  Falls back to 23:00 UTC (7 PM ET) if BDL is
// unavailable or no scheduled games are found.
//
// ── Trigger options ───────────────────────────────────────────
// Manual:  GET /api/contests/create-today?secret=<CRON_SECRET>
// Cron:    Vercel calls this at 14:00 UTC (10 AM ET) every day via vercel.json
//
// ── Sample response — already exists ─────────────────────────
// { "created": false, "contest": { "id": "...", "date": "2026-04-09", ... } }
//
// ── Sample response — freshly created ────────────────────────
// { "created": true,  "contest": { ... }, "pool_size": 78, "lineup_lock_at_source": "bdl" }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   422 { "error": "player pool is empty — run /api/nba-stats first" }
//   500 { "error": "<db error message>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/balldontlie";

// ── Config ────────────────────────────────────────────────────

const POOL_SIZE     = 80;
const TIER_SIZE     = 20; // 20 players per tier

// Fallback lock time: 23:00 UTC = 7 PM ET (EDT, UTC-4).
// Covers the typical NBA prime-time slate during April–June.
const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";

// ── Helpers ───────────────────────────────────────────────────

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // no secret configured → locked down

  const auth = req.headers.get("Authorization");
  if (auth === `Bearer ${secret}`) return true;

  const url = new URL(req.url);
  if (url.searchParams.get("secret") === secret) return true;

  return false;
}

/** Returns tier 1–4 for a 1-based rank within the pool. */
function tierFor(rank: number): 1 | 2 | 3 | 4 {
  if (rank <= TIER_SIZE)     return 1;
  if (rank <= TIER_SIZE * 2) return 2;
  if (rank <= TIER_SIZE * 3) return 3;
  return 4;
}

/**
 * Parses a BDL game status like "7:30 pm ET" into a UTC ISO string.
 *
 * NBA games in April–June use Eastern Daylight Time (EDT = UTC-4).
 * Returns null if the status doesn't match the expected format.
 */
function parseEtStatusToUtc(status: string, dateStr: string): string | null {
  const m = status.trim().match(/^(\d{1,2}):(\d{2})\s+(am|pm)\s+ET$/i);
  if (!m) return null;

  let hour = parseInt(m[1], 10);
  const min  = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();

  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;

  // EDT = UTC-4. Adding 4 hours may roll into the next calendar day.
  const utcHour   = hour + 4;
  const dayOffset = utcHour >= 24 ? 1 : 0;
  const finalHour = utcHour % 24;

  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  base.setUTCHours(finalHour, min, 0, 0);
  return base.toISOString();
}

/**
 * Fetches today's games from BDL and returns the ISO timestamp of the
 * earliest scheduled tip-off.  Returns null if BDL is unavailable or no
 * scheduled games are found.
 */
async function getFirstTipoffUtc(dateStr: string): Promise<string | null> {
  try {
    const { data: games } = await getGames({ dates: [dateStr] });
    if (!games || games.length === 0) return null;

    const candidates: string[] = [];
    for (const g of games) {
      const parsed = parseEtStatusToUtc(g.status ?? "", dateStr);
      if (parsed) candidates.push(parsed);
    }

    if (candidates.length === 0) return null;
    candidates.sort();
    return candidates[0]; // earliest tip-off
  } catch {
    return null; // BDL unavailable — caller falls back to default
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
  if (existing) {
    return NextResponse.json({ created: false, contest: existing });
  }

  // ── 2. Determine lineup_lock_at ──────────────────────────────
  const firstTipoff = await getFirstTipoffUtc(today);
  const lineupLockAt      = firstTipoff ?? `${today}${FALLBACK_LOCK_SUFFIX}`;
  const lineupLockAtSource = firstTipoff ? "bdl" : "fallback";

  // ── 3. Build player pool from player_stats_cache ─────────────
  // Fetch more rows than needed to survive Out-injury exclusions.
  const { data: cacheRows, error: cacheErr } = await supabase
    .from("player_stats_cache")
    .select("player_id, fpts_avg, injury")
    .order("fpts_avg", { ascending: false })
    .limit(POOL_SIZE + 50); // headroom for excluded players

  if (cacheErr) return NextResponse.json({ error: cacheErr.message }, { status: 500 });

  // Filter out "Out*" in JS so NULL injuries are correctly retained.
  // PostgREST NOT ILIKE excludes NULLs; JS filter does not.
  const poolRows = (cacheRows ?? [])
    .filter((r) => !r.injury?.toLowerCase().startsWith("out"))
    .slice(0, POOL_SIZE);

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
    tier:       tierFor(i + 1),
  }));

  const { error: cpErr } = await supabase
    .from("contest_players")
    .insert(contestPlayers);

  if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 });

  return NextResponse.json({
    created:              true,
    contest,
    pool_size:            contestPlayers.length,
    lineup_lock_at_source: lineupLockAtSource,
  });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
