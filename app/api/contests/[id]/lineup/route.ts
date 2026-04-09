export const dynamic = "force-dynamic";
// app/api/contests/[id]/lineup/route.ts
//
// ── GET /api/contests/[id]/lineup ────────────────────────────
//
// Returns the authenticated user's current lineup for the contest.
// Creates no data — returns 404 if the user has no lineup yet.
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Sample response 200:
// {
//   "lineup_id":    "a1b2...",
//   "contest_id":  "b1c2...",
//   "user_id":     "c1d2...",
//   "status":      "submitted",
//   "total_fpts":  null,
//   "rank":        null,
//   "submitted_at": "2026-04-08T22:10:00Z",
//   "players": [
//     { "slot": 1, "player_id": "666" },
//     { "slot": 2, "player_id": "434" },
//     { "slot": 3, "player_id": "140" },
//     { "slot": 4, "player_id": "115" },
//     { "slot": 5, "player_id": "237" }
//   ]
// }
//
// ── POST /api/contests/[id]/lineup ───────────────────────────
//
// Saves (or replaces) the authenticated user's lineup as a draft.
// Does NOT lock/submit the lineup — user can still edit after saving.
// Calling this again with different players fully replaces the lineup.
//
// Validation:
//   - Contest must be "open" (status check)
//   - Current time must be before lineup_lock_at
//   - Exactly 5 players required
//   - Slots must be 1–5, each used exactly once
//   - No duplicate player_id in the same lineup
//   - Every player_id must exist in contest_players for this contest
//   - Each player must be position-eligible for their assigned slot:
//       slot 1=PG, 2=SG, 3=SF, 4=PF, 5=C
//       combo positions ("PG/SG") satisfy either slot they contain
//   - Lineup must not already be "locked" or "scored"
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Sample request body:
// {
//   "players": [
//     { "slot": 1, "player_id": "666" },
//     { "slot": 2, "player_id": "434" },
//     { "slot": 3, "player_id": "140" },
//     { "slot": 4, "player_id": "115" },
//     { "slot": 5, "player_id": "237" }
//   ]
// }
//
// Sample response 200:
// { "lineup_id": "a1b2...", "status": "draft" }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   400 { "error": "exactly 5 players required" }
//   400 { "error": "slots must be 1–5, each used exactly once" }
//   400 { "error": "duplicate player in lineup" }
//   400 { "error": "one or more players not in contest pool" }
//   404 { "error": "contest_not_found" }
//   409 { "error": "contest_locked" }
//   409 { "error": "lineup_locked" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";
import { isEligibleForContestSlot, SLOT_LABEL } from "@/lib/contest-positions";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = db();

  const { data: lineup, error } = await supabase
    .from("user_lineups")
    .select("id, contest_id, user_id, status, total_fpts, rank, submitted_at")
    .eq("contest_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (error)   return NextResponse.json({ error: error.message }, { status: 500 });
  if (!lineup) return NextResponse.json({ error: "lineup_not_found" }, { status: 404 });

  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("slot, player_id")
    .eq("lineup_id", lineup.id)
    .order("slot");

  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 });

  return NextResponse.json({
    lineup_id:    lineup.id,
    contest_id:   lineup.contest_id,
    user_id:      lineup.user_id,
    status:       lineup.status,
    total_fpts:   lineup.total_fpts  ?? null,
    rank:         lineup.rank        ?? null,
    submitted_at: lineup.submitted_at ?? null,
    players:      lineupPlayers ?? [],
  });
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { players: { slot: number; player_id: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { players } = body;

  // ── Validate shape ────────────────────────────────────────
  if (!Array.isArray(players) || players.length !== 5) {
    return NextResponse.json({ error: "exactly 5 players required" }, { status: 400 });
  }
  const slots     = players.map((p) => p.slot);
  const playerIds = players.map((p) => p.player_id);
  const validSlots = [1, 2, 3, 4, 5];
  if (!validSlots.every((s) => slots.includes(s)) || new Set(slots).size !== 5) {
    return NextResponse.json({ error: "slots must be 1–5, each used exactly once" }, { status: 400 });
  }
  if (new Set(playerIds).size !== 5) {
    return NextResponse.json({ error: "duplicate player in lineup" }, { status: 400 });
  }

  const supabase = db();

  // ── Guard: contest must be open and before lock time ─────
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

  // ── Guard: every player_id must be in the contest pool ───
  // contest_players.player_id is TEXT; players array already has TEXT ids.
  const { data: poolRows, error: poolErr } = await supabase
    .from("contest_players")
    .select("player_id")
    .eq("contest_id", id)
    .in("player_id", playerIds);

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if ((poolRows?.length ?? 0) !== 5) {
    return NextResponse.json({ error: "one or more players not in contest pool" }, { status: 400 });
  }

  // ── Position-slot eligibility ─────────────────────────────
  // Fetch position strings from player_stats_cache.
  // contest_players.player_id is TEXT = String(bdl_int); cast to integer for this join.
  const intIds = playerIds.map((id) => parseInt(id, 10));
  const { data: posRows, error: posErr } = await supabase
    .from("player_stats_cache")
    .select("player_id, position")
    .in("player_id", intIds);

  if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 });

  // Build TEXT-keyed map so lookup matches contest_players.player_id format.
  const posMap = new Map<string, string>(
    (posRows ?? []).map((r) => [String(r.player_id), r.position ?? "N/A"]),
  );

  for (const pick of players) {
    const position = posMap.get(pick.player_id) ?? "N/A";
    if (!isEligibleForContestSlot(position, pick.slot)) {
      const required = SLOT_LABEL[pick.slot];
      return NextResponse.json(
        { error: `Player in slot ${pick.slot} must be a ${required} (got position: ${position})` },
        { status: 400 },
      );
    }
  }

  // ── Upsert lineup header (create or re-use existing draft) ─
  const { data: lineup, error: lineupErr } = await supabase
    .from("user_lineups")
    .upsert(
      { contest_id: id, user_id: userId, status: "draft" },
      { onConflict: "contest_id,user_id", ignoreDuplicates: false },
    )
    .select("id, status")
    .single();

  if (lineupErr) return NextResponse.json({ error: lineupErr.message }, { status: 500 });

  // Submitted lineups can still be edited before lock — only block locked/scored.
  if (lineup.status === "locked" || lineup.status === "scored") {
    return NextResponse.json({ error: "lineup_locked" }, { status: 409 });
  }

  // ── Replace players atomically ────────────────────────────
  // Delete existing then insert fresh; simple and correct for 5-row sets.
  const { error: delErr } = await supabase
    .from("user_lineup_players")
    .delete()
    .eq("lineup_id", lineup.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { error: insErr } = await supabase.from("user_lineup_players").insert(
    players.map((p) => ({ lineup_id: lineup.id, slot: p.slot, player_id: p.player_id })),
  );
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ lineup_id: lineup.id, status: "draft" });
}
