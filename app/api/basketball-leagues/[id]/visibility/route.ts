export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/visibility/route.ts
//
// PATCH — league admin / platform admin sets visibility to one of:
//         "public" | "invite_only" | "private".

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

const ALLOWED = new Set(["public", "invite_only", "private"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const body = (await req.json()) as { visibility?: string };
    if (!body.visibility || !ALLOWED.has(body.visibility)) {
      throw new AccessError("invalid_visibility", 400);
    }

    const { data, error } = await supabase
      .from("basketball_leagues")
      .update({ visibility: body.visibility, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, visibility")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ league: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
