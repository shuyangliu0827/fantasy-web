// lib/contest-auth.ts
//
// Extracts and validates the Supabase Auth user from an incoming API request.
// Uses the Bearer token in the Authorization header, validated server-side
// via supabase.auth.getUser() — the only authoritative auth check.
//
// Usage in route handlers:
//   const userId = await getAuthUserId(req);
//   if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ContestAuthUser = {
  id: string;
  email: string | null;
  name: string | null;
};

/**
 * Returns the authenticated user's UUID (from public.users / Supabase Auth),
 * or null if the request has no valid Bearer token.
 */
export async function getAuthUserId(req: Request): Promise<string | null> {
  const user = await getAuthUser(req);
  return user?.id ?? null;
}

/**
 * Returns normalized auth user identity from a Bearer token.
 */
export async function getAuthUser(req: Request): Promise<ContestAuthUser | null> {
  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : null,
  };
}

/**
 * Ensures public.users has a row for the authenticated user.
 * Some deployments still enforce user_lineups.user_id FK -> public.users(id),
 * so contest lineup writes must seed this row first.
 */
export async function ensurePublicUserRow(
  supabase: SupabaseClient,
  authUser: ContestAuthUser,
): Promise<void> {
  const { data: existing, error: selectErr } = await supabase
    .from("users")
    .select("id")
    .eq("id", authUser.id)
    .maybeSingle();

  if (selectErr) throw new Error(selectErr.message);
  if (existing?.id) return;

  const email = authUser.email?.trim().toLowerCase() || `${authUser.id}@auth.local`;
  const fallbackName = email.split("@")[0] || "user";
  const name = (authUser.name?.trim() || fallbackName).slice(0, 80);
  const slugBase = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_-]/g, "").slice(0, 20) || "user";
  const username = `${slugBase}_${authUser.id.slice(0, 8)}`;

  const { error: upsertErr } = await supabase
    .from("users")
    .upsert(
      { id: authUser.id, email, name, username },
      { onConflict: "id", ignoreDuplicates: false },
    );

  if (upsertErr) throw new Error(upsertErr.message);
}
