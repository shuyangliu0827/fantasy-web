export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireStatsPermission,
} from "@/lib/basketball/access";
import { recomputeBoxScore, recomputeTeamScores } from "@/lib/basketball/aggregate";
import type { StatEventType } from "@/lib/basketball/events";

const ALLOWED: ReadonlySet<StatEventType> = new Set<StatEventType>([
  "two_pt_made","two_pt_missed","three_pt_made","three_pt_missed","ft_made","ft_missed","reb","ast","stl","blk","tov",
]);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    const { data: game, error: gErr } = await supabase.from("basketball_games").select("id,basketball_league_id").eq("id", id).maybeSingle();
    if (gErr) throw new AccessError(gErr.message, 500);
    if (!game) throw new AccessError("game_not_found", 404);
    await requireStatsPermission(supabase, game.basketball_league_id, userId);

    const body = (await req.json()) as {
      events?: Array<{ client_event_id?: string; player_id?: string; event_type?: string; team_id?: string | null }>;
    };
    const events = Array.isArray(body.events) ? body.events : [];
    if (events.length === 0) return NextResponse.json({ processed: [] });

    const processed: Array<{ client_event_id: string | null; status: "inserted" | "duplicate" | "invalid" }> = [];
    const touchedPlayers = new Set<string>();
    for (const ev of events) {
      const playerId = ev.player_id ?? "";
      const eventType = ev.event_type as StatEventType;
      const clientEventId = ev.client_event_id ?? null;
      if (!playerId || !eventType || !ALLOWED.has(eventType)) {
        processed.push({ client_event_id: clientEventId, status: "invalid" });
        continue;
      }
      const { error: insertErr } = await supabase.from("basketball_stat_events").insert({
        basketball_league_id: game.basketball_league_id,
        game_id: id,
        player_id: playerId,
        team_id: ev.team_id ?? null,
        event_type: eventType,
        client_event_id: clientEventId,
        created_by: userId,
      });
      if (insertErr) {
        if (insertErr.code === "23505") {
          processed.push({ client_event_id: clientEventId, status: "duplicate" });
          continue;
        }
        return NextResponse.json({ error: insertErr.message }, { status: 500 });
      }
      touchedPlayers.add(playerId);
      processed.push({ client_event_id: clientEventId, status: "inserted" });
    }

    for (const pid of touchedPlayers) await recomputeBoxScore(supabase, game, pid);
    const team_scores = await recomputeTeamScores(supabase, id);
    return NextResponse.json({ processed, team_scores });
  } catch (e) {
    if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: e.status });
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

