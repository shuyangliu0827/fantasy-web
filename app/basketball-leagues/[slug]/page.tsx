"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import PendingAccessNotice from "@/components/basketball/PendingAccessNotice";
import PlayerClaimModal from "@/components/basketball/PlayerClaimModal";
import { basketballJson } from "@/lib/basketball/client";
import { memberRoleLabel } from "@/lib/basketball/role-labels";
import type { MemberRole } from "@/lib/basketball/access";
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
  canEditOwnPlayerProfile: boolean;
  memberStatus: "pending" | "approved" | "rejected" | "removed" | null;
  memberRole: MemberRole | null;
  memberTeamId: string | null;
  visibility: "public" | "invite_only" | "private";
};

type Team = {
  id: string;
  name: string;
  abbreviation: string | null;
  city: string | null;
  logo_url: string | null;
};
type Player = {
  id: string;
  display_name: string;
  position: string | null;
  team_id: string | null;
  jersey_number: string | null;
  avatar_url: string | null;
};
type Game = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
};

type MemberPlayer = {
  id: string;
  display_name: string;
  jersey_number: string | null;
  team_id: string | null;
  claim_status: string;
} | null;

export default function BasketballLeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { t, lang } = useLang();
  const [league, setLeague] = useState<League | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [memberPlayer, setMemberPlayer] = useState<MemberPlayer>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);

  const reload = async () => {
    const { data, error } = await basketballJson<{
      league: League;
      access: Access;
      member_player: MemberPlayer;
    }>(`/api/basketball-leagues/by-slug/${slug}`);
    if (error || !data) {
      setErr(error ?? "not_found");
      return;
    }
    setLeague(data.league);
    setAccess(data.access);
    setMemberPlayer(data.member_player ?? null);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await basketballJson<{
        league: League;
        access: Access;
        member_player: MemberPlayer;
      }>(`/api/basketball-leagues/by-slug/${slug}`);
      if (cancelled) return;
      if (error || !data) {
        setErr(error ?? "not_found");
        setLoading(false);
        return;
      }
      setLeague(data.league);
      setAccess(data.access);
      setMemberPlayer(data.member_player ?? null);
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
          <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, marginBottom: 14 }}>
            {league.description}
          </p>
        )}
        {access.memberStatus === "approved" && access.memberRole && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: 999,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 700,
                color: "#1e3a8a",
              }}
            >
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                {t("你在本联赛中的身份", "Your role in this league")}
              </span>
              <span>· {memberRoleLabel(access.memberRole, lang)}</span>
              {access.memberRole === "player" &&
                access.canEditOwnPlayerProfile &&
                memberPlayer && (
                  <span>
                    · {t("已绑定球员档案", "Linked")} · {memberPlayer.display_name}
                    {memberPlayer.jersey_number ? ` #${memberPlayer.jersey_number}` : ""}
                  </span>
                )}
              {access.memberRole === "player" &&
                !access.canEditOwnPlayerProfile &&
                memberPlayer?.claim_status === "pending" && (
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                    · {t("申请已提交，等待审核", "Claim submitted — pending review")}
                  </span>
                )}
              {access.memberRole === "player" &&
                !access.canEditOwnPlayerProfile &&
                !memberPlayer && (
                  <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                    · {t("球员档案待绑定", "player profile pending link")}
                  </span>
                )}
            </div>
            {access.memberRole === "player" &&
              access.canEditOwnPlayerProfile &&
              memberPlayer && (
                <Link
                  href={`/basketball-leagues/${slug}/players/${memberPlayer.id}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e3a8a",
                    textDecoration: "none",
                  }}
                >
                  {t("查看我的球员档案 →", "View my player profile →")}
                </Link>
              )}
            {(access.memberRole === "player" || access.memberRole === "team_manager") &&
              !access.canEditOwnPlayerProfile &&
              !memberPlayer && (
                <button
                  onClick={() => setClaimModalOpen(true)}
                  style={{
                    padding: "6px 14px",
                    background: "#1e3a8a",
                    color: "#fff",
                    border: "none",
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  {t("绑定球员档案", "Bind Player Profile")}
                </button>
              )}
          </div>
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
                  style={cardLinkStyle({ display: "flex", alignItems: "center", gap: 12 })}
                >
                  {tm.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={tm.logo_url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", background: "#f1f5f9", flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 36, height: 36, borderRadius: 8, background: "#f1f5f9", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tm.name}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {[tm.city, tm.abbreviation].filter(Boolean).join(" · ") || "—"}
                    </div>
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
                  style={cardLinkStyle({ display: "flex", alignItems: "center", gap: 12 })}
                >
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt=""
                      style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#f1f5f9", flexShrink: 0 }}
                    />
                  ) : (
                    <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9", flexShrink: 0 }} />
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, color: "#0f172a", display: "flex", alignItems: "center", gap: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.display_name}
                      {p.jersey_number && (
                        <span style={{ color: "#1e3a8a", fontSize: 12, fontWeight: 700 }}>#{p.jersey_number}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      {[p.position, teamName(p.team_id)].filter(Boolean).join(" · ") || "—"}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 12,
            marginTop: 28,
          }}
        >
          <ComingSoonCard
            title={t("联赛新闻", "League News")}
            body={t("联赛官方动态即将上线。", "League announcements coming soon.")}
          />
          <ComingSoonCard
            title={t("比赛集锦", "Highlights")}
            body={t("精彩比赛集锦即将上线。", "Game highlights coming soon.")}
          />
        </div>

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
      {claimModalOpen && (
        <PlayerClaimModal
          leagueId={league.id}
          fixedTeamId={
            access.memberRole === "team_manager" ? access.memberTeamId ?? null : null
          }
          onClose={() => setClaimModalOpen(false)}
          onSubmitted={async () => {
            setClaimModalOpen(false);
            await reload();
          }}
        />
      )}
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

function ComingSoonCard({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px dashed #cbd5e1",
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6, fontSize: 14 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>{body}</div>
      <div style={{ marginTop: 8, fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>
        COMING SOON
      </div>
    </div>
  );
}
