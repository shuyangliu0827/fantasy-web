// lib/basketball/client.ts
//
// Client-side fetch wrapper that attaches the Supabase access_token as a
// Bearer header. Mirrors lib/fantasy/daily/fetch.ts.

import { supabase } from "@/lib/shared/supabase";

export async function basketballFetch(
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  return fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
}

export async function basketballJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ data: T | null; error: string | null; status: number }> {
  const res = await basketballFetch(url, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err =
      body && typeof body === "object" && "error" in body
        ? String((body as { error: unknown }).error)
        : `HTTP ${res.status}`;
    return { data: null, error: err, status: res.status };
  }
  return { data: body as T, error: null, status: res.status };
}
