// app/admin/basketball-leagues/[id]/page.tsx
//
// Legacy admin URL — redirects to the canonical Management Center route
// at /league-admin/[leagueId]. The UI itself moved to
// components/league-admin/AdminHub and is rendered by the new route.
//
// Preserves the query string (e.g. ?tab=teams) so bookmarked deep-links
// continue to land on the correct admin tab.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyAdminRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (Array.isArray(v)) {
      for (const item of v) qs.append(k, item);
    } else if (typeof v === "string") {
      qs.set(k, v);
    }
  }
  const query = qs.toString();
  redirect(`/league-admin/${id}${query ? `?${query}` : ""}`);
}
