export const dynamic = "force-dynamic";
// app/api/admin/sync-current-rosters/route.ts
//
// GET /api/admin/sync-current-rosters?secret=<CRON_SECRET>
//
// Refreshes nba_player_current_team from BDL /players/active. Intended to
// run as a cron job (once or twice daily) so the current-roster source the
// daily-contest pool builder relies on stays fresh after mid-season trades.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "rows_upserted":    540,
//   "rows_deleted":     3,
//   "source":           "bdl_players_active",
//   "fetched_at":       "2026-05-23T14:00:00Z",
//   "bdl_active_count": 540,
//   "error":            null
// }
//
// ── Error responses ─────────────────────────────────────────
// 401 { "error": "unauthorized" }
// 502 { "error": "<BDL error>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncCurrentRosters } from "@/lib/nba/current-roster";

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

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await syncCurrentRosters(db());
  console.log("[sync-current-rosters]", result);

  if (result.error) {
    return NextResponse.json(result, { status: 502 });
  }
  return NextResponse.json(result);
}

export async function GET(req: Request)  { return handler(req); }
export async function POST(req: Request) { return handler(req); }
