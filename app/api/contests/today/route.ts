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
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const supabase = db();

  const { data: initialData, error } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();
  let data = initialData;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reliability fallback: if cron hasn't created today's contest yet, trigger
  // create-today once server-side (same env, authenticated by CRON_SECRET).
  if (!data) {
    const secret = process.env.CRON_SECRET;
    if (!secret) return NextResponse.json({ error: "no_contest_today" }, { status: 404 });

    try {
      const url = new URL(req.url);
      const createUrl = `${url.origin}/api/contests/create-today?secret=${encodeURIComponent(secret)}`;
      const cr = await fetch(createUrl, { cache: "no-store" });
      const payload = await cr.json();
      if (payload?.contest) data = payload.contest;
      if (!data && payload?.reason === "no_games_today") {
        return NextResponse.json({ error: "no_contest_today" }, { status: 404 });
      }
    } catch {
      // ignore and fall through to no_contest_today
    }
  }

  if (!data) return NextResponse.json({ error: "no_contest_today" }, { status: 404 });

  // Soft lifecycle transition: open -> locked when deadline passes.
  // Full scoring/ranking is handled by /api/contests/sync-lifecycle cron.
  if (data.status === "open" && new Date() >= new Date(data.lineup_lock_at)) {
    const { data: updated, error: updErr } = await supabase
      .from("contests")
      .update({ status: "locked" })
      .eq("id", data.id)
      .select("id, date, status, lineup_lock_at")
      .single();
    if (!updErr && updated) data = updated;
  }

  return NextResponse.json(data);
}
