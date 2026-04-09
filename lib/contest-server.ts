import { createClient } from "@supabase/supabase-js";
import { buildContestPoolFromRows, type ContestPlayer } from "@/lib/daily-contest";
import { getLocalDateStr } from "@/lib/week-utils";
import { normalizeTeamCode } from "@/lib/i18n";

const API_BASE = "https://api.balldontlie.io/v1";

export type DailyContestRow = {
  id: string;
  contest_date: string;
  player_pool: ContestPlayer[];
  status: string;
  created_at: string;
  updated_at: string;
};

type CacheRow = {
  player_id: number;
  name: string;
  team: string;
  position: string;
  injury?: string | null;
  pts_avg: number;
  fgm_avg: number;
  fga_avg: number;
  fg3m_avg: number;
  ftm_avg: number;
  fta_avg: number;
  reb_avg: number;
  ast_avg: number;
  stl_avg: number;
  blk_avg: number;
  tov_avg: number;
};

export function getSupabaseAnon() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export function resolveContestDate(raw: string | null): string {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : getLocalDateStr();
}

async function fetchSlateTeamCodes(contestDate: string): Promise<Set<string>> {
  const apiKey = process.env.BDL_API_KEY ?? "";
  if (!apiKey) throw new Error("BDL_API_KEY is required");

  let cursor: number | undefined;
  const teams = new Set<string>();

  do {
    const url = new URL(`${API_BASE}/games`);
    url.searchParams.set("start_date", contestDate);
    url.searchParams.set("end_date", contestDate);
    url.searchParams.set("per_page", "100");
    if (cursor) url.searchParams.set("cursor", String(cursor));

    const res = await fetch(url.toString(), { headers: { Authorization: apiKey }, cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to fetch slate games: ${res.status}`);

    const payload = await res.json();
    for (const game of payload.data ?? []) {
      teams.add(normalizeTeamCode(game.home_team?.abbreviation));
      teams.add(normalizeTeamCode(game.visitor_team?.abbreviation));
    }
    cursor = payload.meta?.next_cursor;
  } while (cursor);

  return teams;
}

export async function rebuildContestPool(contestDate: string): Promise<ContestPlayer[]> {
  const slateTeams = await fetchSlateTeamCodes(contestDate);
  if (slateTeams.size === 0) return [];

  const supabase = getSupabaseAnon();
  const { data, error } = await supabase
    .from("player_stats_cache")
    .select("player_id,name,team,position,injury,pts_avg,fgm_avg,fga_avg,fg3m_avg,ftm_avg,fta_avg,reb_avg,ast_avg,stl_avg,blk_avg,tov_avg");

  if (error) throw error;

  const sameDayRows = (data ?? [])
    .filter((row) => slateTeams.has(normalizeTeamCode(row.team))) as CacheRow[];

  return buildContestPoolFromRows(sameDayRows);
}

export async function upsertDailyContest(contestDate: string): Promise<DailyContestRow> {
  const supabase = getSupabaseAnon();
  const pool = await rebuildContestPool(contestDate);

  const { data, error } = await supabase
    .from("daily_contests")
    .upsert({
      contest_date: contestDate,
      player_pool: pool,
      status: "open",
      updated_at: new Date().toISOString(),
    }, { onConflict: "contest_date" })
    .select("id,contest_date,player_pool,status,created_at,updated_at")
    .single();

  if (error) throw error;
  return data as DailyContestRow;
}

export async function getDailyContest(contestDate: string): Promise<DailyContestRow | null> {
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase
    .from("daily_contests")
    .select("id,contest_date,player_pool,status,created_at,updated_at")
    .eq("contest_date", contestDate)
    .maybeSingle();

  if (error) throw error;
  return (data as DailyContestRow | null) ?? null;
}
