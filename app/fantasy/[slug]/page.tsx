// app/fantasy/[slug]/page.tsx
//
// Public alias — /fantasy/[slug] redirects to /league/[slug], the canonical
// fantasy league hub on the `leagues` table. The slug namespace matches
// exactly (both routes operate on `leagues.slug`); this alias exists only
// to satisfy the product-spec wording that fan-facing URLs use /fantasy/*.
//
// IMPORTANT: This is a fantasy-domain alias. It is NOT a bridge to
// basketball_leagues (Rule E) — basketball Management Center routes stay
// under /league-admin/[leagueId] with their own UUID namespace.

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function FantasyAliasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/league/${slug}`);
}
