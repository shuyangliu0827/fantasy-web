export const dynamic = "force-dynamic";
// GET /api/contests/all-time-leaderboard
//
// Returns all-time Daily Fantasy leaderboard sorted by historical total points.
//
// Points source (priority):
//   1. points_transactions (service role — bypasses "pts_select_own" RLS)
//   2. Fallback: SUM(user_lineups.points_awarded) if transactions table is empty
//
// Sort: total_points DESC → best_daily_rank ASC → contests_played DESC → username ASC

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function db() {
  return createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}

// Service role bypasses "pts_select_own" RLS on points_transactions.
function serviceDb() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export async function GET() {
  const supabase = db();
  const svcDb   = serviceDb();

  // ── 1. Total points from points_transactions (service role) ──
  const ptsByUser = new Map<string, number>();
  const { data: ptRows } = await svcDb
    .from("points_transactions")
    .select("user_id, amount")
    .in("reason", ["daily_rank_reward", "participation_reward"]);

  for (const r of (ptRows as any[] ?? [])) {
    ptsByUser.set(r.user_id, (ptsByUser.get(r.user_id) ?? 0) + (Number(r.amount) || 0));
  }

  // ── 2. Participation + rank stats from user_lineups (anon key) ─
  const { data: lineups, error: lErr } = await supabase
    .from("user_lineups")
    .select("user_id, contest_id, rank, points_awarded")
    .eq("status", "scored");

  if (lErr) return NextResponse.json({ error: lErr.message }, { status: 500 });

  type Agg = {
    user_id:            string;
    total_points:       number;
    participation_days: number;
    best_daily_rank:    number | null;
    contests_played:    number;
  };

  const aggMap = new Map<string, Agg>();
  const contestSets = new Map<string, Set<string>>();

  for (const row of (lineups as any[] ?? [])) {
    const uid = row.user_id as string;
    if (!aggMap.has(uid)) {
      aggMap.set(uid, { user_id: uid, total_points: 0, participation_days: 0, best_daily_rank: null, contests_played: 0 });
      contestSets.set(uid, new Set());
    }
    const agg  = aggMap.get(uid)!;
    const cSet = contestSets.get(uid)!;

    if (!cSet.has(row.contest_id)) {
      cSet.add(row.contest_id);
      agg.participation_days += 1;
      agg.contests_played    += 1;
    }

    if (row.rank != null) {
      const r = Number(row.rank);
      agg.best_daily_rank = agg.best_daily_rank === null ? r : Math.min(agg.best_daily_rank, r);
    }

    // Fallback points (only used when ptsByUser is empty)
    if (ptsByUser.size === 0) {
      agg.total_points += Number(row.points_awarded) || 0;
    }
  }

  // Apply points_transactions totals (overrides fallback)
  if (ptsByUser.size > 0) {
    for (const [uid, pts] of ptsByUser) {
      if (!aggMap.has(uid)) {
        aggMap.set(uid, { user_id: uid, total_points: pts, participation_days: 0, best_daily_rank: null, contests_played: 0 });
      } else {
        aggMap.get(uid)!.total_points = pts;
      }
    }
  }

  // Keep only users who have actually played
  const activeUids = [...aggMap.keys()].filter((uid) => {
    const a = aggMap.get(uid)!;
    return a.contests_played > 0 || a.total_points > 0;
  });

  if (activeUids.length === 0) return NextResponse.json({ entries: [] });

  // ── 3. Fetch usernames ───────────────────────────────────
  const { data: usersData } = await supabase
    .from("users")
    .select("id, username, name, avatar_url")
    .in("id", activeUids);

  const userMap = new Map<string, { username: string; name: string }>(
    ((usersData as any[]) ?? []).map((u) => [u.id, u]),
  );

  // ── 4. Sort + assign RANK() ─────────────────────────────────
  const sorted = activeUids
    .map((uid) => {
      const agg  = aggMap.get(uid)!;
      const info = userMap.get(uid);
      return { ...agg, username: info?.username ?? "" };
    })
    .sort((a, b) => {
      if (b.total_points !== a.total_points) return b.total_points - a.total_points;
      const ra = a.best_daily_rank ?? Infinity;
      const rb = b.best_daily_rank ?? Infinity;
      if (ra !== rb) return ra - rb;
      if (b.contests_played !== a.contests_played) return b.contests_played - a.contests_played;
      return a.username.localeCompare(b.username);
    });

  let rankCursor = 1;
  const entries = sorted.map((e, i) => {
    if (i > 0 && e.total_points !== sorted[i - 1].total_points) rankCursor = i + 1;
    return { ...e, overall_rank: rankCursor };
  });

  return NextResponse.json({ entries });
}
