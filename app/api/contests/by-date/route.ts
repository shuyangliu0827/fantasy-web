export const dynamic = "force-dynamic";
// app/api/contests/by-date/route.ts
//
// GET /api/contests/by-date?date=YYYY-MM-DD
//
// Public, on-demand resolver for a single contest date — used by the contest
// page when a user clicks an upcoming "placeholder" calendar card whose date
// has no DB row yet.
//
// Behaviour:
//   1. Reject dates outside [today, today+MAX_DAYS_AHEAD] (UTC).
//   2. If a contest row already exists for the date, return it.
//   3. Otherwise call BDL for scheduled games on that date.
//      - No games  → return { noGames: true, date }.
//      - Has games → create a "pending" contest stub + provisional player pool
//        (same logic as seed-upcoming) and return the new contest row.
//
// The endpoint is idempotent: calling it twice for the same date is a no-op
// after the first creation. Date bounds + idempotency make it safe to expose
// without auth — abuse surface is bounded to creating up to MAX_DAYS_AHEAD
// rows that the seed-upcoming cron would have created anyway.
//
// ── Sample responses ────────────────────────────────────────
// 200 { "contest": { "id": "...", "date": "2026-04-28", "status": "pending", ... } }
// 200 { "noGames": true, "date": "2026-04-28" }
// 400 { "error": "invalid_date" }              — malformed date param
// 400 { "error": "out_of_range" }              — date outside the allowed window
// 500 { "error": "<db error>" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGames } from "@/lib/balldontlie";
import { normalizeTeamCode } from "@/lib/i18n";

const FALLBACK_LOCK_SUFFIX = "T23:00:00Z";
const MAX_DAYS_AHEAD = 14;

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Quartile tiering — matches seed-upcoming/create-today.
function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q)     return 1;
  if (rank <= q * 2) return 2;
  if (rank <= q * 3) return 3;
  return 4;
}

export async function GET(req: Request) {
  const url  = new URL(req.url);
  const date = url.searchParams.get("date") ?? "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "invalid_date" }, { status: 400 });
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);
  const maxDate = new Date(today);
  maxDate.setUTCDate(today.getUTCDate() + MAX_DAYS_AHEAD);
  const maxStr = maxDate.toISOString().slice(0, 10);

  if (date < todayStr || date > maxStr) {
    return NextResponse.json({ error: "out_of_range" }, { status: 400 });
  }

  const supabase = db();

  // 1. Idempotent check — return the existing row if one exists.
  const { data: existing, error: lookupErr } = await supabase
    .from("contests")
    .select("id, date, status, lineup_lock_at")
    .eq("date", date)
    .maybeSingle();

  if (lookupErr) {
    return NextResponse.json({ error: lookupErr.message }, { status: 500 });
  }
  if (existing) {
    return NextResponse.json({ contest: existing });
  }

  // 2. Ask BDL whether games are scheduled for this date.
  const playingTeams = new Set<string>();
  try {
    const { data: games } = await getGames({ dates: [date] });
    if (Array.isArray(games)) {
      for (const g of games) {
        if (g.home_team?.abbreviation)    playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
        if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
      }
    }
  } catch {
    // BDL outage — surface as no_games rather than a 500. The seed cron
    // will retry later if BDL recovers.
  }

  if (playingTeams.size === 0) {
    return NextResponse.json({ noGames: true, date });
  }

  // 3. Create the contest stub. Status stays "pending" — the morning cron
  //    (create-today) flips it to "open" with the real BDL tip-off time.
  const { data: created, error: insertErr } = await supabase
    .from("contests")
    .insert({
      date,
      status:         "pending",
      lineup_lock_at: `${date}${FALLBACK_LOCK_SUFFIX}`,
    })
    .select("id, date, status, lineup_lock_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  // 4. Build a provisional player pool — same logic as seed-upcoming.
  const { data: cacheRows } = await supabase
    .from("player_stats_cache")
    .select("player_id, fpts_avg, injury, team")
    .in("team", [...playingTeams])
    .order("fpts_avg", { ascending: false });

  const poolRows = (cacheRows ?? []).filter(
    (r) => !r.injury?.toLowerCase().startsWith("out"),
  );

  if (poolRows.length > 0) {
    await supabase.from("contest_players").insert(
      poolRows.map((row, idx) => ({
        contest_id: created.id,
        player_id:  String(row.player_id),
        tier:       tierFor(idx + 1, poolRows.length),
      })),
    );
  }

  return NextResponse.json({ contest: created });
}
