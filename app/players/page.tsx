// app/players/page.tsx
//
// Public alias — /players redirects to /rankings, which is the existing
// fan-facing player browsing/ranking surface in this codebase. When a
// dedicated player directory ships later, point this alias at it.

import { redirect } from "next/navigation";

export const dynamic = "force-static";

export default function PlayersAliasPage() {
  redirect("/rankings");
}
