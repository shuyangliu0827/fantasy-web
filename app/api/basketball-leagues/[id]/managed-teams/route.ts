export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/managed-teams/route.ts
//
// GET — visibility-gated. Returns the list of team ids in this league
// that already have an APPROVED team_manager. Used by the "Bind Team"
// modal so a manager can see which teams are still available without
// needing admin access to /members.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireViewPermission,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireViewPermission(supabase, id, userId);

    const { data, error } = await supabase
      .from("basketball_league_members")
      .select("team_id")
      .eq("basketball_league_id", id)
      .eq("role", "team_manager")
      .eq("status", "approved")
      .not("team_id", "is", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const team_ids = Array.from(
      new Set(
        (data ?? [])
          .map((r) => r.team_id as string | null)
          .filter((t): t is string => !!t),
      ),
    );
    return NextResponse.json({ team_ids });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
