import { NextRequest, NextResponse } from "next/server";
import { resolveContestDate, upsertDailyContest } from "@/lib/contest-server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const contestDate = resolveContestDate(body?.date ?? null);
    const contest = await upsertDailyContest(contestDate);
    return NextResponse.json({ status: "success", contest });
  } catch (error) {
    return NextResponse.json({ status: "error", message: String(error) }, { status: 500 });
  }
}
