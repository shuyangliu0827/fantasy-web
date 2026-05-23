/**
 * scripts/validate-daily-contest-roster.ts
 *
 * Asserts that every player in today's daily contest player pool is on the
 * current-roster (BDL /players/active) for one of today's NBA teams.
 *
 * Usage:
 *   node --experimental-strip-types scripts/validate-daily-contest-roster.ts            # validates today
 *   node --experimental-strip-types scripts/validate-daily-contest-roster.ts 2026-05-23 # validates an explicit date
 *
 * Exit codes:
 *   0  All contest_players are on the current roster of a team playing today.
 *   1  Validation failed — one or more stale-roster players found.
 *   2  Setup error (missing env vars, no contest, no games, etc).
 *
 * Env vars required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   BDL_API_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { getGames } from "../lib/nba/balldontlie.ts";
import { normalizeTeamCode } from "../lib/shared/i18n.ts";
import { getCurrentRosterForTeams } from "../lib/nba/current-roster.ts";

function die(code: number, msg: string): never {
  console.error(msg);
  process.exit(code);
}

async function main() {
  const dateArg = process.argv[2];
  const date    = dateArg && /^\d{4}-\d{2}-\d{2}$/.test(dateArg)
    ? dateArg
    : new Date().toISOString().slice(0, 10);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) die(2, "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabase = createClient(url, key);

  // 1. Find the contest for the date.
  const { data: contest, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status")
    .eq("date", date)
    .maybeSingle();
  if (cErr)    die(2, `Contest lookup failed: ${cErr.message}`);
  if (!contest) die(2, `No contest found for ${date}`);

  // 2. Resolve today's playing teams from BDL.
  const { data: games } = await getGames({ dates: [date] });
  const playingTeams = new Set<string>();
  for (const g of games ?? []) {
    if (g.home_team?.abbreviation)    playingTeams.add(normalizeTeamCode(g.home_team.abbreviation));
    if (g.visitor_team?.abbreviation) playingTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
  }
  if (playingTeams.size === 0) die(2, `No BDL games found for ${date}`);

  // 3. Load contest_players for that contest, enriched with stats-cache team.
  const { data: cp, error: cpErr } = await supabase
    .from("contest_players")
    .select("player_id")
    .eq("contest_id", contest.id);
  if (cpErr) die(2, `contest_players lookup failed: ${cpErr.message}`);
  if (!cp || cp.length === 0) die(2, `Contest ${contest.id} has no contest_players`);

  const intIds = cp.map((r: { player_id: string }) => parseInt(r.player_id, 10)).filter(Number.isFinite);
  const { data: stats } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, team")
    .in("player_id", intIds);
  const statsByPid = new Map<string, { name: string; team: string }>();
  for (const s of stats ?? []) {
    statsByPid.set(String(s.player_id), { name: s.name, team: s.team });
  }

  // 4. Resolve current rosters for today's teams.
  const rosterResult = await getCurrentRosterForTeams(supabase, playingTeams, { allowStale: false });
  if (rosterResult.roster_source_used === "unavailable") {
    die(2, `Current roster source unavailable (sync_error=${rosterResult.sync_error}); cannot validate`);
  }

  // 5. Cross-check every contest player.
  const invalid: {
    player_id: string;
    name:      string;
    contest_team:        string;
    current_roster_team: string | null;
    reason:    string;
  }[] = [];

  for (const row of cp) {
    const stats    = statsByPid.get(row.player_id);
    const cacheTeam= stats?.team ? normalizeTeamCode(stats.team) : null;
    const rosterEntry = rosterResult.map.get(row.player_id);

    if (!rosterEntry) {
      invalid.push({
        player_id: row.player_id,
        name:      stats?.name ?? "(unknown)",
        contest_team:        cacheTeam ?? "(unknown)",
        current_roster_team: null,
        reason:    "no_current_roster",
      });
      continue;
    }
    if (!playingTeams.has(rosterEntry.current_team)) {
      invalid.push({
        player_id: row.player_id,
        name:      rosterEntry.player_name,
        contest_team:        cacheTeam ?? "(unknown)",
        current_roster_team: rosterEntry.current_team,
        reason:    "team_not_playing_today",
      });
      continue;
    }
    // Note: stale stats-cache team is NOT an invalid case — current roster
    // wins. We just report it as informational.
  }

  const teamsPlayingList = [...playingTeams].sort().join(", ");
  if (invalid.length === 0) {
    console.log(`PASS:`);
    console.log(`${cp.length} contest players checked.`);
    console.log(`${cp.length}/${cp.length} are on current rosters for ${teamsPlayingList}.`);
    console.log(`Roster source: ${rosterResult.roster_source_used} (updated_at=${rosterResult.source_updated_at})`);
    process.exit(0);
  } else {
    console.log(`FAIL:`);
    console.log(`${invalid.length} invalid players found:`);
    for (const p of invalid) {
      console.log(`- ${p.name}: contest_team=${p.contest_team}, current_roster_team=${p.current_roster_team}, reason=${p.reason}`);
    }
    console.log(`Roster source: ${rosterResult.roster_source_used} (updated_at=${rosterResult.source_updated_at})`);
    console.log(`Today's teams: ${teamsPlayingList}`);
    process.exit(1);
  }
}

main().catch((err) => die(2, `Unexpected: ${err instanceof Error ? err.stack : String(err)}`));
