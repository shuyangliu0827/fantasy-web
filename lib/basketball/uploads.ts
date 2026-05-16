// lib/basketball/uploads.ts
//
// Client-side helpers that POST image files to the server-side upload
// endpoints. The endpoints (under /api/basketball-{players,teams}/...)
// use the service-role Supabase client to write the file to storage,
// after running the same access checks the rest of the basketball
// admin API uses (lib/basketball/access.ts).
//
// Why server-side: direct supabase.storage.from(...).upload(...) from
// the browser is gated by storage.objects RLS, which in this project
// produced opaque "row violates row-level security policy" denials
// across migrations 036/037. Routing through the API removes that
// failure mode entirely and keeps a single authorization path
// (lib/basketball/access.ts) regardless of whether the caller is an
// admin, a team manager, or a claim owner.
//
// The helpers preserve the previous signature — `(leagueId, entityId,
// file) => Promise<publicUrl>` — so callers do not need to change.
// `leagueId` is accepted for symmetry with the previous helpers, but
// the server route resolves the canonical league id from the player /
// team row itself.

import { supabase } from "@/lib/shared/supabase";

async function postFile(
  url: string,
  file: File,
): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const formData = new FormData();
  formData.append("file", file, file.name);

  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) code = body.error;
    } catch {
      /* ignore */
    }
    // Preserve the status on the thrown Error so callers can branch on
    // 403 vs other failures without re-parsing the message.
    const err = new Error(code) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const body = (await res.json()) as { url?: string };
  if (!body?.url) throw new Error("missing_url_in_response");
  return body.url;
}

export async function uploadBasketballTeamLogo(
  _leagueId: string,
  teamId: string,
  file: File,
): Promise<string> {
  return postFile(`/api/basketball-teams/${teamId}/logo`, file);
}

export async function uploadBasketballPlayerAvatar(
  _leagueId: string,
  playerId: string,
  file: File,
): Promise<string> {
  return postFile(`/api/basketball-players/${playerId}/avatar`, file);
}
