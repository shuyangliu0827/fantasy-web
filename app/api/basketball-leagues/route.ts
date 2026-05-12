export const dynamic = "force-dynamic";
// app/api/basketball-leagues/route.ts
//
// GET  — list basketball leagues visible to the caller (public + ones they belong to).
// POST — authenticated user creates a league:
//        status='pending', visibility='invite_only', and the creator is
//        granted league_owner immediately (Choice A: self-serve MVP).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

export async function GET(req: Request) {
  const supabase = serviceDb();
  const userId = await getCurrentUserIdFromRequest(req);

  // Public discovery only surfaces approved + public leagues. Pending
  // leagues stay invisible to anonymous users; admins/owners see them via
  // /api/platform/basketball-leagues or their own admin/member memberships.
  const { data: publicLeagues, error: pubErr } = await supabase
    .from("basketball_leagues")
    .select("id, name, slug, description, source_type, status, visibility, is_contest_enabled, created_at")
    .eq("visibility", "public")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (pubErr) return NextResponse.json({ error: pubErr.message }, { status: 500 });

  if (!userId) return NextResponse.json({ leagues: publicLeagues ?? [] });

  const [{ data: adminLeagues }, { data: memberLeagues }] = await Promise.all([
    supabase
      .from("basketball_league_admins")
      .select("basketball_league_id")
      .eq("user_id", userId),
    supabase
      .from("basketball_league_members")
      .select("basketball_league_id")
      .eq("user_id", userId)
      .eq("status", "approved"),
  ]);

  const extraIds = new Set<string>();
  (adminLeagues ?? []).forEach((r) => extraIds.add(r.basketball_league_id));
  (memberLeagues ?? []).forEach((r) => extraIds.add(r.basketball_league_id));
  (publicLeagues ?? []).forEach((l) => extraIds.delete(l.id));

  let extra: typeof publicLeagues = [];
  if (extraIds.size > 0) {
    const { data } = await supabase
      .from("basketball_leagues")
      .select("id, name, slug, description, source_type, status, visibility, is_contest_enabled, created_at")
      .in("id", Array.from(extraIds));
    extra = data ?? [];
  }

  const merged = [...(publicLeagues ?? []), ...extra].sort((a, b) =>
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );
  return NextResponse.json({ leagues: merged });
}

export async function POST(req: Request) {
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const body = (await req.json()) as {
      name?: string;
      slug?: string;
      description?: string;
      source_type?: "nba" | "custom_manual" | "csv";
    };
    if (!body.name?.trim()) throw new AccessError("missing_name", 400);
    if (!body.slug?.trim()) throw new AccessError("missing_slug", 400);

    const { data: league, error: insertErr } = await supabase
      .from("basketball_leagues")
      .insert({
        name: body.name.trim(),
        slug: body.slug.trim(),
        description: body.description ?? null,
        source_type: body.source_type ?? "custom_manual",
        created_by: userId,
        status: "pending",
        visibility: "invite_only",
      })
      .select()
      .single();
    if (insertErr) {
      const status = insertErr.code === "23505" ? 409 : 500;
      return NextResponse.json({ error: insertErr.message }, { status });
    }

    // Choice A: creator is granted league_owner immediately (status still pending).
    const { error: adminErr } = await supabase
      .from("basketball_league_admins")
      .insert({
        basketball_league_id: league.id,
        user_id: userId,
        role: "league_owner",
        granted_by: userId,
      });
    if (adminErr) {
      // Rollback the league to keep state consistent.
      await supabase.from("basketball_leagues").delete().eq("id", league.id);
      return NextResponse.json({ error: adminErr.message }, { status: 500 });
    }

    return NextResponse.json({ league }, { status: 201 });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
