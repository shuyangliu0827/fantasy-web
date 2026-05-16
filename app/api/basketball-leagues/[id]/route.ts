export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/route.ts
//
// GET   — visibility-gated read of one basketball league.
// PATCH — league admin / platform admin update (name, description, slug).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
  requireViewPermission,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);
  try {
    const access = await requireViewPermission(supabase, id, userId);
    const { data, error } = await supabase
      .from("basketball_leagues")
      .select("*")
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ league: data, access });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const body = (await req.json()) as {
      name?: string;
      description?: string | null;
      slug?: string;
      is_contest_enabled?: boolean;
      logo_url?: string | null;
    };
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.description !== "undefined") patch.description = body.description;
    if (typeof body.slug === "string") patch.slug = body.slug.trim();
    if (typeof body.is_contest_enabled === "boolean") patch.is_contest_enabled = body.is_contest_enabled;
    if (typeof body.logo_url !== "undefined") patch.logo_url = body.logo_url;

    const { data, error } = await supabase
      .from("basketball_leagues")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      const status = error.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: error.message }, { status });
    }
    return NextResponse.json({ league: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
