export const dynamic = "force-dynamic";
// POST (or GET) /api/contests/[id]/settle
//
// Settlement job for one Daily Fantasy contest.
// Designed to be called by a cron job or manually by an admin.
//
// ── Auth ──────────────────────────────────────────────────────
// Authorization: Bearer <CRON_SECRET>   ← Vercel cron / external scheduler
// Authorization: Bearer <SERVICE_ROLE>  ← admin curl
// ?secret=<CRON_SECRET>                 ← manual browser testing
//
// ── Response 200 ──────────────────────────────────────────────
// {
//   "contest_id":           "b1c2...",
//   "contest_date":         "2026-04-29",
//   "lineups_found":        14,
//   "lineups_scored":       14,
//   "transactions_written": 14,
//   "errors":               []
// }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   404 { "error": "contest_not_found" }
//   409 { "error": "contest_not_yet_locked" }

import { NextResponse } from "next/server";
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

async function handler(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const result  = await settleContest(id);

  if (result.errors.includes("contest_not_found")) {
    return NextResponse.json({ error: "contest_not_found" }, { status: 404 });
  }
  if (result.errors.includes("contest_not_yet_locked")) {
    return NextResponse.json({ error: "contest_not_yet_locked" }, { status: 409 });
  }

  return NextResponse.json(result);
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(req, ctx);
}

// Accept GET for easy browser / curl testing without --request POST
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handler(req, ctx);
}
