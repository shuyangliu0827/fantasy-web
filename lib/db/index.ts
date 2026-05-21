// lib/db/index.ts
//
// Façade for Supabase client access. Two clients are exposed:
//
//   - `supabase`  — the singleton anon-key client used in browser code
//                   (reads sessions from localStorage). Re-exported from
//                   lib/shared/supabase.
//
//   - `serviceDb()` — service-role client for API route handlers
//                     (auth.persistSession: false, falls back to anon
//                     key when SUPABASE_SERVICE_ROLE_KEY is unset).
//                     Re-exported from lib/basketball/db.
//
// New code should import from "@/lib/db". Existing imports from the
// legacy paths continue to work.

export { supabase } from "@/lib/shared/supabase";
export { serviceDb, type Db } from "@/lib/basketball/db";
