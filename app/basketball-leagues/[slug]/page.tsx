"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import PendingAccessNotice from "@/components/basketball/PendingAccessNotice";
import { basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  visibility: "public" | "invite_only" | "private";
  is_contest_enabled: boolean;
};

type Access = {
  canView: boolean;
  canManageLeague: boolean;
  memberStatus: "pending" | "approved" | "rejected" | "removed" | null;
  visibility: "public" | "invite_only" | "private";
};

type Team = { id: string; name: string; abbreviation: string | null; city: string | null };
type Player = { id: string; display_name: string; position: string | null; team_id: string | null };
type Game = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

export default function BasketballLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t } = useLang();
  const [league, setLeague] = useState<League | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await basketballJson<{ league: League; access: Access }>(
        `/api/basketball-leagues/by-slug/${slug}`,
      );
      if (cancelled) return;
      if (error || !data) {
        setErr(error ?? "not_found");
        setLoading(false);
        return;
      }
      setLeague(data.league);
      setAccess(data.access);
      if (data.access.canView) {
        const [teamsRes, playersRes, gamesRes] = await Promise.all([
          basketballJson<{ teams: Team[] }>(`/api/basketball-leagues/${data.league.id}/teams`),
          basketballJson<{ players: Player[] }>(`/api/basketball-leagues/${data.league.id}/players`),
          basketballJson<{ games: Game[] }>(`/api/basketball-leagues/${data.league.id}/games`),
        ]);
        if (cancelled) return;
        setTeams(teamsRes.data?.teams ?? []);
        setPlayers(playersRes.data?.players ?? []);
        setGames(gamesRes.data?.games ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

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

  if (err || !league || !access) {
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

  if (!access.canView && access.visibility === "private") {
    return (
      <>
        <LightHeader activeHref="" />
        <PrivateLeagueWall leagueName={league.name} />
      </>
    );
  }

  if (!access.canView && access.visibility === "invite_only") {
    return (
      <>
        <LightHeader activeHref="" />
        <InviteOnlyLeagueWall
          leagueId={league.id}
          leagueName={league.name}
          initialStatus={access.memberStatus ?? null}
        />
      </>
    );
  }

  const teamName = (id: string | null) =>
    id ? teams.find((t) => t.id === id)?.name ?? "—" : "—";

  return (
    <>
      <LightHeader activeHref="" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div
          style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 10 }}
        >
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            {league.name}
          </h1>
          <LeagueVisibilityBadge visibility={league.visibility} />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
            {league.status}
          </span>
        </div>
        {league.description && (
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
            {league.description}
          </p>
        )}
        {access.memberStatus === "pending" && <PendingAccessNotice />}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
          {league.is_contest_enabled && (
            <Link
              href={`/contest/${league.slug}/build`}
              style={{
                display: "inline-block",
                padding: "8px 14px",
                background: "var(--gradient-gold, linear-gradient(135deg,#f59e0b,#d97706))",
                color: "#0a0e1a",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("进入每日竞赛 →", "Play daily contest →")}
            </Link>
          )}
          {access.canManageLeague && (
            <Link
              href={`/admin/basketball-leagues/${league.id}`}
              style={{
                display: "inline-block",
                padding: "8px 14px",
                background: "#1e3a8a",
                color: "#fff",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 800,
                textDecoration: "none",
              }}
            >
              {t("进入管理后台 →", "Manage league →")}
            </Link>
          )}
        </div>

        <Section title={t("球队", "Teams")} count={teams.length}>
          {teams.length === 0 ? (
            <Empty text={t("尚无球队", "No teams yet")} />
          ) : (
            <div className="bb-grid">
              {teams.map((tm) => (
                <Link
                  key={tm.id}
                  href={`/basketball-leagues/${slug}/teams/${tm.id}`}
                  style={cardLinkStyle()}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{tm.name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {[tm.city, tm.abbreviation].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("球员", "Players")} count={players.length}>
          {players.length === 0 ? (
            <Empty text={t("尚无球员", "No players yet")} />
          ) : (
            <div className="bb-grid">
              {players.map((p) => (
                <Link
                  key={p.id}
                  href={`/basketball-leagues/${slug}/players/${p.id}`}
                  style={cardLinkStyle()}
                >
                  <div style={{ fontWeight: 800, color: "#0f172a" }}>{p.display_name}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {[p.position, teamName(p.team_id)].filter(Boolean).join(" · ") || "—"}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <Section title={t("赛程", "Schedule")} count={games.length}>
          {games.length === 0 ? (
            <Empty text={t("尚无比赛", "No games yet")} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {games.map((g) => (
                <Link
                  key={g.id}
                  href={`/basketball-leagues/${slug}/games/${g.id}`}
                  style={cardLinkStyle({
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  })}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: "#0f172a" }}>
                      {teamName(g.away_team_id)} @ {teamName(g.home_team_id)}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {g.scheduled_at
                        ? new Date(g.scheduled_at).toLocaleString()
                        : t("时间待定", "TBD")}{" "}
                      · {g.status}
                    </div>
                  </div>
                  {g.status === "final" && (
                    <div style={{ fontWeight: 900, color: "#1e3a8a", fontSize: 18 }}>
                      {g.away_score} – {g.home_score}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Section>
      </main>
      <style>{`
        .bb-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 10px;
        }
      `}</style>
    </>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.01em",
          margin: "0 0 12px",
        }}
      >
        {title}{" "}
        <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>· {count}</span>
      </h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
      }}
    >
      {children}
    </div>
  );
}

function cardLinkStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    textDecoration: "none",
    color: "inherit",
    display: "block",
    transition: "border-color 0.15s",
    ...extra,
  };
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0" }}>{text}</div>;
}
