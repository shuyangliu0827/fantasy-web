// lib/analytics.ts
//
// Lightweight client-side analytics shim. v1 just appends to a global queue
// so a real provider can be wired up later without touching call sites.
// Server-side calls are no-ops.

export type AnalyticsEvent = {
  event: string;
  props?: Record<string, unknown>;
  ts: number;
};

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const w = window as typeof window & { __bpAnalytics?: AnalyticsEvent[] };
  if (!Array.isArray(w.__bpAnalytics)) w.__bpAnalytics = [];
  w.__bpAnalytics.push({ event, props, ts: Date.now() });
}
