export const dynamic = "force-dynamic";
// POST /api/basketball-contests/[id]/lineup/submit
// Promotes the caller's draft to status='submitted' (locked, awaiting score).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const { data: contest, error: cErr } = await supabase
      .from("basketball_contests")
      .select("id, status, lineup_lock_at, lineup_size")
      .eq("id", id)
      .maybeSingle();
    if (cErr) throw new AccessError(cErr.message, 500);
    if (!contest) throw new AccessError("contest_not_found", 404);
    if (
      contest.status === "locked" ||
      contest.status === "scored" ||
      (contest.lineup_lock_at && new Date(contest.lineup_lock_at).getTime() <= Date.now())
    ) {
      throw new AccessError("contest_locked", 409);
    }

    const { data: lineup } = await supabase
      .from("basketball_user_lineups")
      .select("id, status")
      .eq("contest_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!lineup) throw new AccessError("no_lineup_to_submit", 404);
    if (lineup.status === "submitted" || lineup.status === "scored") {
      throw new AccessError("lineup_already_submitted", 409);
    }

    const { data: slots } = await supabase
      .from("basketball_user_lineup_players")
      .select("slot")
      .eq("lineup_id", lineup.id);
    if (!slots || slots.length !== contest.lineup_size) {
      throw new AccessError(`incomplete_lineup:${slots?.length ?? 0}/${contest.lineup_size}`, 400);
    }

    const now = new Date().toISOString();
    const { error: updErr } = await supabase
      .from("basketball_user_lineups")
      .update({ status: "submitted", submitted_at: now, updated_at: now })
      .eq("id", lineup.id);
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

    return NextResponse.json({
      lineup_id: lineup.id,
      status: "submitted",
      submitted_at: now,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
