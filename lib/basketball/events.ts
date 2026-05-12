// lib/basketball/events.ts
//
// Pure event → box-score derivation. The single source of truth for how a
// stat event mutates an aggregate row. Used both by lib/basketball/aggregate.ts
// (server) and the optimistic UI in components/basketball/StatEventInput.tsx.

export type StatEventType =
  | "two_pt_made"
  | "two_pt_missed"
  | "three_pt_made"
  | "three_pt_missed"
  | "ft_made"
  | "ft_missed"
  | "reb"
  | "ast"
  | "stl"
  | "blk"
  | "tov";

export type BoxScoreTotals = {
  pts: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
};

export const EMPTY_TOTALS: BoxScoreTotals = {
  pts: 0,
  fgm: 0,
  fga: 0,
  fg3m: 0,
  fg3a: 0,
  ftm: 0,
  fta: 0,
  reb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
};

export function applyEvent(prev: BoxScoreTotals, type: StatEventType): BoxScoreTotals {
  const next = { ...prev };
  switch (type) {
    case "two_pt_made":
      next.fga += 1;
      next.fgm += 1;
      next.pts += 2;
      break;
    case "two_pt_missed":
      next.fga += 1;
      break;
    case "three_pt_made":
      next.fga += 1;
      next.fgm += 1;
      next.fg3a += 1;
      next.fg3m += 1;
      next.pts += 3;
      break;
    case "three_pt_missed":
      next.fga += 1;
      next.fg3a += 1;
      break;
    case "ft_made":
      next.fta += 1;
      next.ftm += 1;
      next.pts += 1;
      break;
    case "ft_missed":
      next.fta += 1;
      break;
    case "reb":
      next.reb += 1;
      break;
    case "ast":
      next.ast += 1;
      break;
    case "stl":
      next.stl += 1;
      break;
    case "blk":
      next.blk += 1;
      break;
    case "tov":
      next.tov += 1;
      break;
  }
  return next;
}

export function totalsFromEvents(events: Array<{ event_type: StatEventType }>): BoxScoreTotals {
  return events.reduce<BoxScoreTotals>(
    (acc, ev) => applyEvent(acc, ev.event_type),
    { ...EMPTY_TOTALS },
  );
}
