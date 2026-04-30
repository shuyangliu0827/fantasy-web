export const dynamic = "force-dynamic";
// app/api/nba-games/route.ts
//
// ═══════════════════════════════════════════════════════════════
// REFRESH OWNERSHIP MODEL
// ═══════════════════════════════════════════════════════════════
// ROLE: schedule reader — always reads from BDL (no DB cache layer)
//
// Schedule data (game dates, opponents, status) changes frequently and
// is not persisted to Supabase. This route uses an in-memory TTL cache
// (10 minutes) to avoid redundant BDL calls within the same instance.
// Every cache miss goes directly to BDL (schedule_lookup).
// ═══════════════════════════════════════════════════════════════
// Fetches NBA games for a date range from Ball Don't Lie API.
// Returns games indexed by team abbreviation and date for quick roster lookups.

import { NextRequest, NextResponse } from "next/server";
import { fetchGamesForRange } from "@/lib/nba-games";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");

  if (!startDate || !endDate) {
    return NextResponse.json(
      { status: "error", message: "start_date and end_date are required" },
      { status: 400 }
    );
  }

  try {
    const games = await fetchGamesForRange(startDate, endDate);
    return NextResponse.json({ status: "success", games });
  } catch (err) {
    console.error("[nba-games] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch games" },
      { status: 500 }
    );
  }
}
