export const dynamic = "force-dynamic";
// app/api/contests/[id]/lineup/route.ts
//
// ── GET /api/contests/[id]/lineup ────────────────────────────
//
// Returns the authenticated user's current lineup for the contest.
// Creates no data — returns 404 if the user has no lineup yet.
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Sample response 200:
// {
//   "lineup_id":    "a1b2...",
//   "contest_id":  "b1c2...",
//   "user_id":     "c1d2...",
//   "status":      "submitted",
//   "total_fpts":  null,
//   "rank":        null,
//   "submitted_at": "2026-04-08T22:10:00Z",
//   "players": [
//     { "slot": 1, "player_id": "666" },
//     { "slot": 2, "player_id": "434" },
//     { "slot": 3, "player_id": "140" },
//     { "slot": 4, "player_id": "115" },
//     { "slot": 5, "player_id": "237" }
//   ]
// }
//
// ── POST /api/contests/[id]/lineup ───────────────────────────
//
// Saves (or replaces) the authenticated user's lineup as a draft.
// Does NOT lock/submit the lineup — user can still edit after saving.
// Calling this again with different players fully replaces the lineup.
//
// Validation:
//   - Contest must be "open" (status check)
//   - Current time must be before lineup_lock_at
//   - Exactly 5 players required
//   - Slots must be 1–5, each used exactly once
//   - No duplicate player_id in the same lineup
//   - Every player_id must exist in contest_players for this contest
//   - Every player must be `is_available = true` at submit time
//   - Total salary across the 5 picks must be ≤ SALARY_CAP ($42,000)
//   - Each player must be position-eligible for their assigned slot:
//       slot 1=PG, 2=SG, 3=SF, 4=PF, 5=C
//       combo positions ("PG/SG") satisfy either slot they contain
//   - Lineup must not already be "locked" or "scored"
//
// Auth: Authorization: Bearer <supabase_access_token>
//
// Sample request body:
// {
//   "players": [
//     { "slot": 1, "player_id": "666" },
//     { "slot": 2, "player_id": "434" },
//     { "slot": 3, "player_id": "140" },
//     { "slot": 4, "player_id": "115" },
//     { "slot": 5, "player_id": "237" }
//   ]
// }
//
// Sample response 200:
// { "lineup_id": "a1b2...", "status": "draft" }
//
// Error responses:
//   401 { "error": "unauthorized" }
//   400 { "error": "exactly 5 players required" }
//   400 { "error": "slots must be 1–5, each used exactly once" }
//   400 { "error": "duplicate player in lineup" }
//   400 { "error": "one or more players not in contest pool" }
//   400 { "error": "one or more players not available" }
//   400 { "error": "salary cap exceeded", total_salary, cap }
//   404 { "error": "contest_not_found" }
//   409 { "error": "contest_locked" }
//   409 { "error": "lineup_locked" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthUserId } from "@/lib/fantasy/daily/auth";
import { isEligibleForContestSlot, SLOT_LABEL } from "@/lib/fantasy/daily/positions";
import { getCanonicalPlayerPosition } from "@/lib/players/metadata";
import { SALARY_CAP, ROSTER_SIZE } from "@/lib/fantasy/daily/salary";
import { getContestSnapshot, resolveSnapshotFallback, buildSnapshotDebugRow } from "@/lib/fantasy/daily/contest-snapshot";
import { normalizeTeamCode } from "@/lib/shared/i18n";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

// ── GET ──────────────────────────────────────────────────────

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let supabase: ReturnType<typeof db>;
  try { supabase = db(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // Fetch lineup (try with points_awarded; fall back without it if migration pending).
  const contestRes = supabase.from("contests").select("date, status").eq("id", id).maybeSingle();

  let lineupRaw: any = null;
  const fullLineupRes = await supabase
    .from("user_lineups")
    .select("id, contest_id, user_id, status, total_fpts, rank, points_awarded, submitted_at")
    .eq("contest_id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (fullLineupRes.error?.message?.includes("points_awarded")) {
    const fallback = await supabase
      .from("user_lineups")
      .select("id, contest_id, user_id, status, total_fpts, rank, submitted_at")
      .eq("contest_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    if (fallback.error) return NextResponse.json({ error: fallback.error.message }, { status: 500 });
    lineupRaw = fallback.data ? { ...fallback.data, points_awarded: 0 } : null;
  } else if (fullLineupRes.error) {
    return NextResponse.json({ error: fullLineupRes.error.message }, { status: 500 });
  } else {
    lineupRaw = fullLineupRes.data;
  }

  if (!lineupRaw) return NextResponse.json({ error: "lineup_not_found" }, { status: 404 });
  const lineup  = lineupRaw as any;
  const contest = ((await contestRes).data) as any;

  // Fetch lineup players (try with actual_fantasy_points; fall back without it).
  let lineupPlayers: any[] = [];
  const lpFull = await supabase
    .from("user_lineup_players")
    .select("slot, player_id, actual_fantasy_points")
    .eq("lineup_id", lineup.id)
    .order("slot");

  if (lpFull.error?.message?.includes("actual_fantasy_points")) {
    const lpFallback = await supabase
      .from("user_lineup_players")
      .select("slot, player_id")
      .eq("lineup_id", lineup.id)
      .order("slot");
    if (lpFallback.error) return NextResponse.json({ error: lpFallback.error.message }, { status: 500 });
    lineupPlayers = (lpFallback.data ?? []).map((p: any) => ({ ...p, actual_fantasy_points: null }));
  } else if (lpFull.error) {
    return NextResponse.json({ error: lpFull.error.message }, { status: 500 });
  } else {
    lineupPlayers = lpFull.data ?? [];
  }

  const playerIds = (lineupPlayers ?? []).map((p: any) => String(p.player_id));
  const debug = new URL(req.url).searchParams.get("debug") === "1";

  // ── Read the contest snapshot — the ONE source of truth for team / name /
  // position / tier / salary. player_stats_cache is NOT consulted for any of
  // these (its team is the season-stats team and can be stale post-trade).
  const { map: snapshotMap, snapshot_available } = await getContestSnapshot(supabase, id);

  // Display fallback for legacy rows with an empty snapshot block — resolves
  // name / position / authoritative-current-roster team so no lineup player
  // renders as a raw player_id with a blank "?" avatar.
  const fallbackMap = await resolveSnapshotFallback(supabase, playerIds);

  // stats_cache_team is fetched only for the debug comparison view so an
  // operator can confirm the snapshot diverges from the stale source.
  const statsCacheTeamMap = new Map<string, string>();
  if (debug && playerIds.length) {
    const { data: pscRows } = await supabase
      .from("player_stats_cache")
      .select("player_id, team")
      .in("player_id", playerIds.map((p) => parseInt(p, 10)).filter(Number.isFinite));
    for (const r of (pscRows as any[]) ?? []) {
      statsCacheTeamMap.set(String(r.player_id), normalizeTeamCode(r.team));
    }
  }

  let anyInvalid = false;
  const enrichedPlayers = (lineupPlayers ?? []).map((p: any) => {
    const pid  = String(p.player_id);
    const snap = snapshotMap.get(pid);
    const fb   = fallbackMap.get(pid);
    // A lineup player missing from contest_players is invalid for this
    // contest — the pool was rebuilt and no longer contains them.
    const invalid = !snap;
    if (invalid) anyInvalid = true;
    return {
      slot:                   p.slot,
      slot_label:             SLOT_LABEL[p.slot as number] ?? String(p.slot),
      player_id:              p.player_id,
      name:                   snap?.display_name || fb?.name     || "",
      team:                   snap?.team         || fb?.team     || "",
      position:               snap?.position     || fb?.position || "",
      tier:                   snap?.tier         ?? null,
      salary:                 snap?.salary       ?? 0,
      projected_points:       snap?.projected_points ?? 0,
      actual_fantasy_points:  p.actual_fantasy_points ?? null,
      invalid,
      missing_snapshot_display_name: !snap?.display_name,
    };
  });

  const debugBlock = debug
    ? {
        snapshot_available,
        lineup_valid: !anyInvalid,
        players: enrichedPlayers.map((p: any) => {
          const snap = snapshotMap.get(String(p.player_id));
          if (!snap) {
            return { player_id: p.player_id, name: p.name, display_team_source: "not_in_contest_players" };
          }
          return buildSnapshotDebugRow(snap, {
            stats_cache_team: statsCacheTeamMap.get(p.player_id) ?? null,
          });
        }),
      }
    : undefined;

  return NextResponse.json({
    lineup_id:      lineup.id,
    contest_id:     lineup.contest_id,
    contest_date:   contest?.date   ?? null,
    contest_status: contest?.status ?? null,
    user_id:        lineup.user_id,
    status:         lineup.status,
    total_fpts:     lineup.total_fpts    ?? null,
    rank:           lineup.rank          ?? null,
    points_awarded: lineup.points_awarded ?? 0,
    submitted_at:   lineup.submitted_at  ?? null,
    lineup_valid:   !anyInvalid,
    players:        enrichedPlayers,
    ...(debugBlock ? { debug: debugBlock } : {}),
  });
}

// ── POST ─────────────────────────────────────────────────────

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getAuthUserId(req);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { players: { slot: number; player_id: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { players } = body;

  // ── Validate shape ────────────────────────────────────────
  if (!Array.isArray(players) || players.length !== ROSTER_SIZE) {
    return NextResponse.json({ error: "exactly 5 players required" }, { status: 400 });
  }
  const slots     = players.map((p) => p.slot);
  const playerIds = players.map((p) => p.player_id);
  const validSlots = [1, 2, 3, 4, 5];
  if (!validSlots.every((s) => slots.includes(s)) || new Set(slots).size !== ROSTER_SIZE) {
    return NextResponse.json({ error: "slots must be 1–5, each used exactly once" }, { status: 400 });
  }
  if (new Set(playerIds).size !== ROSTER_SIZE) {
    return NextResponse.json({ error: "duplicate player in lineup" }, { status: 400 });
  }

  let supabase: ReturnType<typeof db>;
  try { supabase = db(); } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // ── Guard: contest must be open and before lock time ─────
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("status, lineup_lock_at")
    .eq("id", id)
    .maybeSingle();

  if (cErr)     return NextResponse.json({ error: cErr.message }, { status: 500 });
  if (!contest) return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  if (
    contest.status === "locked" ||
    contest.status === "scored" ||
    new Date() >= new Date(contest.lineup_lock_at)
  ) {
    return NextResponse.json({ error: "contest_locked" }, { status: 409 });
  }

  // ── Guard: every player_id must be in the contest pool ───
  // Also fetch salary + availability — both required for cap validation.
  const { data: poolRows, error: poolErr } = await supabase
    .from("contest_players")
    .select("player_id, salary, is_available")
    .eq("contest_id", id)
    .in("player_id", playerIds);

  if (poolErr) return NextResponse.json({ error: poolErr.message }, { status: 500 });
  if ((poolRows?.length ?? 0) !== ROSTER_SIZE) {
    return NextResponse.json({ error: "one or more players not in contest pool" }, { status: 400 });
  }

  // ── Availability check ────────────────────────────────────
  // Re-validated on the server: a player marked unavailable between draft
  // and submit cannot be locked into the lineup.
  const unavailable = (poolRows ?? []).filter((r) => r.is_available === false);
  if (unavailable.length > 0) {
    return NextResponse.json(
      {
        error: "one or more players not available",
        player_ids: unavailable.map((r) => r.player_id),
      },
      { status: 400 },
    );
  }

  // ── Salary-cap constraint ─────────────────────────────────
  // Mirrors lib/contest-salary.ts on the client. Source of truth lives
  // in the DB row (already clamped to [3000, 12000] by the CHECK constraint
  // in migration 025), so a stale client price can't slip past.
  const totalSalary = (poolRows ?? []).reduce((sum, r) => sum + (Number(r.salary) || 0), 0);
  if (totalSalary > SALARY_CAP) {
    return NextResponse.json(
      { error: "salary cap exceeded", total_salary: totalSalary, cap: SALARY_CAP },
      { status: 400 },
    );
  }

  // ── Position-slot eligibility ─────────────────────────────
  // Position comes from the contest snapshot (contest_players.position, the
  // canonical position frozen at build time) so slot-eligibility matches what
  // the build/my-lineup pages display. player_stats_cache is only a fallback
  // for legacy rows whose snapshot predates migration 043.
  const { map: snapshotMap } = await getContestSnapshot(supabase, id);
  const posMap = new Map<string, string>();
  for (const pid of playerIds) {
    const snap = snapshotMap.get(pid);
    if (snap?.position) posMap.set(pid, snap.position);
  }

  const missingPos = playerIds.filter((pid) => !posMap.has(pid));
  if (missingPos.length > 0) {
    const { data: posRows, error: posErr } = await supabase
      .from("player_stats_cache")
      .select("player_id, name, position")
      .in("player_id", missingPos.map((id) => parseInt(id, 10)).filter(Number.isFinite));
    if (posErr) return NextResponse.json({ error: posErr.message }, { status: 500 });
    for (const r of posRows ?? []) {
      posMap.set(String(r.player_id), getCanonicalPlayerPosition(r.name ?? "", r.position ?? "N/A"));
    }
  }

  for (const pick of players) {
    const position = posMap.get(pick.player_id) ?? "N/A";
    if (!isEligibleForContestSlot(position, pick.slot)) {
      const required = SLOT_LABEL[pick.slot];
      return NextResponse.json(
        { error: `Player in slot ${pick.slot} must be a ${required} (got position: ${position})` },
        { status: 400 },
      );
    }
  }

  // ── Upsert lineup header (create or re-use existing draft) ─
  const { data: lineup, error: lineupErr } = await supabase
    .from("user_lineups")
    .upsert(
      { contest_id: id, user_id: userId, status: "draft" },
      { onConflict: "contest_id,user_id", ignoreDuplicates: false },
    )
    .select("id, status")
    .single();

  if (lineupErr) return NextResponse.json({ error: lineupErr.message }, { status: 500 });

  // Submitted lineups can still be edited before lock — only block locked/scored.
  if (lineup.status === "locked" || lineup.status === "scored") {
    return NextResponse.json({ error: "lineup_locked" }, { status: 409 });
  }

  // ── Replace players atomically ────────────────────────────
  // Delete existing then insert fresh; simple and correct for 5-row sets.
  const { error: delErr } = await supabase
    .from("user_lineup_players")
    .delete()
    .eq("lineup_id", lineup.id);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  const { error: insErr } = await supabase.from("user_lineup_players").insert(
    players.map((p) => ({ lineup_id: lineup.id, slot: p.slot, player_id: p.player_id })),
  );
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ lineup_id: lineup.id, status: "draft" });
}
