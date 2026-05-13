/**
 * Blueprint Fantasy — PostHog analytics layer.
 *
 * Single entry point for product analytics, web analytics, and session replay.
 * All call sites should go through `trackEvent` / `identifyUser` / `resetUser`
 * rather than importing `posthog-js` directly, so we can swap providers or
 * disable analytics from one place.
 */

import posthog, { type PostHog } from "posthog-js";

type AnalyticsProps = Record<string, unknown>;

let initialized = false;

function getToken(): string | undefined {
  return process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
}

function getHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
}

/**
 * Initialize PostHog on the client. Safe to call multiple times; no-ops on the
 * server and when the project token is missing (e.g. local dev without keys).
 */
export function initPostHog(): PostHog | null {
  if (typeof window === "undefined") return null;
  if (initialized) return posthog;

  const token = getToken();
  if (!token) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[analytics] NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN not set — PostHog disabled.");
    }
    return null;
  }

  posthog.init(token, {
    api_host: getHost(),
    // We capture pageviews manually from AnalyticsProvider so App Router
    // client navigations are tracked correctly.
    capture_pageview: false,
    capture_pageleave: true,
    // Auto-capture clicks/inputs for Product Analytics out of the box.
    autocapture: true,
    // Only create person profiles for identified users — saves cost and is
    // friendlier for privacy. Anonymous users still produce events (used by
    // Web Analytics) but no persistent profile.
    person_profiles: "identified_only",
    // Session Replay — enabled with privacy-conscious masking. By default
    // PostHog already masks password inputs; we additionally mask all inputs
    // so emails, league names, chat messages, etc. don't leak into replays.
    session_recording: {
      maskAllInputs: true,
      maskTextSelector: "[data-ph-mask]",
    },
    // Reduce noise in development.
    loaded: (ph) => {
      if (process.env.NODE_ENV === "development") ph.debug(false);
    },
  });

  initialized = true;
  return posthog;
}

/** Returns the PostHog client if initialized, otherwise null. */
export function getPostHog(): PostHog | null {
  if (typeof window === "undefined") return null;
  if (!initialized) return null;
  return posthog;
}

/**
 * Track a custom event. No-ops if PostHog is not initialized.
 *
 * Naming convention: lowercase snake_case verbs (e.g. `click_signup`,
 * `submit_lineup`). See ANALYTICS_SETUP.md for the suggested event list.
 */
export function trackEvent(eventName: string, properties?: AnalyticsProps): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture(eventName, properties);
}

/**
 * Associate the current PostHog distinct_id with our Supabase auth user id.
 * Call once after login / session restore. Safe to call repeatedly.
 */
export function identifyUser(userId: string, properties?: AnalyticsProps): void {
  const ph = getPostHog();
  if (!ph || !userId) return;
  ph.identify(userId, properties);
}

/** Clear the identified user on logout so subsequent events are anonymous. */
export function resetUser(): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.reset();
}

/** Manually capture a pageview. Used by AnalyticsProvider on route changes. */
export function capturePageview(url: string): void {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture("$pageview", { $current_url: url });
}
