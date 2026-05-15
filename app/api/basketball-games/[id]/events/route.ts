export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/events/route.ts
//
// GET  — visibility-gated. Returns the stat-event log for this game,
//        newest first. Optional ?player_id=... filter.
// POST — requires stats permission. Inserts one event, recomputes the
//        aggregate basketball_player_game_stats row, returns both.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
  requireViewPermission,
} from "@/lib/basketball/access";
import { recomputeBoxScore, recomputeTeamScores } from "@/lib/basketball/aggregate";
import type { StatEventType } from "@/lib/basketball/events";

const ALLOWED: ReadonlySet<StatEventType> = new Set<StatEventType>([
  "two_pt_made",
  "two_pt_missed",
  "three_pt_made",
  "three_pt_missed",
  "ft_made",
  "ft_missed",
  "reb",
  "ast",
  "stl",
  "blk",
  "tov",
]);

async function loadGame(supabase: ReturnType<typeof serviceDb>, gameId: string) {
  const { data, error } = await supabase
    .from("basketball_games")
    .select("id, basketball_league_id")
    .eq("id", gameId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("game_not_found", 404);
  return data;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const game = await loadGame(supabase, id);
    await requireViewPermission(supabase, game.basketball_league_id, userId);

    const playerId = new URL(req.url).searchParams.get("player_id");
    let q = supabase
      .from("basketball_stat_events")
      .select("*")
      .eq("game_id", id)
      .order("created_at", { ascending: false });
    if (playerId) q = q.eq("player_id", playerId);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ events: data ?? [] });
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
    const game = await loadGame(supabase, id);
    await requireStatsPermission(supabase, game.basketball_league_id, userId);

    const body = (await req.json()) as {
      player_id?: string;
      event_type?: string;
      team_id?: string | null;
    };
    if (!body.player_id) throw new AccessError("missing_player_id", 400);
    if (!body.event_type || !ALLOWED.has(body.event_type as StatEventType)) {
      throw new AccessError("invalid_event_type", 400);
    }

    // Resolve team_id from player record if caller didn't supply it.
    let teamId: string | null = body.team_id ?? null;
    if (!teamId) {
      const { data: player } = await supabase
        .from("basketball_players")
        .select("team_id")
        .eq("id", body.player_id)
        .maybeSingle();
      teamId = player?.team_id ?? null;
    }

    const { data: event, error: insertErr } = await supabase
      .from("basketball_stat_events")
      .insert({
        basketball_league_id: game.basketball_league_id,
        game_id: id,
        player_id: body.player_id,
        team_id: teamId,
        event_type: body.event_type,
        created_by: userId,
      })
      .select()
      .single();
    if (insertErr) {
      return NextResponse.json(
        {
          error: insertErr.message,
          code: insertErr.code,
          hint: insertErr.hint,
        },
        { status: 500 },
      );
    }

    const { stats, error: aggErr } = await recomputeBoxScore(
      supabase,
      game,
      body.player_id,
    );
    if (aggErr) {
      return NextResponse.json({ error: aggErr }, { status: 500 });
    }
    const team_scores = await recomputeTeamScores(supabase, id);
    return NextResponse.json({ event, stats, team_scores });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
