export const dynamic = "force-dynamic";
// GET /api/basketball-contests/[id]/leaderboard
// Daily board for one contest. Public. Ordered by rank ASC then submission time.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();

  const { data: contest } = await supabase
    .from("basketball_contests")
    .select("id, status, date, basketball_league_id")
    .eq("id", id)
    .maybeSingle();
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  const { data: lineups, error } = await supabase
    .from("basketball_user_lineups")
    .select("id, user_id, status, total_fpts, rank, submitted_at")
    .eq("contest_id", id)
    .in("status", ["submitted", "scored"])
    .order("rank", { ascending: true, nullsFirst: false })
    .order("submitted_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    contest_id: contest.id,
    status: contest.status,
    date: contest.date,
    entries: lineups ?? [],
  });
}
