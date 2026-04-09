import { NextRequest, NextResponse } from "next/server";
import { getDailyContest, getSupabaseAnon, resolveContestDate } from "@/lib/contest-server";
import { scoreLineupProjection, validateTierSelections } from "@/lib/daily-contest";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  const contestDate = resolveContestDate(searchParams.get("date"));
  if (!userId) {
    return NextResponse.json({ status: "error", message: "userId is required" }, { status: 400 });
  }

  try {
    const contest = await getDailyContest(contestDate);
    if (!contest) return NextResponse.json({ status: "success", lineup: null });

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase
      .from("user_lineups")
      .select("id,contest_id,user_id,player_ids,is_submitted,projected_fpts,created_at,updated_at")
      .eq("contest_id", contest.id)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ status: "success", lineup: data });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = String(body?.userId || "").trim();
    const playerIds = Array.isArray(body?.playerIds) ? body.playerIds.map((id: unknown) => Number(id)) : [];
    const mode = body?.mode === "draft" ? "draft" : "submit";
    const contestDate = resolveContestDate(body?.date ?? null);

    if (!userId) {
      return NextResponse.json({ status: "error", message: "userId is required" }, { status: 400 });
    }

    const contest = await getDailyContest(contestDate);
    if (!contest) {
      return NextResponse.json({ status: "error", message: "Contest not found for date" }, { status: 404 });
    }

    const validation = validateTierSelections(playerIds, contest.player_pool);
    if (!validation.ok) {
      return NextResponse.json({ status: "error", message: validation.error }, { status: 400 });
    }

    const supabase = getSupabaseAnon();

    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (userError) throw userError;
    if (!userRow) {
      return NextResponse.json({
        status: "error",
        message: "Current session user is not present in public.users; cannot satisfy user_lineups FK.",
      }, { status: 400 });
    }

    const projectedFpts = scoreLineupProjection(playerIds, contest.player_pool);

    const { data, error } = await supabase
      .from("user_lineups")
      .upsert({
        contest_id: contest.id,
        user_id: userId,
        player_ids: playerIds,
        projected_fpts: projectedFpts,
        is_submitted: mode === "submit",
        updated_at: new Date().toISOString(),
      }, { onConflict: "contest_id,user_id" })
      .select("id,contest_id,user_id,player_ids,is_submitted,projected_fpts,created_at,updated_at")
      .single();

    if (error) throw error;

    return NextResponse.json({ status: "success", lineup: data });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
