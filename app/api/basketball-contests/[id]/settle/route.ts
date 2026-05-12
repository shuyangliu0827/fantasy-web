export const dynamic = "force-dynamic";
// POST /api/basketball-contests/[id]/settle
// League admin / platform admin can close a contest, computing every
// submitted lineup's total from basketball_player_game_stats.fantasy_points
// and assigning ranks.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";
import { settleContest } from "@/lib/basketball/contest-settler";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);

    const { data: contest } = await supabase
      .from("basketball_contests")
      .select("basketball_league_id")
      .eq("id", id)
      .maybeSingle();
    if (!contest) throw new AccessError("contest_not_found", 404);
    await requireLeagueAdmin(supabase, contest.basketball_league_id, userId);

    const result = await settleContest(supabase, id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
