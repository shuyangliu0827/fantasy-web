"use client";

// Renders the user-facing message for a contest that can't materialize.
// Pulls its copy from the `unavailable` kind returned by useLeagueContest,
// and surfaces the league timezone + resolved local date when present so
// admins can immediately tell whether the resolver looked at the wrong day.

import { useLang } from "@/lib/lang";
import type { UnavailableKind } from "./useLeagueContest";

export default function UnavailableNotice({
  kind,
  date,
  timezone,
}: {
  kind: UnavailableKind;
  date: string | null;
  timezone: string | null;
}) {
  const { t } = useLang();
  const tag = date && timezone ? ` (${timezone}, ${date})` : "";

  const messages: Record<UnavailableKind, { zh: string; en: string; icon: string }> = {
    league_not_found: {
      zh: "找不到该联赛。",
      en: "League not found.",
      icon: "❓",
    },
    league_not_enabled: {
      zh: "该联赛暂未开放每日竞赛。",
      en: "This league is not available for fantasy contest yet.",
      icon: "🚧",
    },
    no_contest_today: {
      zh: `今日没有比赛${tag}。请等待联赛安排下一场比赛后再来。`,
      en: `No games scheduled today${tag}. Check back once the league schedules its next game.`,
      icon: "🏀",
    },
    no_teams_in_games: {
      zh: `今日有比赛${tag}，但部分比赛缺少主/客队设置。请联系联赛管理员。`,
      en: `Games are scheduled today${tag}, but some games are missing home/away teams. Please contact the league admin.`,
      icon: "⚠️",
    },
    no_players_in_pool: {
      zh: `今日上场队伍下没有任何球员${tag}。请联赛管理员将球员加入队伍。`,
      en: `No players are assigned to today's teams${tag}. Please ask the league admin to roster players to those teams.`,
      icon: "⚠️",
    },
  };

  const m = messages[kind];

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: "40px 24px",
        textAlign: "center",
        color: "#64748b",
      }}
    >
      <div style={{ fontSize: 36, marginBottom: 12 }}>{m.icon}</div>
      <p style={{ margin: 0 }}>{t(m.zh, m.en)}</p>
    </div>
  );
}
