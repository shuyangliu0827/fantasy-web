"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import GameMediaList from "@/components/basketball/GameMediaList";
import ShareButton from "@/components/basketball/ShareButton";
import { basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";
import { statLabel, type StatKey } from "@/lib/basketball/stat-labels";
import { gameStatusLabel } from "@/lib/basketball/status-labels";

type LeagueLite = {
  id: string;
  slug: string;
  name: string;
  visibility: "public" | "invite_only" | "private";
};

type Team = { id: string; name: string; abbreviation: string | null; city: string | null };

type Game = {
  id: string;
  scheduled_at: string | null;
  status: "scheduled" | "live" | "final" | "cancelled";
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

type BoxRow = {
  player_id: string;
  team_id: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  fantasy_points: number | null;
  basketball_players: { id: string; display_name: string; position: string | null };
};

type Access = {
  canView: boolean;
  canInputStats: boolean;
  canManageLeague: boolean;
  visibility: "public" | "invite_only" | "private";
  memberStatus: "pending" | "approved" | "rejected" | "removed" | null;
};

const STAT_COLS: Array<{ key: keyof BoxRow; statKey: StatKey }> = [
  { key: "pts", statKey: "pts" },
  { key: "reb", statKey: "reb" },
  { key: "ast", statKey: "ast" },
  { key: "stl", statKey: "stl" },
  { key: "blk", statKey: "blk" },
  { key: "tov", statKey: "tov" },
  { key: "fgm", statKey: "fgm" },
  { key: "fga", statKey: "fga" },
  { key: "fg3m", statKey: "fg3m" },
  { key: "fg3a", statKey: "fg3a" },
  { key: "ftm", statKey: "ftm" },
  { key: "fta", statKey: "fta" },
];

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ slug: string; gameId: string }>;
}) {
  const { slug, gameId } = use(params);
  const { t, lang } = useLang();
  const [league, setLeague] = useState<LeagueLite | null>(null);
  const [leagueAccess, setLeagueAccess] = useState<Access | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [boxScore, setBoxScore] = useState<BoxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Resolve league via slug first to gate on visibility correctly.
    const leagueRes = await basketballJson<{ league: LeagueLite; access: Access }>(
      `/api/basketball-leagues/by-slug/${slug}`,
    );
    if (leagueRes.error || !leagueRes.data) {
      setErr(leagueRes.error ?? "not_found");
      setLoading(false);
      return;
    }
    setLeague(leagueRes.data.league);
    setLeagueAccess(leagueRes.data.access);
    if (!leagueRes.data.access.canView) {
      setLoading(false);
      return;
    }

    const gameRes = await basketballJson<{
      game: Game;
      teams: Team[];
      box_score: BoxRow[];
    }>(`/api/basketball-games/${gameId}`);
    if (gameRes.error || !gameRes.data) {
      setErr(gameRes.error ?? "game_load_failed");
      setLoading(false);
      return;
    }
    setGame(gameRes.data.game);
    setTeams(gameRes.data.teams);
    setBoxScore(gameRes.data.box_score);
    setLoading(false);
  }, [slug, gameId]);

  useEffect(() => {
    load();
  }, [load]);

  // While the game is live, refresh the box score + score every 10s so
  // viewers see scorekeeper updates without manual reload.
  useEffect(() => {
    if (game?.status !== "live") return;
    const id = setInterval(() => {
      void load();
    }, 10_000);
    return () => clearInterval(id);
  }, [game?.status, load]);

  if (loading) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }
  if (err || !league || !leagueAccess) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {err === "not_found" || err === "league_not_found"
            ? t("找不到该联赛。", "League not found.")
            : err}
        </main>
      </>
    );
  }
  if (!leagueAccess.canView && leagueAccess.visibility === "private") {
    return (
      <>
        <LightHeader activeHref="" />
        <PrivateLeagueWall leagueName={league.name} />
      </>
    );
  }
  if (!leagueAccess.canView && leagueAccess.visibility === "invite_only") {
    return (
      <>
        <LightHeader activeHref="" />
        <InviteOnlyLeagueWall
          leagueId={league.id}
          leagueName={league.name}
          initialStatus={leagueAccess.memberStatus ?? null}
        />
      </>
    );
  }
  if (!game) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该比赛。", "Game not found.")}
        </main>
      </>
    );
  }

  const teamName = (id: string | null) =>
    id ? teams.find((tm) => tm.id === id)?.name ?? "—" : "—";
  const homePlayers = boxScore.filter((r) => r.team_id === game.home_team_id);
  const awayPlayers = boxScore.filter((r) => r.team_id === game.away_team_id);

  return (
    <>
      <LightHeader activeHref="" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px 80px" }}>
        <Link
          href={`/basketball-leagues/${slug}`}
          style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 700 }}
        >
          ← {league.name}
        </Link>
        <LeagueVisibilityBadge visibility={league.visibility} />

        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 16,
            padding: 24,
            marginTop: 14,
            marginBottom: 24,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <TeamPanel
              slug={slug}
              teamId={game.away_team_id}
              name={teamName(game.away_team_id)}
              score={game.away_score}
            />
            <div style={{ fontSize: 18, color: "#94a3b8", fontWeight: 900 }}>@</div>
            <TeamPanel
              slug={slug}
              teamId={game.home_team_id}
              name={teamName(game.home_team_id)}
              score={game.home_score}
            />
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {game.scheduled_at ? new Date(game.scheduled_at).toLocaleString() : t("时间待定", "TBD")}
            </div>
            <div
              style={{
                marginTop: 4,
                padding: "4px 10px",
                background: game.status === "final" ? "#dcfce7" : "#e0e7ff",
                color: game.status === "final" ? "#166534" : "#3730a3",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: "0.06em",
                display: "inline-block",
              }}
            >
              {gameStatusLabel(game.status, lang)}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <ShareButton
                label={t("分享比赛", "Share Game")}
                shareTitle={`${teamName(game.away_team_id)} @ ${teamName(game.home_team_id)}`}
                compact
              />
              {leagueAccess.canInputStats && (
                <Link
                  href={`/admin/basketball-leagues/${league.id}`}
                  style={{
                    fontSize: 12,
                    color: "#1e3a8a",
                    textDecoration: "none",
                    fontWeight: 800,
                    alignSelf: "center",
                  }}
                >
                  {t("数据录入 →", "Manage stats →")}
                </Link>
              )}
            </div>
          </div>
        </div>

        <BoxScoreTable
          title={t(`${teamName(game.away_team_id)} 数据`, `${teamName(game.away_team_id)} box score`)}
          rows={awayPlayers}
          slug={slug}
        />
        <div style={{ height: 18 }} />
        <BoxScoreTable
          title={t(`${teamName(game.home_team_id)} 数据`, `${teamName(game.home_team_id)} box score`)}
          rows={homePlayers}
          slug={slug}
        />

        <GameMediaList gameId={game.id} canManage={leagueAccess.canManageLeague} />
      </main>
    </>
  );
}

function TeamPanel({
  slug,
  teamId,
  name,
  score,
}: {
  slug: string;
  teamId: string | null;
  name: string;
  score: number | null;
}) {
  const heading = (
    <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", letterSpacing: "-0.02em" }}>
      {name}
    </div>
  );
  return (
    <div>
      {teamId ? (
        <Link
          href={`/basketball-leagues/${slug}/teams/${teamId}`}
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {heading}
        </Link>
      ) : (
        heading
      )}
      <div style={{ fontSize: 36, fontWeight: 900, color: "#1e3a8a", lineHeight: 1 }}>
        {score ?? "—"}
      </div>
    </div>
  );
}

function BoxScoreTable({
  title,
  rows,
  slug,
}: {
  title: string;
  rows: BoxRow[];
  slug: string;
}) {
  const { t, lang } = useLang();
  if (rows.length === 0) {
    return (
      <div>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.01em",
            margin: "0 0 10px",
          }}
        >
          {title}
        </h2>
        <div
          style={{
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 20,
            color: "#94a3b8",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {t("暂无数据", "No data yet")}
        </div>
      </div>
    );
  }
  return (
    <div>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.01em",
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={th()}>{t("球员", "Player")}</th>
              {STAT_COLS.map((c) => (
                <th key={c.key} style={{ ...th(), textAlign: "center" }}>
                  {statLabel(c.statKey, lang)}
                </th>
              ))}
              <th style={{ ...th(), textAlign: "center", color: "#1e3a8a" }}>
                {statLabel("fpts", lang)}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.player_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={td()}>
                  <Link
                    href={`/basketball-leagues/${slug}/players/${r.player_id}`}
                    style={{ color: "#0f172a", fontWeight: 700, textDecoration: "none" }}
                  >
                    {r.basketball_players?.display_name ?? "—"}
                  </Link>
                </td>
                {STAT_COLS.map((c) => (
                  <td key={c.key} style={{ ...td(), textAlign: "center" }}>
                    {Number(r[c.key] ?? 0)}
                  </td>
                ))}
                <td
                  style={{
                    ...td(),
                    textAlign: "center",
                    fontWeight: 900,
                    color: "#1e3a8a",
                  }}
                >
                  {r.fantasy_points != null ? Number(r.fantasy_points).toFixed(1) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function th(): React.CSSProperties {
  return {
    padding: "10px 12px",
    color: "#475569",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    textAlign: "left",
  };
}
function td(): React.CSSProperties {
  return { padding: "10px 12px", color: "#0f172a" };
}
