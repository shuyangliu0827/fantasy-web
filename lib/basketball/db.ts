// lib/basketball/db.ts
//
// Service-role Supabase client for basketball API handlers. Falls back to
// the anon key when SUPABASE_SERVICE_ROLE_KEY is not set, mirroring the
// pattern used elsewhere in this codebase.

import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Db = SupabaseClient;

export function serviceDb(): Db {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false },
  });
}
