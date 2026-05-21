"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import LeagueLogo from "@/components/basketball/LeagueLogo";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import PendingAccessNotice from "@/components/basketball/PendingAccessNotice";
import PlayerClaimModal from "@/components/basketball/PlayerClaimModal";
import TeamBindModal from "@/components/basketball/TeamBindModal";
import ShareButton from "@/components/basketball/ShareButton";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { memberRoleLabel } from "@/lib/basketball/role-labels";
import type { MemberRole } from "@/lib/basketball/access";
import { useLang } from "@/lib/lang";
import { leagueStatusLabel, gameStatusLabel } from "@/lib/basketball/status-labels";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  visibility: "public" | "invite_only" | "private";
  is_contest_enabled: boolean;
  logo_url: string | null;
};

type Access = {
  canView: boolean;
  canManageLeague: boolean;
  canManageOwnTeam: boolean;
  canInputStats: boolean;
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

type MemberTeam = {
  id: string;
  name: string;
  logo_url: string | null;
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
  const [memberTeam, setMemberTeam] = useState<MemberTeam>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [claimModalOpen, setClaimModalOpen] = useState(false);
  const [teamBindModalOpen, setTeamBindModalOpen] = useState(false);
  const [unbindingTeam, setUnbindingTeam] = useState(false);

  const reload = async () => {
    const { data, error } = await basketballJson<{
      league: League;
      access: Access;
      member_player: MemberPlayer;
      member_team: MemberTeam;
    }>(`/api/basketball-leagues/by-slug/${slug}`);
    if (error || !data) {
      setErr(error ?? "not_found");
      return;
    }
    setLeague(data.league);
    setAccess(data.access);
    setMemberPlayer(data.member_player ?? null);
    setMemberTeam(data.member_team ?? null);
  };

  const unbindTeam = async () => {
    if (!league) return;
    if (
      !window.confirm(
        t(
          "解绑后你将不再是该球队的经理。继续？",
          "After unbinding, you will no longer be the team's manager. Continue?",
        ),
      )
    )
      return;
    setUnbindingTeam(true);
    const res = await basketballFetch(
      `/api/basketball-leagues/${league.id}/team-bind`,
      { method: "DELETE" },
    );
    setUnbindingTeam(false);
    if (!res.ok) {
      alert(t("解绑失败，请重试。", "Unbind failed."));
      return;
    }
    await reload();
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await basketballJson<{
        league: League;
        access: Access;
        member_player: MemberPlayer;
        member_team: MemberTeam;
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
      setMemberTeam(data.member_team ?? null);
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
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 20px 96px" }}>
        <section
          aria-label="League hero"
          style={{
            position: "relative",
            background:
              "linear-gradient(135deg, #ffffff 0%, #f8fafc 60%, #eef2f9 100%)",
            border: "1px solid #eef2f7",
            borderRadius: 24,
            padding: "32px 28px",
            marginBottom: 24,
            overflow: "hidden",
          }}
        >
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -120,
              right: -120,
              width: 360,
              height: 360,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(30, 58, 138, 0.10), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: -160,
              left: -80,
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(closest-side, rgba(245, 158, 11, 0.12), transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 24,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <LeagueLogo
              name={league.name}
              logoUrl={league.logo_url}
              size={104}
              emphasis="ring"
            />
            <div style={{ flex: 1, minWidth: 260 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.22em",
                  textTransform: "uppercase",
                  color: "#94a3b8",
                  marginBottom: 8,
                }}
              >
                {t("社区联赛", "Community League")}
              </div>
              <h1
                style={{
                  fontSize: 40,
                  fontWeight: 900,
                  color: "#0f172a",
                  letterSpacing: "-0.03em",
                  margin: 0,
                  lineHeight: 1.05,
                }}
              >
                {league.name}
              </h1>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  flexWrap: "wrap",
                  marginTop: 12,
                }}
              >
                <LeagueVisibilityBadge visibility={league.visibility} />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: "0.06em",
                    color: "#475569",
                    padding: "4px 10px",
                    borderRadius: 999,
                    background: "rgba(15, 23, 42, 0.04)",
                  }}
                >
                  {leagueStatusLabel(league.status, lang)}
                </span>
                {league.is_contest_enabled && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "#92400e",
                      padding: "4px 10px",
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                    }}
                  >
                    {t("每日竞赛", "Daily Contest")}
                  </span>
                )}
              </div>
              {league.description && (
                <p
                  style={{
                    color: "#475569",
                    fontSize: 15,
                    lineHeight: 1.65,
                    margin: "16px 0 0",
                    maxWidth: 640,
                  }}
                >
                  {league.description}
                </p>
              )}
            </div>
          </div>
        </section>
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
              {access.memberRole === "team_manager" && memberTeam && (
                <span>· {memberTeam.name}</span>
              )}
              {access.memberRole === "team_manager" && !memberTeam && (
                <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                  · {t("球队待绑定", "team pending bind")}
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
                  {t("查看 / 编辑我的档案 →", "View / Edit my profile →")}
                </Link>
              )}
            {access.memberRole === "player" &&
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
            {access.memberRole === "team_manager" && !memberTeam && (
              <button
                onClick={() => setTeamBindModalOpen(true)}
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
                {t("绑定或创建球队", "Bind or create team")}
              </button>
            )}
            {access.memberRole === "team_manager" && memberTeam && (
              <>
                <Link
                  href={`/basketball-leagues/${slug}/teams/${memberTeam.id}`}
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#1e3a8a",
                    textDecoration: "none",
                  }}
                >
                  {t("查看我的球队 →", "View my team →")}
                </Link>
                <button
                  onClick={unbindTeam}
                  disabled={unbindingTeam}
                  style={{
                    padding: "4px 10px",
                    background: "transparent",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: unbindingTeam ? "default" : "pointer",
                  }}
                >
                  {t("解绑", "Unbind")}
                </button>
              </>
            )}
          </div>
        )}
        {access.memberStatus === "pending" && <PendingAccessNotice />}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: 28,
          }}
        >
          {league.is_contest_enabled && (
            <Link
              href={`/contest/${league.slug}/build`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 20px",
                background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
                color: "#0a0e1a",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                textDecoration: "none",
                boxShadow:
                  "0 8px 24px -8px rgba(245, 158, 11, 0.45), 0 0 0 1px rgba(245, 158, 11, 0.2)",
                letterSpacing: "-0.01em",
              }}
            >
              {t("进入每日竞赛", "Play Daily Contest")} <span aria-hidden>→</span>
            </Link>
          )}
          {(access.canManageLeague || access.canManageOwnTeam || access.canInputStats) && (
            <Link
              href={`/league-admin/${league.id}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "11px 20px",
                background: "linear-gradient(135deg, #1e3a8a, #1e40af)",
                color: "#fff",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 900,
                textDecoration: "none",
                boxShadow:
                  "0 8px 24px -8px rgba(30, 58, 138, 0.5), 0 0 0 1px rgba(30, 58, 138, 0.2)",
                letterSpacing: "-0.01em",
              }}
            >
              {t("进入管理后台", "Manage League")} <span aria-hidden>→</span>
            </Link>
          )}
          <ShareButton
            label={t("分享联赛", "Share League")}
            shareTitle={league.name}
          />
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
                      · {gameStatusLabel(g.status, lang)}
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
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 12px;
        }
        .bb-grid > a:hover,
        a[data-bb-card]:hover {
          transform: translateY(-1px);
          border-color: #cbd5e1;
          box-shadow: 0 14px 30px -20px rgba(15, 23, 42, 0.18);
        }
      `}</style>
      {claimModalOpen && (
        <PlayerClaimModal
          leagueId={league.id}
          onClose={() => setClaimModalOpen(false)}
          onSubmitted={async () => {
            setClaimModalOpen(false);
            await reload();
          }}
        />
      )}
      {teamBindModalOpen && (
        <TeamBindModal
          leagueId={league.id}
          onClose={() => setTeamBindModalOpen(false)}
          onSubmitted={async () => {
            setTeamBindModalOpen(false);
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
    <section style={{ marginTop: 36 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: "1px solid #eef2f7",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {title}
        </h2>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: "#94a3b8",
            padding: "2px 8px",
            borderRadius: 999,
            background: "#f1f5f9",
          }}
        >
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

function cardLinkStyle(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #eef2f7",
    borderRadius: 14,
    padding: 14,
    textDecoration: "none",
    color: "inherit",
    display: "block",
    transition: "transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease",
    ...extra,
  };
}

function Empty({ text }: { text: string }) {
  return (
    <div
      style={{
        color: "#94a3b8",
        fontSize: 13,
        padding: "16px 0",
        fontStyle: "italic",
      }}
    >
      {text}
    </div>
  );
}

function ComingSoonCard({ title, body }: { title: string; body: string }) {
  const { t } = useLang();
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
        border: "1px solid #eef2f7",
        borderRadius: 14,
        padding: 18,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "#94a3b8",
          marginBottom: 8,
        }}
      >
        {t("即将上线", "Coming Soon")}
      </div>
      <div
        style={{
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 6,
          fontSize: 15,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
