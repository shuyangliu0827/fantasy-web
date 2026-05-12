export const dynamic = "force-dynamic";
// GET /api/basketball-contests/[id]
//
// Read-only metadata for a single authorized-league contest. Lets the
// build / leaderboard pages preserve context across navigation
// (?id=<contestId>) without re-running today/by-date resolution.
//
// Public — anyone can read. Lineup mutations have their own auth.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();

  const { data: contest, error } = await supabase
    .from("basketball_contests")
    .select("id, basketball_league_id, date, status, lineup_lock_at, salary_cap, lineup_size")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  return NextResponse.json({ contest });
}
