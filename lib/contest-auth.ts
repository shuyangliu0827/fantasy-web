// lib/contest-auth.ts
//
// Extracts and validates the Supabase Auth user from an incoming API request.
// Uses the Bearer token in the Authorization header, validated server-side
// via supabase.auth.getUser() — the only authoritative auth check.
//
// Usage in route handlers:
//   const userId = await getAuthUserId(req);
//   if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

import { createClient } from "@supabase/supabase-js";

/**
 * Returns the authenticated user's UUID (from public.users / Supabase Auth),
 * or null if the request has no valid Bearer token.
 */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  return user?.id ?? null;
}
