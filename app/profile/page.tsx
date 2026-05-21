// app/profile/page.tsx
//
// Public alias — /profile resolves to the current user's public profile
// at /u/[username] when authenticated, or sends them to /auth/login with
// next=/profile when not. Auth lives in localStorage (bp_session) and in
// the Supabase session, so resolution has to happen client-side.

import ProfileAliasRedirector from "./_redirector";

export const dynamic = "force-dynamic";

export default function ProfileAliasPage() {
  return <ProfileAliasRedirector />;
}
