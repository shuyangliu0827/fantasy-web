export const dynamic = "force-dynamic";
// app/api/basketball-leagues/[id]/lookup-user/route.ts
//
// GET /api/basketball-leagues/{id}/lookup-user?u=<query>
//
// Admin-gated helper for the league members invite UI. The `u` query can be:
//   - a UUID (matched against users.id)
//   - a username (exact, case-insensitive)
//   - a display name (substring, case-insensitive)
//   - an email (exact, case-insensitive)
// Returns the first match. 404 when nothing matches.
//
// Authorization: league admin or platform admin only (so this is not
// usable as a general public directory).

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
  requireLeagueAdmin,
} from "@/lib/basketball/access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    await requireLeagueAdmin(supabase, id, userId);

    const url = new URL(req.url);
    const query = url.searchParams.get("u")?.trim();
    if (!query) throw new AccessError("missing_username", 400);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    type UserRow = {
      id: string;
      username: string | null;
      name: string | null;
      email: string | null;
      avatar_url: string | null;
    };
    const COLS = "id, username, name, email, avatar_url";

    const findOne = async (
      column: "id" | "username" | "email",
      value: string,
    ): Promise<UserRow | null> => {
      const builder = supabase.from("users").select(COLS);
      const q =
        column === "id"
          ? builder.eq("id", value)
          : builder.ilike(column, value);
      const { data, error } = await q.limit(1).maybeSingle<UserRow>();
      if (error) throw new AccessError(error.message, 500);
      return data ?? null;
    };

    let row: UserRow | null = null;

    if (UUID_RE.test(query)) row = await findOne("id", query);
    if (!row) row = await findOne("username", query);
    if (!row && query.includes("@")) row = await findOne("email", query);
    if (!row) {
      // Substring search on display name as a last resort.
      const escaped = query.replace(/[%_]/g, (c) => `\\${c}`);
      const { data, error } = await supabase
        .from("users")
        .select(COLS)
        .ilike("name", `%${escaped}%`)
        .limit(1)
        .maybeSingle<UserRow>();
      if (error) throw new AccessError(error.message, 500);
      row = data ?? null;
    }
    if (!row) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

    return NextResponse.json({
      user_id: row.id,
      username: row.username,
      name: row.name ?? null,
      email: row.email ?? null,
      avatar_url: row.avatar_url ?? null,
    });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
