export const dynamic = "force-dynamic";
// app/api/basketball-teams/[id]/season-summary/route.ts
//
// GET /api/basketball-teams/{id}/season-summary
//
// Server-side aggregation of a basketball team's season-to-date record
// and statistical leaders, derived entirely from finalized games. We do
// not fabricate stats: any category that lacks qualifying games returns
// `null` and the page falls back to an empty state.
//
// Authorization: visibility-gated on the parent league.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireViewPermission,
} from "@/lib/basketball/access";

type Leader = {
  player_id: string;
  display_name: string;
  avg: number;
  games_played: number;
} | null;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const { data: team, error: tErr } = await supabase
      .from("basketball_teams")
      .select("id, basketball_league_id")
      .eq("id", id)
      .maybeSingle();
    if (tErr) throw new AccessError(tErr.message, 500);
    if (!team) throw new AccessError("team_not_found", 404);

    const userId = await getCurrentUserIdFromRequest(req);
    await requireViewPermission(supabase, team.basketball_league_id, userId);

    // Pull every finalized game involving this team with scores set.
    const { data: games, error: gErr } = await supabase
      .from("basketball_games")
      .select("id, home_team_id, away_team_id, home_score, away_score, status")
      .or(`home_team_id.eq.${id},away_team_id.eq.${id}`)
      .eq("status", "final")
      .not("home_score", "is", null)
      .not("away_score", "is", null);
    if (gErr) throw new AccessError(gErr.message, 500);

    const finals = games ?? [];

    let w = 0;
    let l = 0;
    let t = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;
    for (const g of finals) {
      const isHome = g.home_team_id === id;
      const myScore = (isHome ? g.home_score : g.away_score) ?? 0;
      const oppScore = (isHome ? g.away_score : g.home_score) ?? 0;
      pointsFor += myScore;
      pointsAgainst += oppScore;
      if (myScore > oppScore) w += 1;
      else if (myScore < oppScore) l += 1;
      else t += 1;
    }
    const gp = finals.length;
    const points_for_avg = gp > 0 ? pointsFor / gp : null;
    const points_against_avg = gp > 0 ? pointsAgainst / gp : null;

    // Leaders. Aggregate basketball_player_game_stats rows scoped to
    // this team across the finalized game ids only.
    let leaders: { pts: Leader; reb: Leader; ast: Leader } = {
      pts: null,
      reb: null,
      ast: null,
    };
    const finalIds = finals.map((g) => g.id);
    if (finalIds.length > 0) {
      const { data: stats } = await supabase
        .from("basketball_player_game_stats")
        .select(
          "player_id, pts, reb, ast, basketball_players!inner ( display_name )",
        )
        .eq("team_id", id)
        .in("game_id", finalIds);
      type StatRow = {
        player_id: string;
        pts: number;
        reb: number;
        ast: number;
        basketball_players: { display_name: string } | null;
      };
      const buckets: Record<
        string,
        { name: string; pts: number; reb: number; ast: number; g: number }
      > = {};
      for (const r of (stats ?? []) as unknown as StatRow[]) {
        const b = buckets[r.player_id] ?? {
          name: r.basketball_players?.display_name ?? "—",
          pts: 0,
          reb: 0,
          ast: 0,
          g: 0,
        };
        b.pts += Number(r.pts ?? 0);
        b.reb += Number(r.reb ?? 0);
        b.ast += Number(r.ast ?? 0);
        b.g += 1;
        buckets[r.player_id] = b;
      }
      const entries = Object.entries(buckets);
      const top = (key: "pts" | "reb" | "ast"): Leader => {
        let best: Leader = null;
        for (const [pid, b] of entries) {
          if (b.g === 0) continue;
          const avg = b[key] / b.g;
          if (!best || avg > best.avg) {
            best = { player_id: pid, display_name: b.name, avg, games_played: b.g };
          }
        }
        return best;
      };
      leaders = { pts: top("pts"), reb: top("reb"), ast: top("ast") };
    }

    return NextResponse.json({
      record: { w, l, t, games_played: gp },
      points_for_avg,
      points_against_avg,
      leaders,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
