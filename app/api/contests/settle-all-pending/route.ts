export const dynamic = "force-dynamic";
// GET /api/contests/settle-all-pending
//
// Finds every contest whose date has passed (< today UTC) and whose status is
// NOT 'scored', then settles each one.  Designed to run as a daily Vercel cron
// at 07:00 UTC (3 AM ET) — safely after all US NBA games have ended.
//
// Idempotent: re-running will re-settle already-scored contests without
// double-awarding (points_transactions UPSERT prevents duplicates).
//
// ── Auth ──────────────────────────────────────────────────────
// Authorization: Bearer <CRON_SECRET>   ← Vercel cron
// Authorization: Bearer <SERVICE_ROLE>  ← admin curl
// ?secret=<CRON_SECRET>                 ← manual browser testing
//
// ── Response 200 ──────────────────────────────────────────────
// {
//   "contests_found":  3,
//   "contests_settled": 3,
//   "total_lineups":   42,
//   "results": [
//     { "contest_id": "...", "contest_date": "2026-04-27", "lineups_scored": 14, ... },
//     ...
//   ]
// }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { settleContest } from "@/lib/fantasy/daily/settler";

function checkAuth(req: Request): boolean {
  const cronSecret  = process.env.CRON_SECRET;
  const svcKey      = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const authHeader  = req.headers.get("Authorization") ?? "";
  const querySecret = new URL(req.url).searchParams.get("secret") ?? "";

  if (cronSecret && (authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret)) return true;
  if (svcKey     && authHeader === `Bearer ${svcKey}`) return true;
  return false;
}

export async function GET(req: Request) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Today's date in UTC (contests dated before today are eligible).
  const today = new Date().toISOString().slice(0, 10);

  // Find all non-scored contests with at least one submitted lineup whose
  // date is strictly before today (games are guaranteed finished).
  const { data: pending, error: pErr } = await supabase
    .from("contests")
    .select("id, date, status")
    .lt("date", today)             // strictly past — today's contest may still be live
    .not("status", "eq", "scored") // re-settle is safe but skip to save time
    .order("date", { ascending: true });

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 });
  }

  if (!pending || pending.length === 0) {
    return NextResponse.json({ contests_found: 0, contests_settled: 0, total_lineups: 0, results: [] });
  }

  console.log("[settle-all-pending] settling", { count: pending.length, dates: (pending as any[]).map((c) => c.date) });

  const results = await Promise.all((pending as any[]).map((c) => settleContest(c.id)));

  const totalLineups = results.reduce((s, r) => s + r.lineups_scored, 0);
  const hasErrors    = results.some((r) => r.errors.length > 0);

  if (hasErrors) {
    const errorSummary = results
      .filter((r) => r.errors.length > 0)
      .map((r) => ({ contest_id: r.contest_id, date: r.contest_date, errors: r.errors }));
    console.error("[settle-all-pending] some contests had errors", errorSummary);
  }

  return NextResponse.json({
    contests_found:   pending.length,
    contests_settled: results.filter((r) => r.errors.length === 0).length,
    total_lineups:    totalLineups,
    results,
  });
}
