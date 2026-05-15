export const dynamic = "force-dynamic";
// app/api/basketball-games/[id]/box-score/route.ts
//
// GET      — visibility-gated read of all player stat rows for a game.
// POST/PUT — stats permission required. Upserts a list of stat rows keyed
//            on (game_id, player_id). fantasy_points is computed from the
//            authoritative engine: calcFantasyPoints with ESPN_DEFAULT_WEIGHTS.
//            No second scoring formula.
//
// Body:
//   { stats: Array<{ player_id, team_id?, min?, pts, reb, ast, stl, blk, tov,
//                    fgm, fga, fg3m, fg3a, ftm, fta }> }

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
  requireViewPermission,
} from "@/lib/basketball/access";
import {
  calcFantasyPoints,
  ESPN_DEFAULT_WEIGHTS,
} from "@/lib/fantasy/shared/scoring-config";
import { recomputeTeamScores } from "@/lib/basketball/aggregate";

type StatInput = {
  player_id: string;
  team_id?: string | null;
  min?: number;
  pts?: number;
  reb?: number;
  ast?: number;
  stl?: number;
  blk?: number;
  tov?: number;
  fgm?: number;
  fga?: number;
  fg3m?: number;
  fg3a?: number;
  ftm?: number;
  fta?: number;
};

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

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
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

    const { data, error } = await supabase
      .from("basketball_player_game_stats")
      .select("*")
      .eq("game_id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ stats: data ?? [] });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

async function upsertBoxScore(req: Request, gameId: string) {
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  const game = await loadGame(supabase, gameId);
  await requireStatsPermission(supabase, game.basketball_league_id, userId);

  const body = (await req.json()) as { stats?: StatInput[] };
  if (!Array.isArray(body.stats) || body.stats.length === 0) {
    throw new AccessError("missing_stats", 400);
  }

  const now = new Date().toISOString();
  const rows = body.stats.map((s) => {
    const numbers = {
      pts: n(s.pts),
      reb: n(s.reb),
      ast: n(s.ast),
      stl: n(s.stl),
      blk: n(s.blk),
      tov: n(s.tov),
      fgm: n(s.fgm),
      fga: n(s.fga),
      fg3m: n(s.fg3m),
      fg3a: n(s.fg3a),
      ftm: n(s.ftm),
      fta: n(s.fta),
    };
    return {
      basketball_league_id: game.basketball_league_id,
      game_id: gameId,
      player_id: s.player_id,
      team_id: s.team_id ?? null,
      min: n(s.min),
      ...numbers,
      fantasy_points: calcFantasyPoints(numbers, ESPN_DEFAULT_WEIGHTS),
      updated_at: now,
    };
  });

  const { data, error } = await supabase
    .from("basketball_player_game_stats")
    .upsert(rows, { onConflict: "game_id,player_id" })
    .select();
  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code, hint: error.hint, details: error.details },
      { status: 500 },
    );
  }
  const team_scores = await recomputeTeamScores(supabase, gameId);
  return NextResponse.json({ stats: data ?? [], team_scores });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    return await upsertBoxScore(req, id);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    return await upsertBoxScore(req, id);
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
