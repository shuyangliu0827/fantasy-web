export const dynamic = "force-dynamic";
// app/api/contests/nearby/route.ts
//
// GET /api/contests/nearby
//
// Returns contests in a ±14-day window around today (UTC). Public — no auth required.
// Used by the contest page to populate Past / Present / Upcoming buckets without
// hitting the dead-end 404 that /api/contests/today produces on no-game days.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "contests": [
//     { "id": "a1b2...", "date": "2026-04-10", "status": "scored",  "lineup_lock_at": "..." },
//     { "id": "b2c3...", "date": "2026-04-18", "status": "open",    "lineup_lock_at": "..." },
//     { "id": "c3d4...", "date": "2026-04-20", "status": "pending", "lineup_lock_at": "..." }
//   ]
// }
//
// Returns { "contests": [] } when no contests exist in the window — never 404.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET() {
  const today = new Date();

  const past = new Date(today);
  past.setDate(today.getDate() - 14);

  const future = new Date(today);
  future.setDate(today.getDate() + 14);

  const { data, error } = await db()
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .gte("date", past.toISOString().slice(0, 10))
    .lte("date", future.toISOString().slice(0, 10))
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contests: data ?? [] });
}
