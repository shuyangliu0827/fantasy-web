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
    let details: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: string };
      if (body?.error) code = body.error;
      if (body?.details) details = body.details;
    } catch {
      /* ignore */
    }
    // Preserve the status on the thrown Error so callers can branch on
    // 403 vs other failures without re-parsing the message. The server's
    // `details` field (e.g. the storage SDK's underlying error message)
    // is appended so the UI can show a useful diagnostic instead of just
    // an opaque "upload_failed".
    const message = details ? `${code}: ${details}` : code;
    const err = new Error(message) as Error & { status?: number };
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

async function postHighlightFile(
  url: string,
  file: File,
): Promise<{ url: string; storage_path: string }> {
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
    let details: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: string };
      if (body?.error) code = body.error;
      if (body?.details) details = body.details;
    } catch {
      /* ignore */
    }
    const message = details ? `${code}: ${details}` : code;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const body = (await res.json()) as { url?: string; storage_path?: string };
  if (!body?.url || !body?.storage_path) {
    throw new Error("missing_url_in_response");
  }
  return { url: body.url, storage_path: body.storage_path };
}

/**
 * Upload a highlight image for a player. Returns the public URL plus the
 * underlying storage path so the caller can pass both to the highlights
 * POST endpoint (the path is kept on the row for cascading deletes).
 */
export async function uploadBasketballPlayerHighlightImage(
  playerId: string,
  file: File,
): Promise<{ url: string; storage_path: string }> {
  return postHighlightFile(
    `/api/basketball-players/${playerId}/highlights/image`,
    file,
  );
}

/**
 * Upload a highlight video file. Server enforces size (100MB) and MIME
 * type validation. Returns the public URL + storage path the caller
 * persists onto the highlights row.
 */
export async function uploadBasketballPlayerHighlightVideo(
  playerId: string,
  file: File,
): Promise<{ url: string; storage_path: string }> {
  return postHighlightFile(
    `/api/basketball-players/${playerId}/highlights/video`,
    file,
  );
}

export async function uploadBasketballLeagueLogo(
  leagueId: string,
  file: File,
): Promise<string> {
  return postFile(`/api/basketball-leagues/${leagueId}/logo`, file);
}

/**
 * Upload a video highlight file for a game. Server route enforces
 * league_admin permission and validates file size / MIME type. Returns
 * the freshly created basketball_game_media row.
 */
export async function uploadBasketballGameVideo(
  gameId: string,
  file: File,
  opts?: { title?: string; visibility?: "public" | "members_only" },
): Promise<{
  id: string;
  url: string;
  title: string | null;
  visibility: string;
  media_type: string;
  source_type: string;
}> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  const formData = new FormData();
  formData.append("file", file, file.name);
  if (opts?.title) formData.append("title", opts.title);
  if (opts?.visibility) formData.append("visibility", opts.visibility);

  const res = await fetch(`/api/basketball-games/${gameId}/media/video`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    let code = `HTTP ${res.status}`;
    let details: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; details?: string };
      if (body?.error) code = body.error;
      if (body?.details) details = body.details;
    } catch {
      /* ignore */
    }
    const message = details ? `${code}: ${details}` : code;
    const err = new Error(message) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const body = (await res.json()) as {
    media?: {
      id: string;
      url: string;
      title: string | null;
      visibility: string;
      media_type: string;
      source_type: string;
    };
  };
  if (!body.media) throw new Error("missing_media_in_response");
  return body.media;
}
