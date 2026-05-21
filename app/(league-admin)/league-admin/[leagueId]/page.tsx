// app/league-admin/[leagueId]/page.tsx
//
// League Management Center — per-league hub. Hosts the existing tabbed
// admin UI (Settings / Teams / Players / Games / Box Score / Members /
// Claims) under the new clean URL. The actual UI lives in
// components/league-admin/AdminHub so it can be reused by future
// deep-link routes (teams/[teamId], games/[gameId]/data-entry).
//
// Access enforcement is delegated to the AdminHub's internal AuthGate,
// which already calls /api/basketball-leagues/[id] and gates rendering
// on the returned access flags. The (league-admin) route-group layout
// in Phase 2 will add an outer server-side gate for defense in depth.

import { use } from "react";
import AdminHub from "@/components/league-admin/AdminHub";

export const dynamic = "force-dynamic";

export default function LeagueAdminLeaguePage({
  params,
}: {
  params: Promise<{ leagueId: string }>;
}) {
  const { leagueId } = use(params);
  return <AdminHub leagueId={leagueId} />;
}
