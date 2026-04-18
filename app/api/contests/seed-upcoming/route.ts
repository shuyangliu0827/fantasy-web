export const dynamic = "force-dynamic";
// app/api/contests/seed-upcoming/route.ts
//
// GET /api/contests/seed-upcoming
//
// Idempotent. Seeds pending contest stubs for the next N days so they
// appear in /api/contests/nearby's Upcoming bucket before game-day morning.
//
// For each day in [today+1 … today+days]:
//   - Skip if a contest row already exists for that date.
//   - Call BDL to check for scheduled games. Skip if none.
//   - Insert a contest row with status="pending" and a fallback lock time.
//
// Player pools are NOT populated here — /api/contests/create-today handles
// that on game-day morning and now recognises pending stubs, upgrading them
// to status="open" with a real player pool and accurate lock time.
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
//   "seeded": 2,
//   "skipped": 2,
//   "results": [
//     { "date": "2026-04-19", "action": "created" },
//     { "date": "2026-04-20", "action": "exists"  },
//     { "date": "2026-04-21", "action": "created" },
//     { "date": "2026-04-22", "action": "no_games" }
//   ]
// }
//
// Error responses:
//   401 { "error": "unauthorized" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/balldontlie";

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

  const results: { date: string; action: string; id?: string }[] = [];
  let seeded = 0;
  let noGames = 0;

  for (let i = 1; i <= days; i++) {
    const d = new Date(todayUtc);
    d.setUTCDate(todayUtc.getUTCDate() + i);
    const dateStr = d.toISOString().slice(0, 10);

    // 1. Idempotency: skip if any contest row already exists for this date.
    const { data: existing } = await supabase
      .from("contests")
      .select("id")
      .eq("date", dateStr)
      .maybeSingle();

    if (existing) {
      results.push({ date: dateStr, action: "exists" });
      continue;
    }

    // 2. Only create contests on days BDL confirms games are scheduled.
    let hasGames = false;
    try {
      const { data: games } = await getGames({ dates: [dateStr] });
      hasGames = Array.isArray(games) && games.length > 0;
    } catch {
      // BDL unavailable for this date — treat as no games, skip.
    }

    if (!hasGames) {
      results.push({ date: dateStr, action: "no_games" });
      noGames++;
      continue;
    }

    // 3. Insert a pending stub. lock time is a placeholder; create-today
    //    will replace it with the real BDL tip-off time on game morning.
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

    results.push({ date: dateStr, action: "created", id: created.id });
    seeded++;
  }

  return NextResponse.json({ seeded, skipped: noGames, results });
}
