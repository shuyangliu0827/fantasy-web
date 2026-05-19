export const dynamic = "force-dynamic";
// app/api/users/me/basketball-identities/visibility/route.ts
//
// PATCH — owner-only upsert of the visibility flag for a community-league
// identity. Verifies the identity actually belongs to the caller before
// writing.

import { NextResponse } from "next/server";
import { serviceDb } from "@/lib/basketball/db";
import {
  AccessError,
  getCurrentUserIdFromRequest,
} from "@/lib/basketball/access";

type Body = {
  identity_type?: "league_admin" | "team_manager" | "player";
  identity_ref_id?: string;
  visible?: boolean;
};

export async function PATCH(req: Request) {
  const supabase = serviceDb();
  try {
    const userId = await getCurrentUserIdFromRequest(req);
    if (!userId) throw new AccessError("unauthorized", 401);

    const body = (await req.json()) as Body;
    const identityType = body.identity_type;
    const refId = body.identity_ref_id?.trim();
    const visible = body.visible;
    if (
      (identityType !== "league_admin" &&
        identityType !== "team_manager" &&
        identityType !== "player") ||
      !refId ||
      typeof visible !== "boolean"
    ) {
      throw new AccessError("invalid_body", 400);
    }

    // Verify ownership of the referenced identity.
    let owned = false;
    if (identityType === "league_admin") {
      const { data } = await supabase
        .from("basketball_league_admins")
        .select("id")
        .eq("id", refId)
        .eq("user_id", userId)
        .maybeSingle();
      owned = !!data;
    } else if (identityType === "team_manager") {
      const { data } = await supabase
        .from("basketball_league_members")
        .select("id")
        .eq("id", refId)
        .eq("user_id", userId)
        .eq("role", "team_manager")
        .maybeSingle();
      owned = !!data;
    } else {
      const { data } = await supabase
        .from("basketball_players")
        .select("id")
        .eq("id", refId)
        .eq("claimed_by_user_id", userId)
        .eq("claim_status", "approved")
        .maybeSingle();
      owned = !!data;
    }
    if (!owned) throw new AccessError("identity_not_owned", 403);

    const { error } = await supabase
      .from("basketball_identity_visibility")
      .upsert(
        {
          user_id: userId,
          identity_type: identityType,
          identity_ref_id: refId,
          visible,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,identity_type,identity_ref_id" },
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AccessError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
}
