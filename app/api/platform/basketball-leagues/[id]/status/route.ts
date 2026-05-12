export const dynamic = "force-dynamic";
// app/api/platform/basketball-leagues/[id]/status/route.ts
//
// PATCH — platform admin sets the league's lifecycle status.
//         { status: "pending" | "approved" | "rejected" | "archived" }

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requirePlatformAdmin,
} from "@/lib/basketball/access";

const STATUSES = new Set(["pending", "approved", "rejected", "archived"]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requirePlatformAdmin(supabase, userId);

    const body = (await req.json()) as { status?: string };
    if (!body.status || !STATUSES.has(body.status)) {
      throw new AccessError("invalid_status", 400);
    }

    const { data, error } = await supabase
      .from("basketball_leagues")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id, status")
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
