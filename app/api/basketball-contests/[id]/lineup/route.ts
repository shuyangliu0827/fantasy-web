export const dynamic = "force-dynamic";
// GET  /api/basketball-contests/[id]/lineup   — caller's own lineup
// POST /api/basketball-contests/[id]/lineup   — save (or replace) draft
//
// Submit lives at /api/basketball-contests/[id]/lineup/submit.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";
import {
  LINEUP_SIZE,
  isEligibleForContestSlot,
  SLOT_LABELS,
} from "@/lib/basketball/contest-positions";

type Slot = { slot: number; player_id: string };

async function loadContest(supabase: ReturnType<typeof serviceDb>, id: string) {
  const { data, error } = await supabase
    .from("basketball_contests")
    .select("id, basketball_league_id, status, lineup_lock_at, salary_cap, lineup_size")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("contest_not_found", 404);
  return data;
}

function isLocked(contest: { status: string; lineup_lock_at: string | null }): boolean {
  if (contest.status === "locked" || contest.status === "scored") return true;
  if (contest.lineup_lock_at && new Date(contest.lineup_lock_at).getTime() <= Date.now()) {
    return true;
  }
  return false;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const contest = await loadContest(supabase, id);

    const { data: lineup } = await supabase
      .from("basketball_user_lineups")
      .select("*")
      .eq("contest_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!lineup) {
      return NextResponse.json({
        contest_id: contest.id,
        status: "draft",
        total_fpts: null,
        rank: null,
        submitted_at: null,
        players: [],
      });
    }
    const { data: slots } = await supabase
      .from("basketball_user_lineup_players")
      .select("slot, player_id, actual_fantasy_points")
      .eq("lineup_id", lineup.id)
      .order("slot");
    return NextResponse.json({
      lineup_id: lineup.id,
      contest_id: lineup.contest_id,
      user_id: lineup.user_id,
      status: lineup.status,
      total_fpts: lineup.total_fpts,
      rank: lineup.rank,
      submitted_at: lineup.submitted_at,
      players: slots ?? [],
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);
    const contest = await loadContest(supabase, id);

    if (isLocked(contest)) throw new AccessError("contest_locked", 409);

    const body = (await req.json()) as { players?: Slot[] };
    const slots = body.players ?? [];

    if (slots.length === 0) {
      // Allow clearing — delete any existing draft.
      const { data: existing } = await supabase
        .from("basketball_user_lineups")
        .select("id, status")
        .eq("contest_id", id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing && existing.status === "draft") {
        await supabase.from("basketball_user_lineups").delete().eq("id", existing.id);
      }
      return NextResponse.json({ status: "draft", players: [] });
    }

    if (slots.length !== contest.lineup_size) {
      // Allow partial drafts (saving as you build) but only when within bounds.
      if (slots.length < 0 || slots.length > contest.lineup_size) {
        throw new AccessError("lineup_size_mismatch", 400);
      }
    }

    const playerIds = slots.map((s) => s.player_id);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new AccessError("duplicate_player", 400);
    }

    // Slot range must be within the contest's lineup size (PG..C = 0..4 for
    // basketball; allow flex contests that one day grow past 5 by also
    // checking against contest.lineup_size).
    for (const s of slots) {
      if (!Number.isInteger(s.slot) || s.slot < 0 || s.slot >= contest.lineup_size) {
        throw new AccessError(`invalid_slot:${s.slot}`, 400);
      }
    }
    if (new Set(slots.map((s) => s.slot)).size !== slots.length) {
      throw new AccessError("duplicate_slot", 400);
    }

    // Validate every player belongs to this contest pool.
    const { data: pool } = await supabase
      .from("basketball_contest_players")
      .select("player_id, salary")
      .eq("contest_id", id);
    const salaryByPlayer = new Map<string, number>(
      (pool ?? []).map((p: { player_id: string; salary: number }) => [p.player_id, Number(p.salary)]),
    );
    let salaryUsed = 0;
    for (const s of slots) {
      const sal = salaryByPlayer.get(s.player_id);
      if (sal == null) throw new AccessError(`player_not_in_pool:${s.player_id}`, 400);
      salaryUsed += sal;
    }
    if (salaryUsed > contest.salary_cap) {
      throw new AccessError(`over_cap:${salaryUsed}>${contest.salary_cap}`, 400);
    }

    // Slot-position eligibility (only meaningful for the 5-slot PG..C model).
    if (contest.lineup_size === LINEUP_SIZE) {
      const { data: playerRows } = await supabase
        .from("basketball_players")
        .select("id, position")
        .in("id", playerIds);
      const positionById = new Map<string, string | null>(
        (playerRows ?? []).map((p: { id: string; position: string | null }) => [p.id, p.position]),
      );
      for (const s of slots) {
        const pos = positionById.get(s.player_id);
        if (!isEligibleForContestSlot(pos, s.slot)) {
          throw new AccessError(
            `player_not_eligible_for_slot:${SLOT_LABELS[s.slot] ?? s.slot}`,
            400,
          );
        }
      }
    }

    const now = new Date().toISOString();
    const { data: lineup, error: upsertErr } = await supabase
      .from("basketball_user_lineups")
      .upsert(
        {
          contest_id: id,
          user_id: userId,
          status: "draft",
          updated_at: now,
        },
        { onConflict: "contest_id,user_id" },
      )
      .select()
      .single();
    if (upsertErr) {
      return NextResponse.json(
        { error: upsertErr.message, code: upsertErr.code, hint: upsertErr.hint },
        { status: 500 },
      );
    }
    if (lineup.status === "submitted" || lineup.status === "scored") {
      throw new AccessError("lineup_already_submitted", 409);
    }

    await supabase
      .from("basketball_user_lineup_players")
      .delete()
      .eq("lineup_id", lineup.id);
    if (slots.length > 0) {
      const rows = slots.map((s) => ({
        lineup_id: lineup.id,
        slot: s.slot,
        player_id: s.player_id,
      }));
      const { error: insertErr } = await supabase
        .from("basketball_user_lineup_players")
        .insert(rows);
      if (insertErr) {
        return NextResponse.json(
          { error: insertErr.message, code: insertErr.code, hint: insertErr.hint },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      lineup_id: lineup.id,
      status: "draft",
      salary_used: salaryUsed,
      players: slots,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
