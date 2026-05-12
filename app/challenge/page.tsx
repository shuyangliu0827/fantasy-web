"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ChallengeHero from "@/components/challenge/ChallengeHero";
import HowItWorks from "@/components/challenge/HowItWorks";
import TodayChallengePreview from "@/components/challenge/TodayChallengePreview";
import WhyPlay from "@/components/challenge/WhyPlay";
import ExploreBlueprint from "@/components/challenge/ExploreBlueprint";
import FinalCTA from "@/components/challenge/FinalCTA";
import { track } from "@/lib/shared/analytics";

function ChallengePageContent() {
  const params = useSearchParams();

  const { qs, utm, contestHref, dailyBoardHref } = useMemo(() => {
    const utmObj = {
      utm_source: params.get("utm_source"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
    };
    const queryString = params.toString();
    return {
      qs: queryString,
      utm: utmObj,
      contestHref: queryString ? `/contest?${queryString}` : "/contest",
      dailyBoardHref: queryString
        ? `/contest/leaderboard?${queryString}`
        : "/contest/leaderboard",
    };
  }, [params]);

  useEffect(() => {
    track("challenge_view", utm);
  }, [utm]);

  return (
    <>
      <LightHeader activeHref="/contest" />
      <main style={{ background: "#fff" }}>
        <ChallengeHero contestHref={contestHref} utm={utm} />
        <HowItWorks />
        <TodayChallengePreview
          contestHref={contestHref}
          dailyBoardHref={dailyBoardHref}
        />
        <WhyPlay />
        <ExploreBlueprint qs={qs} />
        <FinalCTA contestHref={contestHref} utm={utm} />
      </main>
    </>
  );
}

export default function ChallengePage() {
  return (
    <Suspense fallback={null}>
      <ChallengePageContent />
    </Suspense>
  );
}
