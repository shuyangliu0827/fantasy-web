// lib/week-utils.ts
// Canonical matchup week helpers. Weeks run Monday–Sunday in UTC.

export const CANONICAL_TIMEZONE = "UTC";
const DAY_MS = 24 * 60 * 60 * 1000;

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
