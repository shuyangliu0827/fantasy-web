// lib/week-utils.ts
// Shared week date helpers for scoreboard and matchup pages.
// Weeks run Monday–Sunday (UTC). Week 1 starts on the first Monday on or after
// the league's draft_completed_at date.

export function formatDateStr(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Returns the first Monday (UTC midnight) on or after the given date.
 * If draftCompletedAt is not provided, returns the most recent Monday (or today if Monday).
 */
export function getOfficialLeagueStartDate(draftCompletedAt?: string | null): Date {
  const src = draftCompletedAt ? new Date(draftCompletedAt) : new Date();
  const base = new Date(Date.UTC(src.getUTCFullYear(), src.getUTCMonth(), src.getUTCDate()));
  const day = base.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Days until next Monday: 0 if already Monday, otherwise (8 - day) % 7
  const daysToMonday = (8 - day) % 7;
  base.setUTCDate(base.getUTCDate() + daysToMonday);
  return base;
}

/**
 * Returns the 7 UTC Date objects for the given week number (Mon–Sun).
 * leagueStart must be a Monday (output of getOfficialLeagueStartDate).
 */
export function getWeekDates(week: number, leagueStart: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(leagueStart);
    d.setUTCDate(leagueStart.getUTCDate() + (week - 1) * 7 + i);
    dates.push(d);
  }
  return dates;
}

export function getWeekDateStrings(week: number, leagueStart: Date): string[] {
  return getWeekDates(week, leagueStart).map(formatDateStr);
}

export function getTodayStr(): string {
  return formatDateStr(new Date());
}

export function getCurrentWeek(leagueStart: Date): number {
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const diff = todayUtc.getTime() - leagueStart.getTime();
  if (diff < 0) return 1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

export function getWeekStatus(week: number, leagueStart: Date): "past" | "current" | "future" {
  const dates = getWeekDateStrings(week, leagueStart);
  const today = getTodayStr();
  if (today > dates[6]) return "past";
  if (today < dates[0]) return "future";
  return "current";
}
