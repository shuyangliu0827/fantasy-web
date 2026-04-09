import { NextRequest, NextResponse } from "next/server";
import { getDailyContest, getSupabaseAnon, resolveContestDate } from "@/lib/contest-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contestDate = resolveContestDate(searchParams.get("date"));
    const contest = await getDailyContest(contestDate);
    if (!contest) return NextResponse.json({ status: "success", leaderboard: [] });

    const supabase = getSupabaseAnon();
    const { data, error } = await supabase
      .from("user_lineups")
      .select("user_id,projected_fpts,is_submitted,updated_at,users!inner(username,name)")
      .eq("contest_id", contest.id)
      .eq("is_submitted", true)
      .order("projected_fpts", { ascending: false })
      .order("updated_at", { ascending: true });

    if (error) throw error;

    const leaderboard = (data ?? []).map((row, index) => ({
      rank: index + 1,
      userId: row.user_id,
      username: (row.users as { username?: string; name?: string })?.username || (row.users as { name?: string })?.name || "Anonymous",
      projectedFpts: row.projected_fpts,
      submittedAt: row.updated_at,
    }));

    return NextResponse.json({ status: "success", leaderboard });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
