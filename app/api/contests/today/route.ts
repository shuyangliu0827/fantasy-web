export const dynamic = "force-dynamic";
// app/api/contests/today/route.ts
//
// GET /api/contests/today
//
// Returns today's contest for product flow (public get-or-create).
// If missing and there are games today, auto-creates it lazily.
// Used by the contest lobby to check if a contest is available,
// what the lock deadline is, and its current status.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "id":             "b1c2d3e4-...",
//   "date":           "2026-04-08",
//   "status":         "open",
//   "lineup_lock_at": "2026-04-08T23:30:00Z"
// }
//
// ── Sample response 404 ──────────────────────────────────────
// { "error": "no_contest_today" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/balldontlie";
import { normalizeTeamCode } from "@/lib/i18n";
import { calcFantasyPoints } from "@/lib/scoring-config";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";

function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q) return 1;
  if (rank <= q * 2) return 2;
  if (rank <= q * 3) return 3;
  return 4;
}

function parseEtStatusToUtc(status: string, dateStr: string): string | null {
  const m = status.trim().match(/^(\d{1,2}):(\d{2})\s+(am|pm)\s+ET$/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const ampm = m[3].toLowerCase();
  if (ampm === "pm" && hour !== 12) hour += 12;
  if (ampm === "am" && hour === 12) hour = 0;
  const utcHour = hour + 4;
  const dayOffset = utcHour >= 24 ? 1 : 0;
  const finalHour = utcHour % 24;
  const base = new Date(`${dateStr}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + dayOffset);
  base.setUTCHours(finalHour, min, 0, 0);
  return base.toISOString();
}

async function getTodaySlate(dateStr: string) {
  try {
    const { data: games } = await getGames({ dates: [dateStr] });
    if (!games || games.length === 0) {
      return { lineupLockAt: `${dateStr}${FALLBACK_LOCK_SUFFIX}`, playingTeams: new Set<string>() };
    }
    const playingTeams = new Set<string>();
    const candidates: string[] = [];
    for (const g of games) {
      if (g.home_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
      if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
      const t = parseEtStatusToUtc(g.status ?? "", dateStr);
      if (t) candidates.push(t);
    }
    candidates.sort();
    return { lineupLockAt: candidates[0] ?? `${dateStr}${FALLBACK_LOCK_SUFFIX}`, playingTeams };
  } catch {
    return { lineupLockAt: `${dateStr}${FALLBACK_LOCK_SUFFIX}`, playingTeams: new Set<string>() };
  }
}

async function buildPool(supabase: ReturnType<typeof db>, playingTeams: Set<string>) {
  const { data: rows, error } = await supabase
    .from("player_stats_cache")
    .select("player_id, injury, team, pts_avg, fgm_avg, fga_avg, fg3m_avg, ftm_avg, fta_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg")
    .in("team", [...playingTeams]);
  if (error) return { rows: null, error };
  const pool = (rows ?? [])
    .filter((r) => !r.injury?.toLowerCase().startsWith("out"))
    .map((r) => ({
      ...r,
      computed_fpts_avg: calcFantasyPoints({
        pts: r.pts_avg || 0,
        fgm: r.fgm_avg || 0,
        fga: r.fga_avg || 0,
        fg3m: r.fg3m_avg || 0,
        ftm: r.ftm_avg || 0,
        fta: r.fta_avg || 0,
        reb: r.reb_avg || 0,
        ast: r.ast_avg || 0,
        stl: r.stl_avg || 0,
        blk: r.blk_avg || 0,
        tov: r.tov_avg || 0,
      }),
    }))
    .sort((a, b) => b.computed_fpts_avg - a.computed_fpts_avg);
  return { rows: pool, error: null };
}

export async function GET() {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const supabase = db();

  const { data: initialData, error } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", today)
    .maybeSingle();
  let data = initialData;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Lazy get-or-create: auto-create if missing and there are games today.
  if (!data) {
    const { lineupLockAt, playingTeams } = await getTodaySlate(today);
    if (playingTeams.size === 0) {
      return NextResponse.json({ error: "no_contest_today" }, { status: 404 });
    }
    const { rows: poolRows, error: poolErr } = await buildPool(supabase, playingTeams);
    if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
    if (!poolRows || poolRows.length === 0) {
      return NextResponse.json({ error: "no_contest_today" }, { status: 404 });
    }

    const { data: inserted, error: insErr } = await supabase
      .from("contests")
      .insert({ date: today, status: "open", lineup_lock_at: lineupLockAt })
      .select("id, date, status, lineup_lock_at")
      .single();

    if (insErr) {
      // Race-safe duplicate prevention: date is UNIQUE. If another request
      // created the row first, read it and return.
      if (insErr.code === "23505") {
        const { data: raced, error: racedErr } = await supabase
          .from("contests")
          .select("id, date, status, lineup_lock_at")
          .eq("date", today)
          .maybeSingle();
        if (racedErr) return NextResponse.json({ error: racedErr.message }, { status: 500 });
        if (raced) data = raced;
      } else {
        return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
    } else {
      const contestPlayers = poolRows.map((row, i) => ({
        contest_id: inserted.id,
        player_id: String(row.player_id),
        tier: tierFor(i + 1, poolRows.length),
      }));
      const { error: cpErr } = await supabase.from("contest_players").insert(contestPlayers);
      if (cpErr) return NextResponse.json({ error: cpErr.message }, { status: 500 });
      data = inserted;
    }
  }

  if (!data) return NextResponse.json({ error: "no_contest_today" }, { status: 404 });

  // Soft lifecycle transition: open -> locked when deadline passes.
  // Full scoring/ranking is handled by /api/contests/sync-lifecycle cron.
  if (data.status === "open" && new Date() >= new Date(data.lineup_lock_at)) {
    const { data: updated, error: updErr } = await supabase
      .from("contests")
      .update({ status: "locked" })
      .eq("id", data.id)
      .select("id, date, status, lineup_lock_at")
      .single();
    if (!updErr && updated) data = updated;
  }

  return NextResponse.json(data);
}
