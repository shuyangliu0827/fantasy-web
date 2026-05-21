export const dynamic = "force-dynamic";
// GET /api/me/roles
//
// Unified role-context endpoint. Returns the full RoleContext for the
// authenticated caller (or the anonymous default). Powers the role-aware
// navigation in LightHeader and the (league-admin) layout gate.

import { NextResponse } from "next/server";
import {
  getCurrentUserRole,
  EMPTY_ROLE_CONTEXT,
} from "@/lib/auth/getCurrentUserRole";

export async function GET(req: Request) {
  try {
    const ctx = await getCurrentUserRole(req);
    return NextResponse.json(ctx);
  } catch {
    return NextResponse.json(EMPTY_ROLE_CONTEXT);
  }
}
