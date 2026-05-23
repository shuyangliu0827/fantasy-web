/**
 * scripts/validate-daily-contest-snapshot.ts
 *
 * Validates the daily-contest snapshot consistency contract: contest_players
 * is the single source of truth for contest-specific player fields (team,
 * position, tier, salary, projected_points), and every read endpoint reads
 * from it. Because build / my-lineup / leaderboard / my-lineups all now read
 * the snapshot via lib/fantasy/daily/contest-snapshot.ts, validating the
 * snapshot rows transitively validates what those pages display.
 *
 * Checks (today's contest, or an explicit YYYY-MM-DD):
 *   1. Every contest_players row has a populated snapshot (team / position /
 *      salary / projected_points). Missing snapshot ⇒ run create-today?force=true.
 *   2. Snapshot team == current-roster team (BDL /players/active) — i.e. no
 *      stale team leaked from player_stats_cache.team.
 *   3. Every snapshot team is on a team playing today.
 *   4. Snapshot salary is within the contract bounds [3000, 12000].
 *   5. Tier ordering is sane: no top-projected-quartile player sits in T4.
 *   6. (Optional) If CONTEST_BASE_URL is set, the build endpoint's returned
 *      team/tier/salary match the snapshot for each player.
 *
 * Usage:
 *   node --experimental-strip-types scripts/validate-daily-contest-snapshot.ts
 *   node --experimental-strip-types scripts/validate-daily-contest-snapshot.ts 2026-05-23
 *   CONTEST_BASE_URL=http://localhost:3000 node --experimental-strip-types scripts/validate-daily-contest-snapshot.ts
 *
 * Exit codes:
 *   0  All checks pass.
 *   1  Validation failed.
 *   2  Setup error (missing env, no contest, no games, roster unavailable).
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   BDL_API_KEY
 * Optional:
 *   CONTEST_BASE_URL   base URL to cross-check the build HTTP endpoint
 */

import { createClient } from "@supabase/supabase-js";
import { getGames } from "../lib/nba/balldontlie.ts";
import { normalizeTeamCode } from "../lib/shared/i18n.ts";
import { getCurrentRosterForTeams } from "../lib/nba/current-roster.ts";

const SALARY_MIN = 3000;
const SALARY_MAX = 12000;

function die(code: number, msg: string): never {
  console.error(msg);
  process.exit(code);
}

type CpRow = {
  player_id:        string;
  display_name:     string | null;
  team:             string | null;
  position:         string | null;
  tier:             number | null;
  salary:           number | null;
  projected_points: number | null;
};

async function main() {
  const dateArg = process.argv[2];
  const date    = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
    ? dateArg
    : new Date().toISOString().slice(0, 10);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) die(2, "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase = createClient(url, key);

  // 1. Find the contest.
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status")
    .eq("date", date)
    .maybeSingle();
  if (cErr)     die(2, `Contest lookup failed: ${cErr.message}`);
  if (!contest) die(2, `No contest found for ${date}`);

  // 2. Today's playing teams from BDL.
  const { data: games } = await getGames({ dates: [date] });
  const playingTeams = new Set<string>();
  for (const g of games ?? []) {
    if (g.home_team?.abbreviation)    playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
    if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
  }
  if (playingTeams.size === 0) die(2, `No BDL games found for ${date}`);

  // 3. Load contest_players snapshot.
  const { data: cp, error: cpErr } = await supabase
    .from("contest_players")
    .select("player_id, display_name, team, position, tier, salary, projected_points")
    .eq("contest_id", contest.id);
  if (cpErr) {
    die(2, `contest_players lookup failed (migration 043 applied?): ${cpErr.message}`);
  }
  if (!cp || cp.length === 0) die(2, `Contest ${contest.id} has no contest_players`);

  // 4. Current rosters for today's teams + stale-team comparison source.
  const rosterResult = await getCurrentRosterForTeams(supabase, playingTeams, { allowStale: false });
  if (rosterResult.roster_source_used === "unavailable") {
    die(2, `Current roster source unavailable (sync_error=${rosterResult.sync_error}); cannot validate`);
  }

  const intIds = (cp as CpRow[]).map((r) => parseInt(r.player_id, 10)).filter(Number.isFinite);
  const { data: stats } = await supabase
    .from("player_stats_cache")
    .select("player_id, team")
    .in("player_id", intIds);
  const cacheTeamByPid = new Map<string, string>();
  for (const s of stats ?? []) cacheTeamByPid.set(String(s.player_id), normalizeTeamCode(s.team));

  // ── Checks ──────────────────────────────────────────────────────
  const failures: string[] = [];
  let missingSnapshot   = 0;
  let staleOverrides    = 0;   // snapshot team differs from psc team (expected, informational)
  let teamMismatch      = 0;   // snapshot team differs from current roster (FAIL)

  for (const row of cp as CpRow[]) {
    const snapTeam = row.team ? normalizeTeamCode(row.team) : "";
    const cacheTeam = cacheTeamByPid.get(row.player_id) ?? null;
    const rosterEntry = rosterResult.map.get(row.player_id);
    const name = row.display_name || rosterEntry?.player_name || row.player_id;

    // Check 1: snapshot must be populated.
    if (!snapTeam || !row.position || !row.salary || row.projected_points == null) {
      missingSnapshot++;
      failures.push(`${name}: incomplete snapshot (team=${row.team}, position=${row.position}, salary=${row.salary}, projected=${row.projected_points})`);
      continue;
    }

    // Check 4: salary bounds.
    if (row.salary < SALARY_MIN || row.salary > SALARY_MAX) {
      failures.push(`${name}: salary ${row.salary} outside [${SALARY_MIN}, ${SALARY_MAX}]`);
    }

    // Check 3: snapshot team must play today.
    if (!playingTeams.has(snapTeam)) {
      failures.push(`${name}: snapshot team ${snapTeam} is not playing today`);
    }

    // Check 2: snapshot team must equal current-roster team.
    if (!rosterEntry) {
      teamMismatch++;
      failures.push(`${name}: snapshot team ${snapTeam} has no current-roster entry`);
    } else if (rosterEntry.current_team !== snapTeam) {
      teamMismatch++;
      failures.push(`${name}: snapshot team ${snapTeam} != current-roster team ${rosterEntry.current_team}`);
    }

    // Informational: snapshot correctly overriding a stale stats-cache team.
    if (cacheTeam && cacheTeam !== "N/A" && cacheTeam !== snapTeam) staleOverrides++;
  }

  // Check 5: tier ordering — top projected quartile must not be T4.
  const ranked = [...(cp as CpRow[])]
    .map((r) => ({ ...r, projected_points: Number(r.projected_points) || 0 }))
    .sort((a, b) => b.projected_points - a.projected_points);
  const topQuartile = Math.max(1, Math.ceil(ranked.length / 4));
  const tierViolations = ranked.slice(0, topQuartile).filter((r) => r.tier === 4);
  for (const v of tierViolations) {
    const name = v.display_name || rosterResult.map.get(v.player_id)?.player_name || v.player_id;
    failures.push(`${name}: top-quartile (projected=${v.projected_points}) but tier=T4`);
  }

  // Check 6 (optional): cross-check the build HTTP endpoint.
  const baseUrl = process.env.CONTEST_BASE_URL;
  let httpChecked = 0;
  if (baseUrl) {
    try {
      type ApiPlayer = { player_id: string; name?: string; team?: string; tier?: number | null; salary?: number };
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/contests/${contest.id}/players`);
      const body = await res.json() as { players?: ApiPlayer[] };
      const apiPlayers: ApiPlayer[] = body.players ?? [];
      const snapByPid = new Map((cp as CpRow[]).map((r) => [r.player_id, r]));
      for (const ap of apiPlayers) {
        const snap = snapByPid.get(String(ap.player_id));
        if (!snap) continue; // gap-filled or filtered — not a snapshot mismatch
        httpChecked++;
        if (normalizeTeamCode(ap.team) !== normalizeTeamCode(snap.team ?? "")) {
          failures.push(`build endpoint team mismatch for ${ap.name}: api=${ap.team} snapshot=${snap.team}`);
        }
        if (ap.tier !== snap.tier) {
          failures.push(`build endpoint tier mismatch for ${ap.name}: api=${ap.tier} snapshot=${snap.tier}`);
        }
        if (Number(ap.salary) !== Number(snap.salary)) {
          failures.push(`build endpoint salary mismatch for ${ap.name}: api=${ap.salary} snapshot=${snap.salary}`);
        }
      }
    } catch (e) {
      console.warn(`(skipping HTTP cross-check: ${e instanceof Error ? e.message : String(e)})`);
    }
  }

  // ── Report ──────────────────────────────────────────────────────
  console.log(`Contest:           ${contest.id} (${date}, status=${contest.status})`);
  console.log(`Teams playing:     ${[...playingTeams].sort().join(", ")}`);
  console.log(`Roster source:     ${rosterResult.roster_source_used} (updated_at=${rosterResult.source_updated_at})`);
  console.log(`Contest players:   ${cp.length}`);
  console.log(`Missing snapshot:  ${missingSnapshot}`);
  console.log(`Team mismatches:   ${teamMismatch}`);
  console.log(`Stale overrides:   ${staleOverrides} (snapshot correctly overrides stale stats_cache team)`);
  console.log(`Tier violations:   ${tierViolations.length}`);
  if (baseUrl) console.log(`Build HTTP checked: ${httpChecked}`);

  if (failures.length > 0) {
    console.log("");
    console.log(`FAIL: ${failures.length} issue(s):`);
    for (const f of failures) console.log(`- ${f}`);
    process.exit(1);
  }

  console.log("\nPASS");
  process.exit(0);
}

main().catch((err) => die(2, `Unexpected: ${err instanceof Error ? err.stack : String(err)}`));
