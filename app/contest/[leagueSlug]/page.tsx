import { redirect } from "next/navigation";

// Canonical entry for an authorized basketball league contest is the
// build page. The "nba" slug is redirected to the NBA build page so old
// /contest/nba links never fall into the dynamic [leagueSlug] route.
export default async function LeagueContestRoot({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = await params;
  if (leagueSlug === "nba") {
    redirect("/contest/nba/build");
  }
  redirect(`/contest/${leagueSlug}/build`);
}
