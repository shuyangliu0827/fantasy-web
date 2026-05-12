export const dynamic = "force-dynamic";
// app/api/platform/basketball-leagues/[id]/grant-admin/route.ts
//
// Platform-admin only. This is the ONLY way to create/remove
// basketball_league_admins rows (league admins themselves cannot grant
// admin roles — they can only grant stat_keeper/player/viewer).
//
// POST   — upsert { user_id, role } into basketball_league_admins.
// DELETE — remove the league admin row for { user_id }.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requirePlatformAdmin,
} from "@/lib/basketball/access";

const ADMIN_ROLES = new Set(["league_owner", "league_admin"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requirePlatformAdmin(supabase, userId);

    const body = (await req.json()) as { user_id?: string; role?: string };
    if (!body.user_id) throw new AccessError("missing_user_id", 400);
    if (!body.role || !ADMIN_ROLES.has(body.role)) {
      throw new AccessError("invalid_role", 400);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("basketball_league_admins")
      .upsert(
        {
          basketball_league_id: id,
          user_id: body.user_id,
          role: body.role,
          granted_by: userId,
          granted_at: now,
          updated_at: now,
        },
        { onConflict: "basketball_league_id,user_id" },
      )
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ admin: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requirePlatformAdmin(supabase, userId);

    const body = (await req.json()) as { user_id?: string };
    if (!body.user_id) throw new AccessError("missing_user_id", 400);

    const { error } = await supabase
      .from("basketball_league_admins")
      .delete()
      .eq("basketball_league_id", id)
      .eq("user_id", body.user_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
