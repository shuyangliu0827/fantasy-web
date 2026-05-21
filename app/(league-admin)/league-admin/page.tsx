// app/league-admin/page.tsx
//
// League Management Center — dashboard entry point. Phase 1 ships a
// minimal landing page that gates on RoleContext client-side. Phase 2
// will replace this with the full module grid (Teams / Players / Games /
// Data Entry / Roles / Settings) and a server-side gate.

import LightHeader from "@/components/LightHeader";
import LeagueAdminLanding from "./_landing";

export const dynamic = "force-dynamic";

export default function LeagueAdminPage() {
  return (
    <>
      <LightHeader activeHref="/league-admin" />
      <LeagueAdminLanding />
    </>
  );
}
