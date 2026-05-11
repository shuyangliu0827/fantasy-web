// lib/contest-salary.ts
//
// Daily Fantasy salary-cap math. Pure functions, no DB / framework deps —
// safe to import on both server and client. Mirrored at the SQL layer by
// the contest_players_salary_range CHECK constraint (migration 025).

export const SALARY_CAP = 42_000;
export const ROSTER_SIZE = 5;
export const SALARY_MIN = 3_000;
export const SALARY_MAX = 12_000;
export const SALARY_STEP = 100;

// Weighting between recent form and full-season production. Tuned so a
// player on a 5-game heater rises faster than their season mean would
// suggest, without losing track of true talent level.
const RECENT_WEIGHT = 0.6;
const SEASON_WEIGHT = 0.4;

// Linear price curve: each projected fpt is worth $220, plus a $1,500
// floor before clamping. Calibrated against typical NBA fpts distributions
// so a 30-fpt projection prices around $8,100 and a 50-fpt projection
// hits the $12,000 ceiling.
const SALARY_SLOPE = 220;
const SALARY_OFFSET = 1_500;

export function calcProjectedPoints(last5AvgFp: number, seasonAvgFp: number): number {
  const last5  = Number.isFinite(last5AvgFp)  ? last5AvgFp  : 0;
  const season = Number.isFinite(seasonAvgFp) ? seasonAvgFp : 0;
  return RECENT_WEIGHT * last5 + SEASON_WEIGHT * season;
}

export function calcSalary(projectedPoints: number): number {
  const proj = Number.isFinite(projectedPoints) ? Math.max(0, projectedPoints) : 0;
  const raw = proj * SALARY_SLOPE + SALARY_OFFSET;
  const rounded = Math.round(raw / SALARY_STEP) * SALARY_STEP;
  if (rounded < SALARY_MIN) return SALARY_MIN;
  if (rounded > SALARY_MAX) return SALARY_MAX;
  return rounded;
}

// Per-1k value — bigger is better. Sentinel 0 for non-positive salaries
// (shouldn't occur after clamp, but defends against bad upstream data).
export function calcValue(projectedPoints: number, salary: number): number {
  if (!Number.isFinite(projectedPoints) || !Number.isFinite(salary) || salary <= 0) return 0;
  return (projectedPoints / salary) * 1000;
}

// Lineup-level cap result for the UI counter + server validation.
export type CapState = {
  totalSalary: number;
  remaining: number;        // SALARY_CAP - totalSalary, can go negative
  filled: number;           // 0..ROSTER_SIZE
  emptySlots: number;       // ROSTER_SIZE - filled
  avgPerEmptySlot: number;  // remaining / emptySlots; 0 when full
  overCap: boolean;         // totalSalary > SALARY_CAP
};

export function computeCapState(salaries: number[]): CapState {
  const totalSalary = salaries.reduce((sum, s) => sum + (Number.isFinite(s) ? s : 0), 0);
  const filled = salaries.filter((s) => s > 0).length;
  const emptySlots = Math.max(0, ROSTER_SIZE - filled);
  const remaining = SALARY_CAP - totalSalary;
  const avgPerEmptySlot = emptySlots > 0 ? Math.floor(remaining / emptySlots) : 0;
  return {
    totalSalary,
    remaining,
    filled,
    emptySlots,
    avgPerEmptySlot,
    overCap: totalSalary > SALARY_CAP,
  };
}
