export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/members/route.ts
//
// GET   — list admins + members + pending requests (league admin only).
// POST  — upsert a member with one of the league-scoped roles
//          (league_admin / team_manager / player / referee /
//          scorekeeper / viewer). Optional team_id for team_manager &
//          player.
// PATCH — update a member's role/status/team_id.
//
// Platform-admin (league_owner / league_admin) grants live at
// /api/platform/basketball-leagues/[id]/grant-admin. The `league_admin`
// role value here is supported but the source of truth for league-admin
// access remains the basketball_league_admins table.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

const MEMBER_ROLES = new Set([
  "league_admin",
  "team_manager",
  "player",
  "referee",
  "scorekeeper",
  "viewer",
]);
const TEAM_SCOPED_ROLES = new Set(["team_manager", "player"]);
const MEMBER_STATUSES = new Set(["pending", "approved", "rejected", "removed"]);

async function resolveTeamId(
  supabase: ReturnType<typeof serviceDb>,
  leagueId: string,
  role: string,
  teamIdRaw: unknown,
): Promise<string | null> {
  if (!TEAM_SCOPED_ROLES.has(role)) return null;
  if (typeof teamIdRaw !== "string" || !teamIdRaw.trim()) return null;
  const teamId = teamIdRaw.trim();
  const { data, error } = await supabase
    .from("basketball_teams")
    .select("id, basketball_league_id")
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!data) throw new AccessError("invalid_team_id", 400);
  if (data.basketball_league_id !== leagueId) {
    throw new AccessError("team_not_in_league", 400);
  }
  return teamId;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const [{ data: admins }, { data: members }] = await Promise.all([
      supabase
        .from("basketball_league_admins")
        .select("user_id, role, granted_by, granted_at")
        .eq("basketball_league_id", id),
      supabase
        .from("basketball_league_members")
        .select(
          "user_id, role, status, team_id, invited_by, approved_by, joined_at, approved_at",
        )
        .eq("basketball_league_id", id),
    ]);

    return NextResponse.json({
      admins: admins ?? [],
      members: (members ?? []).filter((m) => m.status !== "pending"),
      pending: (members ?? []).filter((m) => m.status === "pending"),
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const body = (await req.json()) as {
      user_id?: string;
      role?: string;
      status?: string;
      team_id?: string | null;
    };
    if (!body.user_id) throw new AccessError("missing_user_id", 400);
    if (!body.role || !MEMBER_ROLES.has(body.role)) {
      throw new AccessError("invalid_role", 400);
    }
    const status = body.status ?? "pending";
    if (!MEMBER_STATUSES.has(status)) throw new AccessError("invalid_status", 400);

    const teamId = await resolveTeamId(supabase, id, body.role, body.team_id);

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("basketball_league_members")
      .upsert(
        {
          basketball_league_id: id,
          user_id: body.user_id,
          role: body.role,
          status,
          team_id: teamId,
          invited_by: userId,
          approved_by: status === "approved" ? userId : null,
          approved_at: status === "approved" ? now : null,
          updated_at: now,
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
      user_id?: string;
      role?: string;
      status?: string;
      team_id?: string | null;
    };
    if (!body.user_id) throw new AccessError("missing_user_id", 400);

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.role === "string") {
      if (!MEMBER_ROLES.has(body.role)) throw new AccessError("invalid_role", 400);
      patch.role = body.role;
      // Whenever role changes, re-evaluate team_id scope.
      if (!TEAM_SCOPED_ROLES.has(body.role)) {
        patch.team_id = null;
      } else if ("team_id" in body) {
        patch.team_id = await resolveTeamId(supabase, id, body.role, body.team_id);
      }
    } else if ("team_id" in body) {
      // role unchanged; allow updating team_id only if the body provides
      // it and current role is team-scoped. We don't know the current
      // role without a read, so trust the caller (admin-only endpoint).
      patch.team_id =
        body.team_id == null
          ? null
          : await resolveTeamId(supabase, id, "team_manager", body.team_id);
    }
    if (typeof body.status === "string") {
      if (!MEMBER_STATUSES.has(body.status)) throw new AccessError("invalid_status", 400);
      patch.status = body.status;
      if (body.status === "approved") {
        patch.approved_by = userId;
        patch.approved_at = new Date().toISOString();
      }
    }

    const { data, error } = await supabase
      .from("basketball_league_members")
      .update(patch)
      .eq("basketball_league_id", id)
      .eq("user_id", body.user_id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "member_not_found" }, { status: 404 });
    return NextResponse.json({ member: data });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
