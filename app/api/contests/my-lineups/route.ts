export const dynamic = "force-dynamic";
// GET /api/contests/my-lineups
//
// Returns submitted/locked/scored lineups for the authenticated user
// within the current natural week (Mon–Sun UTC), sorted by contest_date ASC.
//
// Each player row includes:
//   box_score  – full BDL box-score stats for the contest date (null if unavailable)
//   opponent   – "vs LAL" or "@ BOS" string (null if no game found)
//   live_fpts  – convenience alias of box_score.fpts for unscored lineups

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/contest-auth";
import { SLOT_LABEL } from "@/lib/contest-positions";
import { getWeekStart, getWeekEnd, toDateStr } from "@/lib/contest-points";
import { fetchStatsForDate, PlayerGameStats } from "@/lib/player-game-stats";
import { fetchGamesForRange } from "@/lib/nba-games";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const supabase = db();

  // ── 1. Fetch all user lineups with contest info ──────────────
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("id, contest_id, status, total_fpts, rank, submitted_at, contests(id, date, status, lineup_lock_at)")
    .eq("user_id", userId)
    .in("status", ["submitted", "locked", "scored"])
    .order("submitted_at", { ascending: false });

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });
  if (!lineups || lineups.length === 0) return NextResponse.json({ lineups: [] });

  // ── Filter to current natural week (Mon–Sun UTC) by contest_date ──
  const weekStart = toDateStr(getWeekStart());
  const weekEnd   = toDateStr(getWeekEnd());
  const weekLineups = (lineups as any[]).filter((l) => {
    const date = (l.contests as any)?.date;
    return date && date >= weekStart && date <= weekEnd;
  });
  if (weekLineups.length === 0) return NextResponse.json({ lineups: [] });

  // Try to include points_awarded; fall back if column not yet migrated.
  const pointsMap = new Map<string, number>();
  const { data: paRows, error: paErr } = await supabase
    .from("user_lineups")
    .select("id, points_awarded")
    .in("id", weekLineups.map((l: any) => l.id));

  if (!paErr && paRows) {
    for (const r of paRows as any[]) {
      pointsMap.set(r.id, r.points_awarded ?? 0);
    }
  }

  const lineupIds = weekLineups.map((l: any) => l.id);

  // ── 2. Fetch all lineup players ──────────────────────────────
  const { data: lineupPlayers, error: lpErr } = await supabase
    .from("user_lineup_players")
    .select("lineup_id, slot, player_id, actual_fantasy_points")
    .in("lineup_id", lineupIds);

  if (lpErr) return NextResponse.json({ error: lpErr.message }, { status: 500 });

  // ── 3. Fetch player metadata, salaries, box scores, and games ─
  const allPlayerIds = [...new Set((lineupPlayers as any[] ?? []).map((p) => String(p.player_id)))];
  const intIds = allPlayerIds.map((id) => parseInt(id, 10)).filter((n) => !isNaN(n));

  const contestIds = [...new Set(weekLineups.map((l: any) => l.contest_id))];

  // All unique contest dates — fetch box scores for every date (scored or not).
  const allDates = [
    ...new Set(
      weekLineups
        .map((l: any) => (l.contests as any)?.date)
        .filter(Boolean),
    ),
  ] as string[];

  // ── Fetch player metadata + salaries (parallel) ──────────────
  const [pscRes, cpRes] = await Promise.all([
    intIds.length
      ? supabase.from("player_stats_cache").select("player_id, name, position, team").in("player_id", intIds)
      : Promise.resolve({ data: [], error: null }),
    contestIds.length && allPlayerIds.length
      ? supabase.from("contest_players").select("contest_id, player_id, salary").in("contest_id", contestIds).in("player_id", allPlayerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // ── Fetch box-score stats for all contest dates ───────────────
  // Keyed "date:player_id" → PlayerGameStats
  const statsMap = new Map<string, PlayerGameStats>();
  if (allDates.length > 0) {
    await Promise.all(
      allDates.map(async (date) => {
        try {
          const dayStats = await fetchStatsForDate(date);
          for (const [pid, stats] of Object.entries(dayStats)) {
            statsMap.set(`${date}:${pid}`, stats);
          }
        } catch {
          // BDL unavailable for this date
        }
      }),
    );
  }

  // ── Fetch game schedule for opponent labels + game status ─────
  // Keyed "team_abbr:date" → { label, status }
  type GameMeta = { label: string; status: string };
  const opponentMap = new Map<string, GameMeta>();
  if (allDates.length > 0) {
    const minDate = allDates.reduce((a, b) => (a < b ? a : b));
    const maxDate = allDates.reduce((a, b) => (a > b ? a : b));
    try {
      const gamesMap = await fetchGamesForRange(minDate, maxDate);
      for (const [teamAbbr, dateGames] of Object.entries(gamesMap)) {
        for (const [date, info] of Object.entries(dateGames)) {
          opponentMap.set(`${teamAbbr}:${date}`, {
            label:  info.isHome ? `vs ${info.opponent}` : `@ ${info.opponent}`,
            status: info.status,
          });
        }
      }
    } catch {
      // BDL schedule unavailable
    }
  }

  const metaMap = new Map<string, { name: string; position: string; team: string }>(
    ((pscRes.data as any[]) ?? []).map((r) => [String(r.player_id), r]),
  );

  // Salary keyed by "contestId:playerId"
  const salaryMap = new Map<string, number>(
    ((cpRes.data as any[]) ?? []).map((r) => [`${r.contest_id}:${String(r.player_id)}`, r.salary]),
  );

  // ── 4. Group players by lineup ───────────────────────────────
  const playersByLineup = new Map<string, any[]>();
  for (const lp of (lineupPlayers as any[] ?? [])) {
    const meta = metaMap.get(String(lp.player_id));
    if (!playersByLineup.has(lp.lineup_id)) playersByLineup.set(lp.lineup_id, []);
    playersByLineup.get(lp.lineup_id)!.push({
      slot:                  lp.slot,
      slot_label:            SLOT_LABEL[lp.slot as number] ?? String(lp.slot),
      player_id:             lp.player_id,
      name:                  meta?.name     ?? "",
      position:              meta?.position ?? "",
      team:                  meta?.team     ?? "",
      actual_fantasy_points: lp.actual_fantasy_points ?? null,
    });
  }

  // ── 5. Build result sorted by contest_date ASC (Mon → Sun) ──
  const result = weekLineups
    .map((l: any) => {
      const contest      = l.contests as any;
      const contestDate  = contest?.date ?? null;
      const isScored     = l.status === "scored";

      const players = (playersByLineup.get(l.id) ?? [])
        .map((p) => {
          const salary    = salaryMap.get(`${l.contest_id}:${String(p.player_id)}`) ?? 0;
          const statsKey  = contestDate ? `${contestDate}:${String(p.player_id)}` : null;
          const box_score = statsKey ? (statsMap.get(statsKey) ?? null) : null;
          const oppKey    = p.team && contestDate ? `${p.team}:${contestDate}` : null;
          const gameMeta  = oppKey ? (opponentMap.get(oppKey) ?? null) : null;
          const opponent  = gameMeta?.label  ?? null;
          const game_status = gameMeta?.status ?? null;
          // live_fpts: for unscored lineups, real-time fpts from BDL box score.
          const live_fpts = !isScored && box_score ? box_score.fpts : null;

          return { ...p, salary, box_score, opponent, game_status, live_fpts };
        })
        .sort((a: any, b: any) => a.slot - b.slot);

      // Live total: sum of live_fpts for players whose game has box-score data.
      const live_total_fpts = !isScored
        ? players.reduce((sum: number, p: any) => sum + (p.live_fpts ?? 0), 0)
        : null;

      return {
        lineup_id:        l.id,
        contest_id:       l.contest_id,
        contest_date:     contestDate,
        contest_status:   contest?.status ?? null,
        status:           l.status,
        total_fpts:       l.total_fpts    ?? null,
        live_total_fpts,
        rank:             l.rank          ?? null,
        points_awarded:   pointsMap.get(l.id) ?? 0,
        submitted_at:     l.submitted_at  ?? null,
        players,
      };
    })
    .sort((a: any, b: any) => {
      if (!a.contest_date && !b.contest_date) return 0;
      if (!a.contest_date) return 1;
      if (!b.contest_date) return -1;
      return a.contest_date.localeCompare(b.contest_date); // oldest first (Mon → Sun)
    });

  return NextResponse.json({ lineups: result });
}
