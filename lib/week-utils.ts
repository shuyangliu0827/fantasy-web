// lib/week-utils.ts
// Canonical matchup week helpers. Weeks run Monday–Sunday in UTC.

export const CANONICAL_TIMEZONE = "UTC";
export const STARTER_SLOTS = ["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"] as const;
export const BENCH_SLOTS = ["BE1", "BE2", "BE3"] as const;
export const VALID_ACTIVE_STARTER_SLOTS = new Set<string>(STARTER_SLOTS);
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Today's date string in the browser/server's LOCAL timezone ("YYYY-MM-DD").
 * Use this — not getTodayStr() — when keying against BDL game data, which is
 * indexed by the US Eastern game date, not UTC. getTodayStr() is UTC-based and
 * diverges from local date after ~7 PM CDT / ~8 PM EDT, causing schedule lookups
 * to miss all games for the remainder of the evening.
 */
export function getLocalDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Converts a local-time Date's calendar date (year/month/day) into a UTC
 * midnight Date so addUtcDays() arithmetic stays aligned with the user's
 * local calendar rather than UTC. Use this to initialize weekStart on the
 * roster page — not normalizeUtcDate(), which uses the UTC date of the
 * instant and diverges from local date in the same evening window.
 */
export function localToUtcMidnight(d: Date = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export function normalizeUtcDate(value: Date | string): Date {
  const src = value instanceof Date ? value : new Date(value);
  return new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), src.getUTCDate()));
}

export function formatDateStr(value: Date | string): string {
  const d = normalizeUtcDate(value);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseDateStr(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function addUtcDays(value: Date | string, days: number): Date {
  const d = normalizeUtcDate(value);
  return new Date(d.getTime() + days * DAY_MS);
}

export function getOfficialLeagueStartDate(draftCompletedAt?: string | null): Date | null {
  if (!draftCompletedAt) return null;
  const base = normalizeUtcDate(draftCompletedAt);
  const day = base.getUTCDay();
  const daysToMonday = day === 1 ? 0 : (8 - day) % 7;
  return addUtcDays(base, daysToMonday);
}

export function getWeekStartDate(week: number, leagueStart: Date | null): Date | null {
  if (!leagueStart || week < 1) return null;
  return addUtcDays(leagueStart, (week - 1) * 7);
}

export function getWeekDates(week: number, leagueStart: Date | null): Date[] {
  const weekStart = getWeekStartDate(week, leagueStart);
  if (!weekStart) return [];
  return Array.from({ length: 7 }, (_, index) => addUtcDays(weekStart, index));
}

export function getWeekDateStrings(week: number, leagueStart: Date | null): string[] {
  return getWeekDates(week, leagueStart).map(formatDateStr);
}

export function getTodayStr(): string {
  return formatDateStr(new Date());
}

export function getCurrentWeek(leagueStart: Date | null, today: Date | string = new Date()): number {
  if (!leagueStart) return 1;
  const todayUtc = normalizeUtcDate(today);
  const diff = todayUtc.getTime() - leagueStart.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * DAY_MS)) + 1;
}

export function getWeekStatus(week: number, leagueStart: Date | null, today: Date | string = new Date()): "pending" | "past" | "current" | "future" {
  if (!leagueStart) return "pending";
  const dates = getWeekDateStrings(week, leagueStart);
  if (dates.length === 0) return "pending";
  const todayStr = formatDateStr(today);
  if (todayStr < dates[0]) return week === 1 ? "pending" : "future";
  if (todayStr > dates[6]) return "past";
  return "current";
}

// End of the NBA Finals — the last possible day of any scoring week.
// Update this each season. When the exact date is unknown, round up.
export const NBA_FINALS_END_UTC = new Date("2026-06-22T00:00:00.000Z");

/**
 * Total number of scoring weeks from leagueStart through the end of the NBA Finals.
 * Drives all week selectors so they expand naturally as the season progresses instead
 * of being capped at a hardcoded number.
 */
export function getSeasonTotalWeeks(leagueStart: Date | null): number {
  if (!leagueStart) return 30; // generous fallback before draft completes
  const diffMs = NBA_FINALS_END_UTC.getTime() - leagueStart.getTime();
  return Math.max(1, Math.ceil(diffMs / (7 * DAY_MS)));
}

export function getScoringWeekRange(week: number, leagueStart: Date | null): {
  week: number;
  startDate: string;
  endDate: string;
  dateStrings: string[];
} | null {
  const dateStrings = getWeekDateStrings(week, leagueStart);
  if (dateStrings.length === 0) return null;
  return {
    week,
    startDate: dateStrings[0],
    endDate: dateStrings[6],
    dateStrings,
  };
}
