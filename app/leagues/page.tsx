// app/leagues/page.tsx
//
// Public alias — /leagues redirects to the existing public league browse
// at /league. URL kept stable for SEO and existing internal links.

import { redirect } from "next/navigation";

export const dynamic = "force-static";

export default function LeaguesAliasPage() {
  redirect("/league");
}
