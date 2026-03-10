// lib/week-utils.ts
// Shared week date helpers for scoreboard and matchup pages.
// Week 1 starts Sunday March 9, 2026. Each week is Sun–Sat (7 days).

export const WEEK_1_START = new Date("2026-03-09T00:00:00");

export function formatDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getWeekDates(week: number): Date[] {
  const dates: Date[] = [];
  const start = new Date(WEEK_1_START);
  start.setDate(start.getDate() + (week - 1) * 7);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getWeekDateStrings(week: number): string[] {
  return getWeekDates(week).map(formatDateStr);
}

export function getTodayStr(): string {
  return formatDateStr(new Date());
}

export function getCurrentWeek(): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - WEEK_1_START.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function getWeekStatus(week: number): "past" | "current" | "future" {
  const dates = getWeekDateStrings(week);
  const today = getTodayStr();
  if (today > dates[6]) return "past";
  if (today < dates[0]) return "future";
  return "current";
}
