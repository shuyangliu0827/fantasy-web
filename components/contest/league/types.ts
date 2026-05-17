// Shared types for authorized-basketball-league fantasy contests.
// Used by app/contest/[leagueSlug]/build and /leaderboard pages.

export type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "archived";
  visibility: "public" | "invite_only" | "private";
  is_contest_enabled: boolean;
  logo_url?: string | null;
};

export type Contest = {
  id: string;
  basketball_league_id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
  salary_cap: number;
  lineup_size: number;
};

export type PoolPlayer = {
  contest_player_id: string;
  player_id: string;
  name: string;
  position: string | null;
  team_name: string | null;
  team_abbr: string | null;
  salary: number;
  tier: number;
  projected_points: number;
  season_avg_fp: number;
  games_played: number;
};

export type LineupSlot = { slot: number; player_id: string };

export type LineupResponse = {
  lineup_id?: string;
  contest_id?: string;
  status: "draft" | "submitted" | "scored";
  total_fpts: number | null;
  rank: number | null;
  submitted_at: string | null;
  players: LineupSlot[];
};

export type LeaderEntry = {
  id: string;
  user_id: string;
  status: string;
  total_fpts: number | null;
  rank: number | null;
  submitted_at: string | null;
};

export const SLOT_LABELS = ["PG", "SG", "SF", "PF", "C"] as const;
