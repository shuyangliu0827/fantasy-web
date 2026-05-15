// lib/basketball/role-labels.ts
//
// Bilingual display labels for basketball_league_members.role. The
// enum value is the wire/storage format; this module only handles
// presentation. Used by admin role pickers, member approval rows, and
// the public league role badge.

import type { MemberRole } from "@/lib/basketball/access";

const ZH: Record<MemberRole, string> = {
  league_admin: "联赛管理员",
  team_manager: "球队经理",
  player: "球员",
  referee: "裁判",
  scorekeeper: "记分员",
  viewer: "观察者",
};

const EN: Record<MemberRole, string> = {
  league_admin: "League Admin",
  team_manager: "Team Manager",
  player: "Player",
  referee: "Referee",
  scorekeeper: "Scorekeeper",
  viewer: "Viewer",
};

export function memberRoleLabel(role: MemberRole, lang: "zh" | "en"): string {
  return (lang === "zh" ? ZH : EN)[role] ?? role;
}

export const MEMBER_ROLE_VALUES: MemberRole[] = [
  "league_admin",
  "team_manager",
  "player",
  "referee",
  "scorekeeper",
  "viewer",
];
