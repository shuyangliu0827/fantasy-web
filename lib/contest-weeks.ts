// lib/contest-weeks.ts
//
// Pure helpers for Daily Fantasy season week numbering.
// Season weeks are Monday–Sunday UTC, numbered from the first contest's week.
// No ISO week numbers used.

import { getWeekStart, toDateStr } from "./contest-points";

/** Returns a Date from a YYYY-MM-DD string, interpreted as UTC midnight. */
export function parseDateStrUtc(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Returns the 1-based season week number for a given week-start date.
 * Week 1 begins at `seasonWeek1Start` (a Monday UTC).
 * Returns 1 for the first week, 2 for the second, etc.
 */
export function getSeasonWeekNumber(weekStart: Date, seasonWeek1Start: Date): number {
  const diffMs = weekStart.getTime() - seasonWeek1Start.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return Math.floor(diffDays / 7) + 1;
}

/**
 * Returns the Monday UTC of the week containing `date`.
 * Same logic as getWeekStart in contest-points, re-exported here for convenience.
 */
export { getWeekStart as getContestWeekStart };

/** Formats a YYYY-MM-DD string as Chinese short date: "4月27日" */
export function formatChineseDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${m}月${d}日`;
}

/**
 * Given a weekStart and seasonWeek1Start, returns a label string.
 *   zh: "Week 1 · 4月27日 - 5月3日"
 *   en: "Week 1 · Apr 27 – May 3"
 * If isCurrent is true, appends " · 当前周" (zh) or " · Current week" (en).
 */
export function formatWeekLabel(
  weekStart: Date,
  seasonWeek1Start: Date,
  lang: "zh" | "en",
  isCurrent: boolean,
): string {
  const weekNum = getSeasonWeekNumber(weekStart, seasonWeek1Start);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

  const startStr = toDateStr(weekStart);
  const endStr   = toDateStr(weekEnd);

  let range: string;
  if (lang === "zh") {
    range = `${formatChineseDateShort(startStr)} - ${formatChineseDateShort(endStr)}`;
  } else {
    range = `${fmtShortEn(weekStart)} – ${fmtShortEn(weekEnd)}`;
  }

  const base = `Week ${weekNum} · ${range}`;
  if (isCurrent) {
    return base + (lang === "zh" ? " · 当前周" : " · Current week");
  }
  return base;
}

function fmtShortEn(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Returns today's Monday UTC as YYYY-MM-DD string. */
export function getCurrentWeekStartStr(): string {
  return toDateStr(getWeekStart(new Date()));
}
