export const dynamic = "force-dynamic";
// app/api/contests/today/route.ts
//
// GET /api/contests/today
//
// Returns the contest for today's date (UTC). Public — no auth required.
// Used by the contest lobby to check if a contest is available,
// what the lock deadline is, and its current status.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "id":             "b1c2d3e4-...",
//   "date":           "2026-04-08",
//   "status":         "open",
//   "lineup_lock_at": "2026-04-08T23:30:00Z"
// }
//
// ── Sample response 404 ──────────────────────────────────────
// { "error": "no_contest_today" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  const { data, error } = await db()
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "no_contest_today" }, { status: 404 });

  return NextResponse.json(data);
}
