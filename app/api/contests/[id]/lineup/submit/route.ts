export const dynamic = "force-dynamic";
// app/api/contests/[id]/lineup/submit/route.ts
//
// POST /api/contests/[id]/lineup/submit
//
// Enters the authenticated user's lineup into the contest.
// After submission, the lineup remains editable (via POST /lineup) until
// lineup_lock_at.  At that point the scoring job sets status → "locked".
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Request body: {} (empty — user is inferred from auth token)
//
// Validation:
//   - Contest must be "open" and current time < lineup_lock_at
//   - User must have a saved lineup (draft or submitted)
//   - Lineup must have exactly 5 players
//   - Lineup must not already be "locked" or "scored"
//
// Sample response 200:
// {
//   "lineup_id":    "a1b2...",
//   "status":       "submitted",
//   "submitted_at": "2026-04-08T22:15:30Z"
// }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   400 { "error": "incomplete_lineup" }       — fewer than 5 players saved
//   404 { "error": "contest_not_found" }
//   404 { "error": "lineup_not_found" }        — must save a lineup first
//   409 { "error": "contest_locked" }          — past deadline
//   409 { "error": "lineup_locked" }           — already locked/scored

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = db();

  // ── Guard: contest must be open and before lock ───────────
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("status, lineup_lock_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr)     return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  if (
    contest.status === "locked" ||
    contest.status === "scored" ||
    new Date() >= new Date(contest.lineup_lock_at)
  ) {
    return NextResponse.json({ error: "contest_locked" }, { status: 409 });
  }

  // ── Fetch user's lineup ───────────────────────────────────
  const { data: lineup, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, status")
    .eq("contest_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (lErr)    return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (!lineup) return NextResponse.json({ error: "lineup_not_found" }, { status: 404 });

  if (lineup.status === "locked" || lineup.status === "scored") {
    return NextResponse.json({ error: "lineup_locked" }, { status: 409 });
  }

  // ── Guard: lineup must have exactly 5 players ─────────────
  const { count, error: countErr } = await supabase
    .from("user_lineup_players")
    .select("id", { count: "exact", head: true })
    .eq("lineup_id", lineup.id);

  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) !== 5) {
    return NextResponse.json({ error: "incomplete_lineup" }, { status: 400 });
  }

  // ── Mark submitted ────────────────────────────────────────
  const submittedAt = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("user_lineups")
    .update({ status: "submitted", submitted_at: submittedAt })
    .eq("id", lineup.id);

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({
    lineup_id:    lineup.id,
    status:       "submitted",
    submitted_at: submittedAt,
  });
}
