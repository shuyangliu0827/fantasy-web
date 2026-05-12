// lib/basketball/contest-date.ts
//
// Pure helpers for resolving "today" and day-of-X UTC bounds in an
// IANA timezone. Used by the contest resolver / diagnostics so a
// CSBA-style league with admins in Asia/Shanghai sees the right day
// even when the server's wall clock is UTC.

/**
 * Returns YYYY-MM-DD for `now` interpreted in the given IANA timezone.
 * Uses the `en-CA` locale because it formats as 2026-05-12 natively.
 */
export function todayInTimezone(tz: string, now: Date = new Date()): string {
  // 'en-CA' gives YYYY-MM-DD; we still extract parts to be safe across runtimes.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}

/**
 * Given a calendar date in the league's timezone, return ISO 8601 UTC
 * timestamps marking [00:00:00, 23:59:59.999] of that local day.
 *
 * Implementation: find the offset of midnight-local-on-`date` using the
 * `Intl` formatter, then subtract that offset from the same naive UTC
 * timestamp to land on the true UTC instant.
 */
export function dayBoundsUtc(
  date: string,
  tz: string,
): { startUtc: string; endUtc: string } {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) {
    throw new Error(`bad date: ${date}`);
  }
  // Construct the wall-clock instant we WANT (midnight local) as if it
  // were UTC, then compute the actual UTC instant that yields the same
  // wall-clock reading in `tz`.
  const naiveStartUtc = Date.UTC(y, m - 1, d, 0, 0, 0, 0);
  const offsetMin = tzOffsetMinutes(tz, new Date(naiveStartUtc));
  const startMs = naiveStartUtc - offsetMin * 60_000;
  const endMs = startMs + 24 * 60 * 60 * 1000 - 1;
  return {
    startUtc: new Date(startMs).toISOString(),
    endUtc: new Date(endMs).toISOString(),
  };
}

/**
 * Minutes east of UTC for `tz` at `instant`. Asia/Shanghai → 480.
 * Uses Intl with timeZoneName: "shortOffset" so we don't ship our own
 * tzdata. Falls back to 0 if parsing fails.
 */
function tzOffsetMinutes(tz: string, instant: Date): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "shortOffset",
  });
  const parts = fmt.formatToParts(instant);
  const name = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  // Expected forms: "GMT", "GMT+8", "GMT-05:30", "UTC", "UTC+1".
  const m = name.match(/^(?:GMT|UTC)([+-])(\d{1,2})(?::(\d{2}))?$/);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  const hh = Number(m[2] ?? 0);
  const mm = Number(m[3] ?? 0);
  return sign * (hh * 60 + mm);
}
