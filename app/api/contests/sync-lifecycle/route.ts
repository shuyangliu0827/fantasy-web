export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("Authorization");
  if (auth === `Bearer ${secret}`) return true;
  const url = new URL(req.url);
  return url.searchParams.get("secret") === secret;
}

const r1 = (v: number) => Math.round(v * 10) / 10;

type ContestRow = {
  id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string;
};

async function refreshContestScores(
  supabase: ReturnType<typeof db>,
  contest: ContestRow,
  final: boolean,
) {
  const { data: cpRows, error: cpErr } = await supabase
    .from("contest_players")
    .select("player_id")
    .eq("contest_id", contest.id);
  if (cpErr) throw new Error(cpErr.message);

  const playerIds = (cpRows ?? []).map((r) => r.player_id);
  if (playerIds.length === 0) return { scoredPlayers: 0, totalEntries: 0 };

  const { data: dayRows, error: dayErr } = await supabase
    .from("player_day_stats")
    .select("player_id, fpts")
    .eq("date", contest.date)
    .in("player_id", playerIds);
  if (dayErr) throw new Error(dayErr.message);

  const fptsMap = new Map<string, number>();
  for (const row of dayRows ?? []) fptsMap.set(String(row.player_id), Number(row.fpts ?? 0));

  const cpUpdates = playerIds.map((pid) => ({
    contest_id: contest.id,
    player_id: pid,
    fpts_scored: fptsMap.has(pid) ? fptsMap.get(pid)! : (final ? 0 : null),
  }));

  const { error: upCpErr } = await supabase
    .from("contest_players")
    .upsert(cpUpdates, { onConflict: "contest_id,player_id" });
  if (upCpErr) throw new Error(upCpErr.message);

  const { data: lineups, error: luErr } = await supabase
    .from("user_lineups")
    .select("id, submitted_at, status")
    .eq("contest_id", contest.id)
    .in("status", ["submitted", "locked", "scored"]);
  if (luErr) throw new Error(luErr.message);

  if (!lineups || lineups.length === 0) {
    return { scoredPlayers: fptsMap.size, totalEntries: 0 };
  }

  const lineupIds = lineups.map((l) => l.id);
  const { data: picks, error: picksErr } = await supabase
    .from("user_lineup_players")
    .select("lineup_id, player_id")
    .in("lineup_id", lineupIds);
  if (picksErr) throw new Error(picksErr.message);

  const picksByLineup = new Map<string, string[]>();
  for (const p of picks ?? []) {
    if (!picksByLineup.has(p.lineup_id)) picksByLineup.set(p.lineup_id, []);
    picksByLineup.get(p.lineup_id)!.push(p.player_id);
  }

  const totals = lineups.map((l) => {
    const ids = picksByLineup.get(l.id) ?? [];
    const total = ids.reduce((sum, pid) => sum + (fptsMap.get(pid) ?? 0), 0);
    return { lineup_id: l.id, submitted_at: l.submitted_at ?? null, total_fpts: r1(total) };
  });

  const statusForLineup = final ? "scored" : "locked";
  for (const t of totals) {
    const { error: updErr } = await supabase
      .from("user_lineups")
      .update({
        total_fpts: t.total_fpts,
        status: statusForLineup,
        rank: final ? undefined : null,
      })
      .eq("id", t.lineup_id);
    if (updErr) throw new Error(updErr.message);
  }

  if (final) {
    const ranked = [...totals].sort((a, b) => {
      if (b.total_fpts !== a.total_fpts) return b.total_fpts - a.total_fpts;
      return String(a.submitted_at ?? "").localeCompare(String(b.submitted_at ?? ""));
    });
    let prevScore: number | null = null;
    let prevRank = 0;
    for (let i = 0; i < ranked.length; i++) {
      const rank = prevScore !== null && ranked[i].total_fpts === prevScore ? prevRank : i + 1;
      prevScore = ranked[i].total_fpts;
      prevRank = rank;
      const { error: rankErr } = await supabase
        .from("user_lineups")
        .update({ rank, status: "scored" })
        .eq("id", ranked[i].lineup_id);
      if (rankErr) throw new Error(rankErr.message);
    }
  }

  return { scoredPlayers: fptsMap.size, totalEntries: lineups.length };
}

async function handler(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = db();
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: contests, error } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .in("status", ["open", "locked"])
    .lte("date", today)
    .order("date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ id: string; from: string; to: string; scoredPlayers: number; totalEntries: number }> = [];

  for (const contest of (contests ?? []) as ContestRow[]) {
    let nextStatus = contest.status;
    if (contest.status === "open" && now >= new Date(contest.lineup_lock_at)) {
      nextStatus = "locked";
    }

    const final = contest.date < today;
    const shouldScore = nextStatus === "locked" || final;
    let scoredPlayers = 0;
    let totalEntries = 0;

    if (shouldScore) {
      const scoring = await refreshContestScores(supabase, contest, final);
      scoredPlayers = scoring.scoredPlayers;
      totalEntries = scoring.totalEntries;
      if (final) nextStatus = "scored";
    }

    if (nextStatus !== contest.status) {
      const { error: updErr } = await supabase
        .from("contests")
        .update({ status: nextStatus })
        .eq("id", contest.id);
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    results.push({
      id: contest.id,
      from: contest.status,
      to: nextStatus,
      scoredPlayers,
      totalEntries,
    });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function GET(req: Request) { return handler(req); }
export async function POST(req: Request) { return handler(req); }
