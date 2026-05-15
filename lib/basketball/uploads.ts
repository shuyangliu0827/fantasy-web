// lib/basketball/uploads.ts
//
// Client-side image upload helpers for real basketball league assets.
// Mirrors the pattern used by /app/league/[slug]/settings/page.tsx
// (bucket `league-logos`). Buckets are created in migration 034.
//
// Path scheme:
//   basketball-team-logos/{leagueId}/{teamId}.{ext}
//   basketball-player-avatars/{leagueId}/{playerId}.{ext}

import { supabase } from "@/lib/shared/supabase";

const TEAM_LOGO_BUCKET = "basketball-team-logos";
const PLAYER_AVATAR_BUCKET = "basketball-player-avatars";

async function uploadAndGetPublicUrl(
  bucket: string,
  path: string,
  file: File,
): Promise<string> {
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

function extOf(file: File): string {
  const name = file.name || "";
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return (ext || "jpg").toLowerCase();
}

export async function uploadBasketballTeamLogo(
  leagueId: string,
  teamId: string,
  file: File,
): Promise<string> {
  const path = `${leagueId}/${teamId}.${extOf(file)}`;
  return uploadAndGetPublicUrl(TEAM_LOGO_BUCKET, path, file);
}

export async function uploadBasketballPlayerAvatar(
  leagueId: string,
  playerId: string,
  file: File,
): Promise<string> {
  const path = `${leagueId}/${playerId}.${extOf(file)}`;
  return uploadAndGetPublicUrl(PLAYER_AVATAR_BUCKET, path, file);
}
