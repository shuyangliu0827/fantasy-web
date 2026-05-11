// lib/contest-fetch.ts
//
// Thin fetch wrapper for Daily Contest API endpoints that require auth.
// Reads the Supabase access_token via supabase.auth.getSession() and
// attaches it as Authorization: Bearer <token>.
//
// Use this for:
//   GET  /api/contests/[id]/lineup
//   POST /api/contests/[id]/lineup
//   POST /api/contests/[id]/lineup/submit
//
// Do NOT use this for public endpoints (GET today, GET players, GET leaderboard).
// Those use plain fetch() — no auth needed.
//
// ── Session note ──────────────────────────────────────────────
// bp_session (localStorage) holds only the user profile { id, name, ... }.
// The actual Supabase access_token lives in Supabase's own localStorage keys
// managed by @supabase/supabase-js.  supabase.auth.getSession() reads those
// keys — it does NOT read bp_session.
//
// ── Client-only ───────────────────────────────────────────────
// This file must only be imported in client components ("use client").
// supabase.auth.getSession() is a browser-only operation.

import { supabase } from "@/lib/shared/supabase";

/**
 * Fetches a Daily Contest API endpoint with the current user's Bearer token.
 * If there is no active session, the request is sent without Authorization
 * and the API will return { error: "unauthorized" } with status 401.
 */
export async function contestFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Caller-supplied headers override defaults (e.g. to omit Content-Type on GET).
      ...(init.headers ?? {}),
    },
  });
}

// ── Typed helpers ─────────────────────────────────────────────
// Convenience wrappers for the three authed contest endpoints.
// Return { data, error } so callers don't need to repeat response parsing.

export type ContestFetchResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

/** GET /api/contests/[id]/lineup */
export async function getMyLineup(contestId: string): Promise<ContestFetchResult<{
  lineup_id: string;
  contest_id: string;
  user_id: string;
  status: string;
  total_fpts: number | null;
  rank: number | null;
  submitted_at: string | null;
  players: { slot: number; player_id: string }[];
}>> {
  const res = await contestFetch(`/api/contests/${contestId}/lineup`);
  const body = await res.json();
  if (!res.ok) return { data: null, error: body.error ?? `HTTP ${res.status}` };
  return { data: body, error: null };
}

/** POST /api/contests/[id]/lineup — save (or replace) draft lineup */
export async function saveLineup(
  contestId: string,
  players: { slot: number; player_id: string }[],
): Promise<ContestFetchResult<{ lineup_id: string; status: "draft" }>> {
  const res = await contestFetch(`/api/contests/${contestId}/lineup`, {
    method: "POST",
    body: JSON.stringify({ players }),
  });
  const body = await res.json();
  if (!res.ok) return { data: null, error: body.error ?? `HTTP ${res.status}` };
  return { data: body, error: null };
}

/** POST /api/contests/[id]/lineup/submit — enter lineup into contest */
export async function submitLineup(
  contestId: string,
): Promise<ContestFetchResult<{ lineup_id: string; status: "submitted"; submitted_at: string }>> {
  const res = await contestFetch(`/api/contests/${contestId}/lineup/submit`, {
    method: "POST",
  });
  const body = await res.json();
  if (!res.ok) return { data: null, error: body.error ?? `HTTP ${res.status}` };
  return { data: body, error: null };
}
