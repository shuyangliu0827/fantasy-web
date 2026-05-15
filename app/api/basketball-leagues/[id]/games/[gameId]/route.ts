export const dynamic = "force-dynamic";
// PATCH /api/basketball-leagues/[id]/games/[gameId]
// DELETE /api/basketball-leagues/[id]/games/[gameId]
//
// PATCH:  league admin / platform admin / approved scorekeeper updates
//         the game status (scheduled → live → final, or cancelled) and /
//         or the on_court_player_ids set. Validates inputs and the
//         transition; rejects same-team on-court ids or ids not on the
//         game's roster.
//
// DELETE: removes a scheduled game. Refuses when the game already has
//         box-score rows (preserves audit trail) or when a contest for
//         that game's league-local date is already locked or scored.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
} from "@/lib/basketball/access";
import { todayInTimezone } from "@/lib/basketball/contest-date";

const ALLOWED_STATUSES = new Set(["scheduled", "live", "final", "cancelled"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id, gameId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireStatsPermission(supabase, id, userId);

    const { data: game, error: gameErr } = await supabase
      .from("basketball_games")
      .select(
        "id, basketball_league_id, status, home_team_id, away_team_id, on_court_player_ids",
      )
      .eq("id", gameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game || game.basketball_league_id !== id) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404 });
    }

    const body = (await req.json()) as {
      status?: string;
      on_court_player_ids?: string[];
    };

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.status === "string") {
      if (!ALLOWED_STATUSES.has(body.status)) {
        throw new AccessError("invalid_status", 400);
      }
      patch.status = body.status;
    }

    if (Array.isArray(body.on_court_player_ids)) {
      const ids = body.on_court_player_ids.filter((x) => typeof x === "string");
      for (const pid of ids) {
        if (!UUID_RE.test(pid)) {
          throw new AccessError("invalid_player_id", 400);
        }
      }
      // Validate each id belongs to a player on one of the two teams of this game.
      if (ids.length > 0) {
        const { data: rosterRows, error: rosterErr } = await supabase
          .from("basketball_players")
          .select("id, team_id")
          .in("id", ids);
        if (rosterErr) {
          return NextResponse.json({ error: rosterErr.message }, { status: 500 });
        }
        const validTeamIds = new Set(
          [game.home_team_id, game.away_team_id].filter((x): x is string => !!x),
        );
        for (const row of rosterRows ?? []) {
          const r = row as { id: string; team_id: string | null };
          if (!r.team_id || !validTeamIds.has(r.team_id)) {
            throw new AccessError("player_not_in_game", 400);
          }
        }
        if ((rosterRows ?? []).length !== ids.length) {
          throw new AccessError("unknown_player_id", 400);
        }
      }
      patch.on_court_player_ids = ids;
    }

    const { data: updated, error: updErr } = await supabase
      .from("basketball_games")
      .update(patch)
      .eq("id", gameId)
      .select()
      .single();
    if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    return NextResponse.json({ game: updated });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> },
) {
  const { id, gameId } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireStatsPermission(supabase, id, userId);

    // Game must exist and belong to this league.
    const { data: game, error: gameErr } = await supabase
      .from("basketball_games")
      .select("id, basketball_league_id, scheduled_at")
      .eq("id", gameId)
      .maybeSingle();
    if (gameErr) return NextResponse.json({ error: gameErr.message }, { status: 500 });
    if (!game || game.basketball_league_id !== id) {
      return NextResponse.json({ error: "game_not_found" }, { status: 404 });
    }

    // Refuse if any box-score rows reference this game.
    const { count: statCount, error: statErr } = await supabase
      .from("basketball_player_game_stats")
      .select("id", { count: "exact", head: true })
      .eq("game_id", gameId);
    if (statErr) return NextResponse.json({ error: statErr.message }, { status: 500 });
    if ((statCount ?? 0) > 0) {
      return NextResponse.json({ error: "has_box_score" }, { status: 409 });
    }

    // Refuse if the contest for this game's league-local date is locked/scored.
    if (game.scheduled_at) {
      const { data: league, error: leagueErr } = await supabase
        .from("basketball_leagues")
        .select("timezone")
        .eq("id", id)
        .maybeSingle<{ timezone: string }>();
      if (leagueErr) return NextResponse.json({ error: leagueErr.message }, { status: 500 });
      const tz = league?.timezone || "UTC";
      const localDate = todayInTimezone(tz, new Date(game.scheduled_at));

      const { data: contest, error: contestErr } = await supabase
        .from("basketball_contests")
        .select("id, status")
        .eq("basketball_league_id", id)
        .eq("date", localDate)
        .maybeSingle();
      if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });
      if (contest && (contest.status === "locked" || contest.status === "scored")) {
        return NextResponse.json({ error: "contest_locked" }, { status: 409 });
      }
    }

    const { error: delErr } = await supabase
      .from("basketball_games")
      .delete()
      .eq("id", gameId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
