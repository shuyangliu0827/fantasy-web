// lib/schedule-mock.ts
// Static schedule difficulty lookup — used as a placeholder until a real schedule feed is integrated.
// ALL values here are approximate estimates for the current week.
// The UI must display "(est.)" next to any value derived from this file.

export interface ScheduleEstimate {
  games: number;                           // estimated games in next 7 days
  rating: 'easy' | 'medium' | 'hard';     // relative difficulty
}

// Values represent rough schedule strength for the current NBA week.
// Update these manually or replace with a live schedule API when available.
export const SCHEDULE_MOCK: Record<string, ScheduleEstimate> = {
  ATL: { games: 3, rating: 'medium' },
  BOS: { games: 4, rating: 'hard' },
  BKN: { games: 3, rating: 'easy' },
  CHA: { games: 4, rating: 'easy' },
  CHI: { games: 3, rating: 'medium' },
  CLE: { games: 4, rating: 'medium' },
  DAL: { games: 4, rating: 'medium' },
  DEN: { games: 3, rating: 'medium' },
  DET: { games: 4, rating: 'easy' },
  GSW: { games: 4, rating: 'medium' },
  HOU: { games: 3, rating: 'medium' },
  IND: { games: 4, rating: 'medium' },
  LAC: { games: 3, rating: 'medium' },
  LAL: { games: 3, rating: 'hard' },
  MEM: { games: 4, rating: 'easy' },
  MIA: { games: 3, rating: 'medium' },
  MIL: { games: 4, rating: 'medium' },
  MIN: { games: 3, rating: 'hard' },
  NOP: { games: 4, rating: 'easy' },
  NYK: { games: 3, rating: 'hard' },
  OKC: { games: 4, rating: 'medium' },
  ORL: { games: 3, rating: 'medium' },
  PHI: { games: 3, rating: 'medium' },
  PHX: { games: 4, rating: 'medium' },
  POR: { games: 4, rating: 'easy' },
  SAC: { games: 3, rating: 'medium' },
  SAS: { games: 4, rating: 'easy' },
  TOR: { games: 3, rating: 'easy' },
  UTA: { games: 4, rating: 'easy' },
  WAS: { games: 3, rating: 'easy' },
};

export function getScheduleMock(teamAbbr: string): ScheduleEstimate {
  return SCHEDULE_MOCK[teamAbbr] ?? { games: 4, rating: 'medium' };
}
