/**
 * scripts/repair-daily-contest-snapshots.ts
 *
 * Backfill / repair the daily-contest snapshot (migration 043) on existing
 * contest_players rows so every read endpoint (build / my-lineup / leaderboard
 * / my-lineups / settler) shows real names, teams, positions and tiers instead
 * of raw player_ids, blank "?" avatars, and gap-filled T4s.
 *
 * What it does, per NBA contest in [today-14, today+7]:
 *   1. Loads contest_players.
 *   2. Finds rows with a missing snapshot (display_name / team / position).
 *   3. Resolves metadata from the SAME canonical sources the pool-builder uses:
 *        - team: nba_player_current_team (authoritative current roster) first,
 *                player_stats_cache.team only as a flagged last resort.
 *        - name: current-roster name → player_stats_cache name.
 *        - position: canonical position via lib/players/metadata.
 *   4. Re-tiers the FULL pool by projected_points DESC (quartile buckets) so a
 *      strong gap-filled player is never stuck at T4.
 *   5. Updates contest_players in place (only changed rows).
 *
 * Prints a summary: contests scanned, rows repaired, rows still unresolved,
 * and example unresolved player_ids.
 *
 * Run (matches the existing project script convention — no @ alias issue,
 * no extra dependency; bare `node` cannot resolve the @/ alias so we use
 * relative imports + --experimental-strip-types):
 *
 *   npm run repair:contest-snapshots
 *   # or an explicit window override:
 *   REPAIR_DAYS_BACK=30 REPAIR_DAYS_FWD=7 npm run repair:contest-snapshots
 *   # dry run (no writes):
 *   REPAIR_DRY_RUN=1 npm run repair:contest-snapshots
 *
 * Env vars:
 *   NEXT_PUBLIC_SUPABASE_URL        (required)
 *   SUPABASE_SERVICE_ROLE_KEY       (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   REPAIR_DAYS_BACK                (optional, default 14)
 *   REPAIR_DAYS_FWD                 (optional, default 7)
 *   REPAIR_DRY_RUN                  (optional, "1" to skip writes)
 *
 * Exit codes: 0 success, 2 setup error.
 */

import { createClient } from "@supabase/supabase-js";
import { normalizeTeamCode } from "../lib/shared/i18n.ts";

function die(code: number, msg: string): never {
  console.error(msg);
  process.exit(code);
}

// Canonical position normalization — mirrors lib/players/metadata.ts
// (normalizePosition). Inlined because that module imports "./positions"
// extensionlessly, which bare `node --experimental-strip-types` cannot
// resolve. The PLAYER_POSITIONS override map is intentionally omitted: the
// repair backfill normalizes the raw player_stats_cache.position, which is
// correct for the overwhelming majority of players; the build path applies
// the full override map on rebuild.
const POSITION_ORDER: Record<string, number> = { PG: 1, SG: 2, SF: 3, PF: 4, C: 5 };
const CANONICAL_PAIRS = new Set(["PG/SG", "SG/SF", "SF/PF", "PF/C"]);

function getCanonicalPlayerPosition(_name: string, raw?: string): string {
  if (!raw) return "N/A";
  const clean = raw.toUpperCase().replace(/\s+/g, "");
  if (clean === "G") return "PG/SG";
  if (clean === "F") return "SF/PF";
  if (clean === "G-F" || clean === "F-G") return "SG/SF";
  if (clean === "G/F" || clean === "F/G") return "SG/SF";
  if (clean === "F-C" || clean === "C-F") return "PF/C";
  if (clean === "F/C" || clean === "C/F") return "PF/C";

  const tokens = clean.split("/").map((t) => t.trim()).filter(Boolean);
  const deduped = Array.from(new Set(tokens))
    .filter((t) => t in POSITION_ORDER)
    .sort((a, b) => POSITION_ORDER[a] - POSITION_ORDER[b]);

  if (deduped.length === 0) return "N/A";
  if (deduped.length === 1) return deduped[0];
  const pair = `${deduped[0]}/${deduped[1]}`;
  if (CANONICAL_PAIRS.has(pair)) return pair;
  return pair;
}

// Quartile tier from a 1-based projection rank — identical bucketing to
// lib/fantasy/daily/pool-builder.ts (inlined to avoid the @/ alias in that
// module, which bare node cannot resolve).
function tierFor(rank: number, total: number): 1 | 2 | 3 | 4 {
  const q = total / 4;
  if (rank <= q)     return 1;
  if (rank <= q * 2) return 2;
  if (rank <= q * 3) return 3;
  return 4;
}

type CpRow = {
  id:               string;
  player_id:        string;
  display_name:     string | null;
  team:             string | null;
  position:         string | null;
  tier:             number | null;
  salary:           number | null;
  projected_points: number | null;
  roster_source:    string | null;
};

function isIncomplete(r: CpRow): boolean {
  return (
    !r.display_name || r.display_name === "" ||
    !r.team        || r.team        === "" ||
    !r.position    || r.position    === "" ||
    r.salary == null ||
    r.projected_points == null
  );
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url) die(2, "Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) die(2, "Missing SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)");
  const supabase = createClient(url, key);

  const daysBack = parseInt(process.env.REPAIR_DAYS_BACK ?? "14", 10);
  const daysFwd  = parseInt(process.env.REPAIR_DAYS_FWD  ?? "7", 10);
  const dryRun   = process.env.REPAIR_DRY_RUN === "1";

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const from = new Date(today); from.setUTCDate(today.getUTCDate() - daysBack);
  const to   = new Date(today); to.setUTCDate(today.getUTCDate() + daysFwd);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr   = to.toISOString().slice(0, 10);

  console.log(`Repair window:     ${fromStr} → ${toStr}${dryRun ? "  (DRY RUN — no writes)" : ""}`);
  console.log(`Roster key:        ${process.env.SUPABASE_SERVICE_ROLE_KEY ? "service_role" : "anon"}`);

  const { data: contests, error: cErr } = await supabase
    .from("contests")
    .select("id, date, status")
    .gte("date", fromStr)
    .lte("date", toStr)
    .order("date", { ascending: true });
  if (cErr) die(2, `contests lookup failed: ${cErr.message}`);
  if (!contests || contests.length === 0) {
    console.log("No contests in window. Nothing to repair.");
    process.exit(0);
  }

  let contestsScanned   = 0;
  let contestsWithFixes = 0;
  let rowsRepaired      = 0;
  let tiersRecomputed   = 0;
  let rowsUnresolved    = 0;
  let nullTierRows      = 0;
  const tierDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  const unresolvedExamples: string[] = [];

  for (const contest of contests as { id: string; date: string; status: string }[]) {
    contestsScanned++;

    const { data: cpRaw, error: cpErr } = await supabase
      .from("contest_players")
      .select("id, player_id, display_name, team, position, tier, salary, projected_points, roster_source")
      .eq("contest_id", contest.id);
    if (cpErr) {
      console.warn(`  ${contest.date}: contest_players read failed (${cpErr.message}) — migration 043 applied?`);
      continue;
    }
    const cp = (cpRaw ?? []) as CpRow[];
    if (cp.length === 0) continue;

    // Resolve metadata for the whole contest in two batched reads.
    const intIds = cp.map((r) => parseInt(r.player_id, 10)).filter(Number.isFinite);
    const inList = intIds.length > 0 ? intIds : [-1];
    const [nctRes, pscRes] = await Promise.all([
      supabase.from("nba_player_current_team").select("player_id, player_name, team").in("player_id", inList),
      supabase.from("player_stats_cache").select("player_id, name, team, position").in("player_id", inList),
    ]);

    type NctRow = { player_id: string | number; player_name: string | null; team: string | null };
    type PscRow = { player_id: string | number; name: string | null; team: string | null; position: string | null };
    const nctByPid = new Map<string, { name: string; team: string }>();
    for (const r of (nctRes.data as NctRow[] | null) ?? []) {
      nctByPid.set(String(r.player_id), { name: r.player_name ?? "", team: r.team ? normalizeTeamCode(r.team) : "" });
    }
    const pscByPid = new Map<string, { name: string; team: string; position: string }>();
    for (const r of (pscRes.data as PscRow[] | null) ?? []) {
      pscByPid.set(String(r.player_id), {
        name: r.name ?? "",
        team: r.team ? normalizeTeamCode(r.team) : "",
        position: r.position ?? "N/A",
      });
    }

    // ── Re-tier the full pool by projected_points DESC ──────────────
    const ranked = [...cp].sort(
      (a, b) => (Number(b.projected_points) || 0) - (Number(a.projected_points) || 0),
    );
    const newTierByPid = new Map<string, number>();
    ranked.forEach((r, idx) => newTierByPid.set(r.player_id, tierFor(idx + 1, ranked.length)));

    let contestTouched = false;

    for (const row of cp) {
      const pid  = row.player_id;
      const nct  = nctByPid.get(pid);
      const psc  = pscByPid.get(pid);
      const name = (row.display_name && row.display_name !== "") ? row.display_name : (nct?.name || psc?.name || "");
      const team = (row.team && row.team !== "") ? normalizeTeamCode(row.team) : (nct?.team || psc?.team || "");
      const position = (row.position && row.position !== "")
        ? row.position
        : getCanonicalPlayerPosition(name, psc?.position ?? "N/A");
      const newTier = newTierByPid.get(pid) ?? row.tier ?? 4;
      if (row.tier == null) nullTierRows++;
      if (newTier >= 1 && newTier <= 4) tierDist[newTier]++;

      const needsDisplayFix = isIncomplete(row);
      const tierChanged     = row.tier !== newTier;

      if (needsDisplayFix && !name && !team && !position) {
        rowsUnresolved++;
        if (unresolvedExamples.length < 20) unresolvedExamples.push(`${contest.date}:${pid}`);
      }

      if (!needsDisplayFix && !tierChanged) continue;

      const update: Record<string, unknown> = {};
      if (needsDisplayFix) {
        if (name)     update.display_name = name;
        if (team)     update.team = team;
        if (position) update.position = position;
        update.roster_source = row.roster_source ?? (nct ? "repair_current_roster" : (psc ? "repair_stats_cache" : "repair_unresolved"));
        update.roster_validated_at = new Date().toISOString();
        rowsRepaired++;
      }
      if (tierChanged) {
        update.tier = newTier;
        tiersRecomputed++;
      }

      if (Object.keys(update).length === 0) continue;
      contestTouched = true;

      if (!dryRun) {
        const { error: upErr } = await supabase
          .from("contest_players")
          .update(update)
          .eq("id", row.id);
        if (upErr) console.warn(`  ${contest.date}: update ${pid} failed: ${upErr.message}`);
      }
    }

    if (contestTouched) {
      contestsWithFixes++;
      console.log(`  ${contest.date} (${contest.status}): ${cp.length} players — repaired`);
    }
  }

  console.log("");
  console.log("──────────────── Summary ────────────────");
  console.log(`Contests scanned:      ${contestsScanned}`);
  console.log(`Contests with fixes:   ${contestsWithFixes}`);
  console.log(`Display rows repaired: ${rowsRepaired}`);
  console.log(`Tiers recomputed:      ${tiersRecomputed}`);
  console.log(`Null-tier rows:        ${nullTierRows}`);
  console.log(`Final tier dist:       T1=${tierDist[1]} T2=${tierDist[2]} T3=${tierDist[3]} T4=${tierDist[4]}`);
  console.log(`Rows still unresolved: ${rowsUnresolved}`);
  if (unresolvedExamples.length > 0) {
    console.log(`Unresolved examples:   ${unresolvedExamples.join(", ")}`);
  }
  if (dryRun) console.log("(dry run — no writes were performed)");
  process.exit(0);
}

main().catch((err) => die(2, `Unexpected: ${err instanceof Error ? err.stack : String(err)}`));
