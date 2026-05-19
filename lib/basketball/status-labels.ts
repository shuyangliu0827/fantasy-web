// lib/basketball/status-labels.ts
//
// Bilingual display labels for basketball_leagues.status and
// basketball_games.status enum values. Backend storage stays in English
// snake/lower case — translation happens only at the presentation layer.

export type LeagueStatus = "pending" | "approved" | "rejected" | "archived";
export type GameStatus = "scheduled" | "live" | "final" | "cancelled";

const LEAGUE_ZH: Record<LeagueStatus, string> = {
  pending: "审核中",
  approved: "已审核",
  rejected: "未通过",
  archived: "已归档",
};
const LEAGUE_EN: Record<LeagueStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  archived: "Archived",
};

export function leagueStatusLabel(
  status: string | null | undefined,
  lang: "zh" | "en",
): string {
  if (!status) return "";
  const key = status as LeagueStatus;
  const map = lang === "zh" ? LEAGUE_ZH : LEAGUE_EN;
  return map[key] ?? status;
}

const GAME_ZH: Record<GameStatus, string> = {
  scheduled: "待开始",
  live: "进行中",
  final: "已结束",
  cancelled: "已取消",
};
const GAME_EN: Record<GameStatus, string> = {
  scheduled: "Scheduled",
  live: "Live",
  final: "Final",
  cancelled: "Cancelled",
};

export function gameStatusLabel(
  status: string | null | undefined,
  lang: "zh" | "en",
): string {
  if (!status) return "";
  const key = status as GameStatus;
  const map = lang === "zh" ? GAME_ZH : GAME_EN;
  return map[key] ?? status;
}
