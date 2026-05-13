"use client";

/**
 * AnalyticsProvider — client-only wrapper that:
 *   1. Initializes PostHog once on mount.
 *   2. Tracks App Router pageviews on every client navigation.
 *   3. Identifies the current Supabase user when a session is present.
 *
 * Mount once near the root of the tree (inside app/layout.tsx).
 */

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/shared/supabase";
import {
  capturePageview,
  identifyUser,
  initPostHog,
  resetUser,
} from "@/lib/analytics/posthog";

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Identify on initial mount if a Supabase session already exists.
    supabase.auth.getUser().then(({ data }) => {
      if (cancelled) return;
      const user = data?.user;
      if (user?.id) {
        identifyUser(user.id, {
          email: user.email ?? undefined,
        });
      }
    });

    // Re-identify on sign-in, reset on sign-out.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user?.id) {
        identifyUser(session.user.id, { email: session.user.email ?? undefined });
      } else if (event === "SIGNED_OUT") {
        resetUser();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </>
  );
}

function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    if (typeof window === "undefined") return;
    const qs = searchParams?.toString();
    const url = window.location.origin + pathname + (qs ? `?${qs}` : "");
    capturePageview(url);
  }, [pathname, searchParams]);

  return null;
}
