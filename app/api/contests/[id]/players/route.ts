export const dynamic = "force-dynamic";
// app/api/contests/[id]/players/route.ts
//
// GET /api/contests/[id]/players
//
// Returns the player pool for the contest. Public — no auth required.
//
// ── Player identity ───────────────────────────────────────────
// contest_players.player_id is TEXT = String(bdl_integer_id), matching
// player_day_stats.player_id exactly.  Display metadata (name, team,
// position, fpts_avg, injury) comes from player_stats_cache, joined by
// casting: player_stats_cache.player_id = contest_players.player_id::integer
//
// ── Pool size ─────────────────────────────────────────────────
// MVP pool is capped at the top 80 players by rank (4 tiers),
// excluding 'Out' injuries.  Populated at contest creation time.
// This route simply reads what is stored — no dynamic filtering.
//
// ── Sample response 200 ──────────────────────────────────────
// {
//   "contest_id": "b1c2d3e4-...",
//   "status": "open",
//   "players": [
//     {
//       "player_id": "666",
//       "tier": 1,                      // display/filter only — no longer enforced
//       "fpts_scored": null,
//       "name": "Nikola Jokic",
//       "team": "DEN",
//       "position": "C",
//       "fpts_avg": 62.4,
//       "salary": 12000,                // $3000-$12000, snapped to $100
//       "projected_points": 50.2,       // 0.6*last5 + 0.4*season
//       "last_5_avg_fp": 55.4,
//       "season_avg_fp": 62.4,
//       "value": 4.18,                  // projected_points / salary * 1000
//       "injury": null,
//       "injury_status": null,
//       "is_available": true
//     },
//     ...
//   ]
// }
//
// ── Sample response 404 ──────────────────────────────────────
// { "error": "contest_not_found" }

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCanonicalPlayerPosition } from "@/lib/players/metadata";
import { calcFantasyPoints } from "@/lib/fantasy/shared/scoring-config";
import { calcProjectedPoints, calcSalary, calcValue } from "@/lib/fantasy/daily/salary";
import { getGames } from "@/lib/nba/balldontlie";
import { normalizeTeamCode } from "@/lib/shared/i18n";
import { getCurrentRosterForTeams } from "@/lib/nba/current-roster";
import { isOutOrInactive, assignTiersByProjection } from "@/lib/fantasy/daily/pool-builder";
import { getContestSnapshot } from "@/lib/fantasy/daily/contest-snapshot";

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = db();

  // Verify contest exists (include date for schedule validation)
  const { data: contest, error: contestErr } = await supabase
    .from("contests")
    .select("id, status, date")
    .eq("id", id)
    .maybeSingle();

  if (contestErr) return NextResponse.json({ error: contestErr.message }, { status: 500 });
  if (!contest)   return NextResponse.json({ error: "contest_not_found" }, { status: 404 });

  // Read the contest snapshot — the ONE source of truth for team / name /
  // position / tier / salary / projection (migration 043). Reads through the
  // shared helper so a stale deploy (migration not yet applied) degrades
  // gracefully instead of 500-ing this baseline page.
  const { rows: pool, snapshot_available, error: poolErr } = await getContestSnapshot(supabase, id);

  if (poolErr) return NextResponse.json({ error: poolErr }, { status: 500 });
  if (!pool || pool.length === 0) {
    return NextResponse.json({ contest_id: id, status: contest.status, players: [] });
  }

  // player_stats_cache is consulted ONLY for stats (fpts_avg) and live injury —
  // never for the current team. contest_players.player_id is TEXT ("123");
  // player_stats_cache.player_id is INTEGER. Cast TEXT → integer for the IN query.
  const intIds = pool.map((r) => parseInt(r.player_id, 10)).filter(Number.isFinite);

  // Select all 11 per-game average columns so fpts_avg is computed at
  // read time via calcFantasyPoints — identical to how nba-stats/route.ts
  // produces its fpts_avg, ensuring consistent values across pages.
  const { data: statsRows, error: statsErr } = await supabase
    .from("player_stats_cache")
    .select("player_id, name, team, position, pts_avg, fgm_avg, fga_avg, fg3m_avg, ftm_avg, fta_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg, injury")
    .in("player_id", intIds);

  if (statsErr) return NextResponse.json({ error: statsErr.message }, { status: 500 });

  // Build lookup: integer id → display row
  const statsMap = new Map<number, typeof statsRows[0]>();
  for (const row of statsRows ?? []) statsMap.set(row.player_id, row);

  const players = pool.map((cp) => {
    const intId = parseInt(cp.player_id, 10);
    const meta  = statsMap.get(intId);
    const projected = cp.projected_points;
    const salary    = cp.salary;
    return {
      player_id:        cp.player_id,           // TEXT — consistent with rest of contest system
      tier:             cp.tier,
      fpts_scored:      cp.fpts_scored ?? null, // null until scoring job runs
      // Display fields from the contest snapshot. player_stats_cache is a
      // legacy fallback only (pre-043 rows), and its team is NEVER used —
      // the current-roster override below is the authoritative team source.
      name:             cp.display_name || meta?.name || "",
      team:             cp.team || meta?.team || "",
      position:         cp.position || getCanonicalPlayerPosition(meta?.name ?? "", meta?.position ?? "N/A"),
      // Compute fpts_avg from the 11 avg stat fields, matching the nba-stats
      // read path exactly (same calcFantasyPoints call, same ESPN_DEFAULT_WEIGHTS).
      fpts_avg: meta ? Math.round(calcFantasyPoints({
        pts:  meta.pts_avg  || 0,
        fgm:  meta.fgm_avg  || 0,
        fga:  meta.fga_avg  || 0,
        fg3m: meta.fg3m_avg || 0,
        ftm:  meta.ftm_avg  || 0,
        fta:  meta.fta_avg  || 0,
        reb:  meta.reb_avg  || 0,
        ast:  meta.ast_avg  || 0,
        stl:  meta.stl_avg  || 0,
        blk:  meta.blk_avg  || 0,
        tov:  meta.tov_avg  || 0,
      }) * 10) / 10 : (cp.season_avg_fp || 0),
      injury:           meta?.injury ?? null,
      // Salary-cap fields populated by migration 025 + contest-pool-builder.
      salary,
      projected_points: projected,
      last_5_avg_fp:    cp.last_5_avg_fp,
      season_avg_fp:    cp.season_avg_fp,
      value:            Math.round(calcValue(projected, salary) * 100) / 100,
      injury_status:    meta?.injury ?? cp.injury_status ?? null,
      // is_available: override the frozen seed-time snapshot with the live
      // player_stats_cache.injury value.  contest_players.is_available is
      // always written as `true` at seed time so cannot be trusted at
      // read time.  A player whose injury starts with "out"/"inactive"
      // (case-insensitive) is marked unavailable regardless of what was seeded.
      is_available: !isOutOrInactive(meta?.injury),
      // Snapshot provenance — surfaced in ?debug=1 output only.
      roster_source:       cp.roster_source,
      roster_validated_at: cp.roster_validated_at,
      contest_snapshot_team: cp.team || null,
    };
  });

  // ── Real-time schedule validation ─────────────────────────────
  // For pending/open contests, re-fetch the current BDL schedule for this
  // date and filter out players from teams whose games have been removed
  // (e.g. eliminated playoff teams whose if-necessary game no longer exists).
  // Scored/locked contests are left unfiltered — historical data is correct.
  const contestDate = (contest as any).date as string | null;
  const needsValidation = contestDate && contest.status !== "scored" && contest.status !== "locked";

  if (needsValidation) {
    let latestActiveTeams: Set<string> | null = null;
    let bdlAvailable = false;

    try {
      const { data: games } = await getGames({ dates: [contestDate!] });
      latestActiveTeams = new Set<string>();
      bdlAvailable = true;
      for (const g of games ?? []) {
        if (g.home_team?.abbreviation)    latestActiveTeams.add(normalizeTeamCode(g.home_team.abbreviation));
        if (g.visitor_team?.abbreviation) latestActiveTeams.add(normalizeTeamCode(g.visitor_team.abbreviation));
      }
    } catch {
      // BDL unavailable — return stale pool without filtering so users
      // aren't blocked by a transient API outage.
    }

    if (latestActiveTeams !== null) {
      // ── Authoritative current-roster gate ─────────────────────────
      // player_stats_cache.team is the *season-stats* team and can be
      // stale post-trade. The current-roster table (mirrored from
      // BDL /players/active) is the only source we trust for "is player
      // X currently on team Y?".
      const rosterResult = await getCurrentRosterForTeams(supabase, latestActiveTeams);

      // Override the per-player team using current_roster. The pool was
      // built with current_roster, so this is usually a no-op, but it
      // also corrects display for older contests built before this gate.
      const stalePlayersByPid = new Map<string, string>();   // pid -> stats_cache_team (for trace)
      for (const p of players) {
        stalePlayersByPid.set(p.player_id, p.team);
        const rosterEntry = rosterResult.map.get(p.player_id);
        if (rosterEntry) {
          // current_roster wins — display & filter use this value.
          p.team = rosterEntry.current_team;
        }
      }

      // ── Lazy gap fill ──────────────────────────────────────────────
      // For pending/open contests, add players who are on a current
      // roster for today's teams but missing from contest_players (e.g.,
      // injured players who have since recovered, or rosters synced
      // after the contest was first built).
      //
      // Only consults the current-roster table for membership — never
      // player_stats_cache.team.
      if (latestActiveTeams.size > 0 && rosterResult.roster_source_used !== "unavailable") {
        const poolPlayerIds = new Set(pool.map((r) => r.player_id));
        const missingIds: number[] = [];
        for (const [pidStr] of rosterResult.map) {
          if (poolPlayerIds.has(pidStr)) continue;
          const n = parseInt(pidStr, 10);
          if (Number.isFinite(n)) missingIds.push(n);
        }

        if (missingIds.length > 0) {
          const { data: gapCandidates } = await supabase
            .from("player_stats_cache")
            .select("player_id, name, team, fpts_avg, pts_avg, fgm_avg, fga_avg, fg3m_avg, ftm_avg, fta_avg, reb_avg, ast_avg, stl_avg, blk_avg, tov_avg, injury, position")
            .in("player_id", missingIds)
            .gt("fpts_avg", 0);

          const missing = (gapCandidates ?? []).filter((r) => {
            if (isOutOrInactive(r.injury)) return false;
            return rosterResult.map.has(String(r.player_id));
          });

          if (missing.length > 0) {
            // Push gap-fill players into the in-memory pool with a PROVISIONAL
            // tier. The real tier is assigned below by re-ranking the FINAL
            // full pool (original + gap-fill) by projection — never a hard 4.
            for (const r of missing) {
              const rosterEntry = rosterResult.map.get(String(r.player_id));
              // Strict: gap-fill candidates without a current_roster entry
              // were already filtered out above. Keep the guard here too so
              // the stats-cache team can never sneak in.
              if (!rosterEntry) continue;
              const fpts        = Number(r.fpts_avg) || 0;
              const projected   = calcProjectedPoints(fpts, fpts);
              const salary      = calcSalary(projected);
              players.push({
                player_id:        String(r.player_id),
                tier:             4, // provisional — overwritten by re-tier below
                fpts_scored:      null,
                name:             rosterEntry.player_name ?? r.name ?? "",
                team:             rosterEntry.current_team,
                position:         getCanonicalPlayerPosition(r.name ?? "", r.position ?? "N/A"),
                fpts_avg: Math.round(calcFantasyPoints({
                  pts:  r.pts_avg  || 0,
                  fgm:  r.fgm_avg  || 0,
                  fga:  r.fga_avg  || 0,
                  fg3m: r.fg3m_avg || 0,
                  ftm:  r.ftm_avg  || 0,
                  fta:  r.fta_avg  || 0,
                  reb:  r.reb_avg  || 0,
                  ast:  r.ast_avg  || 0,
                  stl:  r.stl_avg  || 0,
                  blk:  r.blk_avg  || 0,
                  tov:  r.tov_avg  || 0,
                }) * 10) / 10,
                injury:           r.injury ?? null,
                salary,
                projected_points: Math.round(projected * 100) / 100,
                last_5_avg_fp:    Math.round(fpts * 100) / 100,
                season_avg_fp:    Math.round(fpts * 100) / 100,
                value:            Math.round(calcValue(projected, salary) * 100) / 100,
                injury_status:    r.injury ?? null,
                is_available:     true,
                roster_source:       rosterResult.roster_source_used,
                roster_validated_at: rosterResult.source_updated_at,
                contest_snapshot_team: rosterEntry.current_team,
              });
              stalePlayersByPid.set(String(r.player_id), normalizeTeamCode(r.team));
            }

            // ── Re-tier the FINAL full pool by projection ───────────────
            // Quartile buckets over (original pool + gap-fill) so a strong
            // gap-filled player lands in the tier their projection earns —
            // not a hard-coded T4.
            assignTiersByProjection(players);

            // Persist the final snapshot (tier + display block) for every
            // player so my-lineup / leaderboard / my-lineups / settler read
            // the same tiers the build page validates against. This both
            // inserts the new gap rows and corrects any shifted tiers /
            // missing display fields on existing rows in one idempotent write.
            const persistRows = players.map((p) => ({
              contest_id:          id,
              player_id:           p.player_id,
              tier:                p.tier,
              salary:              p.salary,
              projected_points:    p.projected_points,
              last_5_avg_fp:       p.last_5_avg_fp,
              season_avg_fp:       p.season_avg_fp,
              display_name:        p.name,
              team:                p.team,
              position:            p.position,
              roster_source:       (p as any).roster_source ?? rosterResult.roster_source_used,
              roster_validated_at: (p as any).roster_validated_at ?? rosterResult.source_updated_at,
            }));
            await supabase
              .from("contest_players")
              .upsert(persistRows, { onConflict: "contest_id,player_id" });
          }
        }
      }

      const seededTeams = [...new Set(players.map((p) => p.team).filter(Boolean))];
      const noConfirmedGames = latestActiveTeams.size === 0;
      const rosterAvailable  = rosterResult.roster_source_used !== "unavailable";

      // STRICT eligibility with current-roster gate:
      //   1. current-roster must say the player is on a playing team
      //   2. team must be in latestActiveTeams (game today)
      //   3. injury must not be "Out"/"Inactive"
      //
      // If the current-roster source is unavailable we do NOT fall back to
      // player_stats_cache.team — that's exactly the stale source this
      // gate exists to replace. Instead, return the seeded pool as-is
      // (which was built under the strict gate at seed time) and flag
      // `roster_validation_skipped` in the response.
      const rosterValidationSkipped = !rosterAvailable;
      const filteredPlayers = noConfirmedGames
        ? []
        : !rosterAvailable
          ? players.filter((p) => !isOutOrInactive(p.injury_status ?? p.injury))
          : players.filter((p) => {
              const rosterEntry = rosterResult.map.get(p.player_id);
              if (!rosterEntry) return false;                                      // no_current_roster
              if (!latestActiveTeams!.has(rosterEntry.current_team)) return false; // team_not_playing_today
              if (isOutOrInactive(p.injury_status ?? p.injury)) return false;
              return true;
            });

      const removedStaleTeams = seededTeams.filter(
        (t) => t && !latestActiveTeams!.has(normalizeTeamCode(t)),
      );

      // Per-player diagnostics — only when ?debug=1 to keep responses small.
      const url     = new URL(req.url);
      const verbose = url.searchParams.get("debug") === "1";

      type Trace = {
        player_id:                 string;
        name:                      string;
        // ── Source-comparison fields (daily-contest consistency spec) ──
        contest_snapshot_team:     string | null;
        display_team:              string | null;
        display_team_source:       string;
        stats_cache_team:          string | null;
        player_profile_team:       string | null;
        contest_snapshot_tier:     number | null;
        display_tier:              number | null;
        display_tier_source:       string;
        roster_source:             string | null;
        roster_validated_at:       string | null;
        // ── Eligibility trace ──────────────────────────────────────────
        current_roster_team:       string | null;
        team_used_for_eligibility: string | null;
        position:                  string | null;
        team_normalized:           string | null;
        game_today:                boolean;
        injury_status:             string | null;
        fpts_avg:                  number;
        projected_fpts:            number;
        salary:                    number;
        rank_overall:              number;
        tier:                      number | null;
        assigned_tier:             number | null;
        reason_included:           string | null;
        reason_excluded:           string | null;
      };

      // Rank players by projected_points DESC so each trace row carries
      // the same rank the tier was computed from.
      const rankedIds = [...players]
        .sort((a, b) => (b.projected_points ?? 0) - (a.projected_points ?? 0))
        .map((p) => p.player_id);
      const rankByPid = new Map<string, number>();
      rankedIds.forEach((pid, idx) => rankByPid.set(pid, idx + 1));

      const trace: Trace[] | undefined = verbose
        ? players.map((p) => {
            const stalePid    = stalePlayersByPid.get(p.player_id) ?? null;
            const rosterEntry = rosterResult.map.get(p.player_id);
            const currentTeam = rosterEntry?.current_team ?? null;
            // When current-roster source is unavailable we explicitly do
            // NOT fall back to stats_cache.team for eligibility — surface
            // null so debug consumers can see the gap.
            const teamUsed    = rosterAvailable ? currentTeam : null;
            const out         = isOutOrInactive(p.injury_status ?? p.injury);
            const inActive    = !!(teamUsed && latestActiveTeams!.has(teamUsed));

            let reason_excluded: string | null = null;
            let reason_included: string | null = null;
            if (rosterAvailable && !rosterEntry)               reason_excluded = "no_current_roster";
            else if (rosterAvailable && !inActive)             reason_excluded = "team_not_playing_today";
            else if (out)                                      reason_excluded = "out_or_inactive";
            else if (stalePid && currentTeam && stalePid !== currentTeam) reason_included = "current_roster_overrides_stale_stats_cache_team";
            else                                               reason_included = "current_roster_match";

            const snapshotTeam = (p as any).contest_snapshot_team ?? null;
            return {
              player_id:                 p.player_id,
              name:                      p.name,
              contest_snapshot_team:     snapshotTeam,
              display_team:              p.team,
              // The displayed team comes from the snapshot when present; the
              // current-roster override is the authoritative live correction.
              display_team_source:       snapshotTeam
                                           ? "contest_players"
                                           : (currentTeam ? "current_roster_override" : "missing_snapshot"),
              stats_cache_team:          stalePid,
              player_profile_team:       null, // no separate NBA profile table
              contest_snapshot_tier:     p.tier ?? null,
              display_tier:              p.tier ?? null,
              display_tier_source:       p.tier != null ? "contest_players" : "missing_snapshot",
              roster_source:             (p as any).roster_source ?? rosterResult.roster_source_used,
              roster_validated_at:       (p as any).roster_validated_at ?? rosterResult.source_updated_at,
              current_roster_team:       currentTeam,
              team_used_for_eligibility: teamUsed,
              position:                  p.position,
              team_normalized:           teamUsed,
              game_today:                inActive,
              injury_status:             p.injury_status ?? p.injury ?? null,
              fpts_avg:                  p.fpts_avg,
              projected_fpts:            p.projected_points ?? 0,
              salary:                    p.salary ?? 0,
              rank_overall:              rankByPid.get(p.player_id) ?? -1,
              tier:                      p.tier ?? null,
              assigned_tier:             p.tier ?? null,
              reason_included,
              reason_excluded,
            };
          })
        : undefined;

      const debug = {
        contestDate,
        snapshot_available,
        roster_source_used:         rosterResult.roster_source_used,
        roster_source_updated_at:   rosterResult.source_updated_at,
        roster_sync_attempted:      rosterResult.sync_attempted,
        roster_sync_error:          rosterResult.sync_error,
        roster_players_loaded:      rosterResult.total_players,
        roster_players_by_team:     rosterResult.rows_by_team,
        seededTeams,
        latestActiveTeams:          [...latestActiveTeams].sort(),
        teams_playing_today:        [...latestActiveTeams].sort(),
        removedStaleTeams,
        playersBeforeFilter:        players.length,
        playersAfterFilter:         filteredPlayers.length,
        staleRowsFound:             players.length - filteredPlayers.length,
        noConfirmedGames,
        bdlAvailable,
        ...(trace ? { perPlayerTrace: trace } : {}),
      };

      return NextResponse.json({
        contest_id: id,
        status:     contest.status,
        players:    filteredPlayers,
        noConfirmedGames,
        roster_source_used: rosterResult.roster_source_used,
        roster_validation_skipped: rosterValidationSkipped,
        debug,
      });
    }
  }

  return NextResponse.json({ contest_id: id, status: contest.status, players });
}
