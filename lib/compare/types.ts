// lib/compare/types.ts
// Single source of truth for all Player Compare feature interfaces.

export type Timeframe = 'season' | 'last7' | 'last15' | 'lastSeason';
export type CompareMode = 'points' | 'categories';
export type DecisionView = 'overview' | 'draft' | 'trade' | 'shortterm' | 'stability';

export interface GameLog {
  date: string;      // YYYY-MM-DD
  fpts: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fg3m: number;
  tov: number;
  min: number;
  fgm: number;
  fga: number;
  fg3a?: number;
  ftm: number;
  fta: number;
  played: boolean;   // false = DNP / 0-min entry
}

export interface CompareStats {
  // Identity
  playerId: string;              // BDL numeric player_id as string
  playerName: string;
  team: string;
  position: string;
  timeframe: Timeframe;
  dataSource: 'live' | 'cache' | 'static';

  // Production (per-game averages)
  fptsPerGame: number;
  totalFpts: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fg3mPg: number;    // 3PM per game — explicit ESPN scoring stat
  fgmPg: number;    // FGM per game — needed for full 11-term ESPN reweight
  fgaPg: number;    // FGA per game — needed for full 11-term ESPN reweight
  ftmPg: number;    // FTM per game — needed for full 11-term ESPN reweight
  ftaPg: number;    // FTA per game — needed for full 11-term ESPN reweight
  tov: number;
  mpg: number;
  gp: number;

  // Shooting splits (0–100 scale for display)
  fgPct: number;
  ftPct: number;
  fg3Pct: number;

  // Form (derived from gameLogs)
  recentTrend: 'up' | 'flat' | 'down';
  last5FptsAvg: number;
  trendDelta: number;            // last5FptsAvg - fptsPerGame (signed)

  // Stability (derived from gameLogs)
  consistencyScore: number;      // 0–100, higher = more consistent
  stdDev: number;
  floor: number;                 // ~25th percentile fpts
  ceiling: number;               // ~75th percentile fpts
  boomRate: number;              // fraction of games at or above ceiling threshold
  bustRate: number;              // fraction of games at or below floor threshold

  // Availability
  gamesPlayed: number;
  gamesAvailable: number;
  playRate: number;              // 0–1
  injuryStatus: string | null;

  // Schedule (mocked until real data feed exists — clearly labeled in UI)
  next7Games: number;
  scheduleRating: 'easy' | 'medium' | 'hard';

  // Raw game log for sparklines / further analysis
  gameLogs: GameLog[];
}

export interface KeyEdge {
  category: string;
  categoryZh: string;
  winnerId: string;
  winnerName: string;
  loserId: string;
  loserName: string;
  winnerValue: number;
  loserValue: number;
  diff: number;
  pctDiff: number;
  significance: 'major' | 'moderate' | 'minor';
  label: string;                 // e.g. "+3.2 FPTS/G"
}

export interface QuickDecision {
  recommendedPlayerId: string;
  recommendedPlayerName: string;
  scenario: string;              // e.g. "Points League · Season"
  reason: string;
  reasonZh: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface ScenarioRecommendation {
  view: DecisionView;
  winnerId: string;
  winnerName: string;
  reasoning: string;
  reasoningZh: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface RiskNote {
  playerId: string;
  playerName: string;
  type: 'hot_streak' | 'cold_streak' | 'consistency_warning' | 'availability_risk' | 'small_sample';
  message: string;
  messageZh: string;
  severity: 'warning' | 'info';
}

export interface CompareResult {
  players: CompareStats[];
  quickDecision: QuickDecision;
  keyEdges: KeyEdge[];
  scenarioRecommendations: Partial<Record<DecisionView, ScenarioRecommendation>>;
  riskNotes: RiskNote[];
  meta: {
    timeframe: Timeframe;
    date: string;
    fromCache: boolean;
  };
}

export interface CompareApiResponse {
  status: 'success' | 'error' | 'partial';
  result?: CompareResult;
  message?: string;
}
