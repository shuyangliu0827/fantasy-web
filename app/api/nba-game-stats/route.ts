export const dynamic = "force-dynamic";
// app/api/nba-game-stats/route.ts
//
// GET /api/nba-game-stats?date=YYYY-MM-DD
//
// Public endpoint. Core fetching/caching logic lives in lib/player-game-stats.ts
// (shared with app/api/contests/my-lineups/route.ts for Daily Fantasy live scores).

import { NextRequest, NextResponse } from "next/server";
import { fetchStatsForDate } from "@/lib/player-game-stats";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");

  if (!date) {
    return NextResponse.json(
      { status: "error", message: "date parameter is required (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  try {
    const stats = await fetchStatsForDate(date);
    return NextResponse.json({ status: "success", stats });
  } catch (err) {
    console.error("[nba-game-stats] Error:", err);
    return NextResponse.json(
      { status: "error", message: "Failed to fetch game stats" },
      { status: 500 },
    );
  }
}
