export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/request-access/route.ts
//
// POST — authenticated user requests access to a league.
// Upserts basketball_league_members with role='viewer', status='pending'.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    // Make sure the league exists before creating an orphan request.
    const { data: league } = await supabase
      .from("basketball_leagues")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (!league) throw new AccessError("league_not_found", 404);

    const { data, error } = await supabase
      .from("basketball_league_members")
      .upsert(
        {
          basketball_league_id: id,
          user_id: userId,
          role: "viewer",
          status: "pending",
          joined_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "basketball_league_id,user_id" },
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ member: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
