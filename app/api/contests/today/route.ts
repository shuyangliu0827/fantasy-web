import { NextRequest, NextResponse } from "next/server";
import { getDailyContest, resolveContestDate, upsertDailyContest } from "@/lib/contest-server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contestDate = resolveContestDate(searchParams.get("date"));
    const existing = await getDailyContest(contestDate);
    const contest = existing ?? await upsertDailyContest(contestDate);
    return NextResponse.json({ status: "success", contest });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
