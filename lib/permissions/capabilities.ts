// lib/permissions/capabilities.ts
//
// Action-level capability checks layered on top of BasketballLeagueAccess.
// Use `can(action, access)` from UI code instead of reading individual
// boolean flags — keeps capability semantics centralized.

import type { BasketballLeagueAccess } from "@/lib/basketball/access";

export type LeagueAction =
  | "view"
  | "manage_league"
  | "manage_members"
  | "manage_teams_players_games"
  | "manage_own_team"
  | "input_stats"
  | "edit_own_player_profile";

export function can(
  action: LeagueAction,
  access: BasketballLeagueAccess,
): boolean {
  switch (action) {
    case "view":
      return access.canView;
    case "manage_league":
      return access.canManageLeague;
    case "manage_members":
      return access.canManageMembers;
    case "manage_teams_players_games":
      return access.canManageTeamsPlayersGames;
    case "manage_own_team":
      return access.canManageOwnTeam;
    case "input_stats":
      return access.canInputStats;
    case "edit_own_player_profile":
      return access.canEditOwnPlayerProfile;
  }
}

export type { BasketballLeagueAccess };
