export const dynamic = "force-dynamic";
// app/api/dev/grant-basketball-access/route.ts
//
// Test/seed utility. Lets a developer grant any of:
//   • platform_admin
//   • league_admin (league_owner / league_admin)
//   • league_member (stat_keeper / player / viewer)
//   • player_claim approval
//
// Authentication
//   Header: x-dev-admin-secret: <DEV_ADMIN_SECRET>
//   The secret env var MUST be set (in both prod and dev). A missing
//   server-side secret yields 503 — explicit "not configured" — so this
//   route can never be silently open.
//
// Examples (see CUSTOM_LEAGUE_INFRASTRUCTURE_PLAN.md for the full cookbook):
//
//   curl -X POST .../api/dev/grant-basketball-access \
//        -H "x-dev-admin-secret: $DEV_ADMIN_SECRET" \
//        -H "Content-Type: application/json" \
//        -d '{"type":"platform_admin","user_id":"<uuid>"}'

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";

type Body =
  | { type: "platform_admin"; user_id: string; role?: "platform_owner" | "platform_admin" | "support" }
  | {
      type: "league_admin";
      basketball_league_id: string;
      user_id: string;
      role?: "league_owner" | "league_admin";
    }
  | {
      type: "league_member";
      basketball_league_id: string;
      user_id: string;
      role: "stat_keeper" | "player" | "viewer";
      status?: "pending" | "approved" | "rejected" | "removed";
    }
  | {
      type: "player_claim";
      player_id: string;
      user_id: string;
      claim_status: "approved" | "rejected" | "pending";
    };

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const expected = process.env.DEV_ADMIN_SECRET;
  if (!expected) return bad("dev_admin_secret_not_configured", 503);

  const provided = req.headers.get("x-dev-admin-secret");
  if (!provided || provided !== expected) return bad("forbidden", 403);

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return bad("invalid_json");
  }

  const supabase = serviceDb();
  const now = new Date().toISOString();

  switch (body.type) {
    case "platform_admin": {
      if (!body.user_id) return bad("missing_user_id");
      const { data, error } = await supabase
        .from("platform_admins")
        .upsert(
          {
            user_id: body.user_id,
            role: body.role ?? "platform_admin",
          },
          { onConflict: "user_id" },
        )
        .select()
        .single();
      if (error) return bad(error.message, 500);
      return NextResponse.json({ platform_admin: data });
    }

    case "league_admin": {
      if (!body.basketball_league_id || !body.user_id) return bad("missing_fields");
      const { data, error } = await supabase
        .from("basketball_league_admins")
        .upsert(
          {
            basketball_league_id: body.basketball_league_id,
            user_id: body.user_id,
            role: body.role ?? "league_admin",
            granted_by: null,
            granted_at: now,
            updated_at: now,
          },
          { onConflict: "basketball_league_id,user_id" },
        )
        .select()
        .single();
      if (error) return bad(error.message, 500);
      return NextResponse.json({ league_admin: data });
    }

    case "league_member": {
      if (!body.basketball_league_id || !body.user_id || !body.role) {
        return bad("missing_fields");
      }
      const status = body.status ?? "approved";
      const { data, error } = await supabase
        .from("basketball_league_members")
        .upsert(
          {
            basketball_league_id: body.basketball_league_id,
            user_id: body.user_id,
            role: body.role,
            status,
            approved_at: status === "approved" ? now : null,
            updated_at: now,
          },
          { onConflict: "basketball_league_id,user_id" },
        )
        .select()
        .single();
      if (error) return bad(error.message, 500);
      return NextResponse.json({ league_member: data });
    }

    case "player_claim": {
      if (!body.player_id || !body.user_id || !body.claim_status) {
        return bad("missing_fields");
      }
      const { data, error } = await supabase
        .from("basketball_players")
        .update({
          claimed_by_user_id: body.user_id,
          claim_status: body.claim_status,
          updated_at: now,
        })
        .eq("id", body.player_id)
        .select("id, claimed_by_user_id, claim_status")
        .single();
      if (error) return bad(error.message, 500);
      return NextResponse.json({ player: data });
    }

    default:
      return bad("invalid_type");
  }
}
