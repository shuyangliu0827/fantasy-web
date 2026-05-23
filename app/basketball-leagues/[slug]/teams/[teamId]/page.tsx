"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import ShareButton from "@/components/basketball/ShareButton";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { uploadBasketballTeamLogo } from "@/lib/basketball/uploads";
import { useLang } from "@/lib/lang";
import { gameStatusLabel } from "@/lib/basketball/status-labels";
import { positionLabel } from "@/lib/i18n/labels";

type LeagueLite = {
  id: string;
  slug: string;
  name: string;
  visibility: "public" | "invite_only" | "private";
};

type Access = {
  canView: boolean;
  visibility: "public" | "invite_only" | "private";
  memberStatus: "pending" | "approved" | "rejected" | "removed" | null;
  isPlatformAdmin?: boolean;
  leagueAdminRole?: "league_owner" | "league_admin" | null;
  memberRole?:
    | "league_admin"
    | "team_manager"
    | "player"
    | "referee"
    | "scorekeeper"
    | "viewer"
    | null;
  memberTeamId?: string | null;
};

type Team = {
  id: string;
  name: string;
  abbreviation: string | null;
  city: string | null;
  logo_url: string | null;
  bio: string | null;
};

type RosterPlayer = {
  id: string;
  display_name: string;
  position: string | null;
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

type TeamRef = { id: string; name: string; abbreviation: string | null; logo_url: string | null };
type TeamMap = Record<string, TeamRef>;

type Leader = {
  player_id: string;
  display_name: string;
  avg: number;
  games_played: number;
} | null;

type SeasonSummary = {
  record: { w: number; l: number; t: number; games_played: number };
  points_for_avg: number | null;
  points_against_avg: number | null;
  leaders: { pts: Leader; reb: Leader; ast: Leader };
};

export default function TeamDetailPage({
  params,
}: {
  params: Promise<{ slug: string; teamId: string }>;
}) {
  const { slug, teamId } = use(params);
  const { t, lang } = useLang();
  const [league, setLeague] = useState<LeagueLite | null>(null);
  const [leagueAccess, setLeagueAccess] = useState<Access | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [roster, setRoster] = useState<RosterPlayer[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [teamMap, setTeamMap] = useState<TeamMap>({});
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
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

    const [teamRes, summaryRes] = await Promise.all([
      basketballJson<{
        team: Team;
        roster: RosterPlayer[];
        games: Game[];
        team_map: TeamMap;
      }>(`/api/basketball-teams/${teamId}`),
      basketballJson<SeasonSummary>(`/api/basketball-teams/${teamId}/season-summary`),
    ]);
    if (teamRes.error || !teamRes.data) {
      setErr(teamRes.error ?? "team_load_failed");
      setLoading(false);
      return;
    }
    setTeam(teamRes.data.team);
    setRoster(teamRes.data.roster);
    setGames(teamRes.data.games);
    setTeamMap(teamRes.data.team_map ?? {});
    if (summaryRes.data) setSummary(summaryRes.data);
    setLoading(false);
  }, [slug, teamId]);

  useEffect(() => {
    load();
  }, [load]);

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
  if (!team) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该球队。", "Team not found.")}
        </main>
      </>
    );
  }

  const isAdminLike =
    leagueAccess.isPlatformAdmin ||
    leagueAccess.leagueAdminRole != null ||
    (leagueAccess.memberRole === "league_admin" && leagueAccess.memberStatus === "approved");
  const isManagerOfThisTeam =
    leagueAccess.memberRole === "team_manager" &&
    leagueAccess.memberStatus === "approved" &&
    leagueAccess.memberTeamId === team.id;
  const canEditTeam = isAdminLike || isManagerOfThisTeam;

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
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          {team.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={team.logo_url} alt="" style={{ width: 72, height: 72, borderRadius: 12, objectFit: "cover" }} />
          ) : (
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 12,
                background: "linear-gradient(135deg, #1e3a8a, #475569)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 900,
              }}
            >
              {(team.abbreviation || team.name.slice(0, 3)).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              {team.name}
            </h1>
            <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
              {[team.city, team.abbreviation].filter(Boolean).join(" · ") || "—"}
            </div>
            {team.bio && (
              <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "10px 0 0" }}>
                {team.bio}
              </p>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignSelf: "flex-start",
            }}
          >
            <ShareButton
              label={t("分享球队", "Share Team")}
              shareTitle={team.name}
            />
            {canEditTeam && (
              <TeamEditButton
                team={team}
                onSaved={(updated) => setTeam(updated)}
              />
            )}
          </div>
        </div>

        <SeasonSnapshot summary={summary} />
        <Leaders summary={summary} slug={slug} />

        <h2 style={sectionTitle()}>
          {t("阵容", "Roster")}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            · {roster.length}
          </span>
        </h2>
        {roster.length === 0 ? (
          <Empty text={t("尚无球员", "No players yet")} />
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: 10,
              marginBottom: 24,
            }}
          >
            {roster.map((p) => (
              <Link
                key={p.id}
                href={`/basketball-leagues/${slug}/players/${p.id}`}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 12,
                  padding: 14,
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
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
                  <div style={{ fontWeight: 800, color: "#0f172a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.display_name}
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                    {[p.position ? positionLabel(p.position, lang) : null, p.jersey_number ? `#${p.jersey_number}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <h2 style={sectionTitle()}>
          {t("赛程", "Games")}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            · {games.length}
          </span>
        </h2>
        {games.length === 0 ? (
          <Empty text={t("尚无比赛", "No games yet")} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {games.map((g) => {
              const isAway = g.away_team_id === team.id;
              const oppId = isAway ? g.home_team_id : g.away_team_id;
              const opp = oppId ? teamMap[oppId] : null;
              const oppName = opp?.name ?? t("待定", "TBD");
              return (
                <Link
                  key={g.id}
                  href={`/basketball-leagues/${slug}/games/${g.id}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #e2e8f0",
                    borderRadius: 12,
                    padding: 14,
                    textDecoration: "none",
                    color: "inherit",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {opp?.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={opp.logo_url}
                        alt=""
                        style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", background: "#f1f5f9" }}
                      />
                    ) : (
                      <span style={{ width: 28, height: 28, borderRadius: 6, background: "#f1f5f9", display: "inline-block" }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 800, color: "#0f172a" }}>
                        {isAway ? t("客 ", "@ ") : t("主 ", "vs ")}
                        {oppName}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        {g.scheduled_at
                          ? new Date(g.scheduled_at).toLocaleString()
                          : t("时间待定", "TBD")}{" "}
                        · {gameStatusLabel(g.status, lang)}
                      </div>
                    </div>
                  </div>
                  {g.status === "final" && (
                    <div style={{ fontWeight: 900, color: "#1e3a8a", fontSize: 16 }}>
                      {g.away_score} – {g.home_score}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}

function sectionTitle(): React.CSSProperties {
  return {
    fontSize: 16,
    fontWeight: 900,
    color: "#0f172a",
    letterSpacing: "-0.01em",
    margin: "0 0 12px",
  };
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0 24px" }}>{text}</div>
  );
}

function SeasonSnapshot({ summary }: { summary: SeasonSummary | null }) {
  const { t } = useLang();
  const hasGames = !!summary && summary.record.games_played > 0;
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={sectionTitle()}>{t("赛季概览", "Season Snapshot")}</h2>
      {!hasGames ? (
        <div
          style={{
            background: "#fff",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            padding: 16,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {t("暂无已完赛比赛数据。", "No completed games yet.")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
            gap: 10,
          }}
        >
          <Stat
            label={t("战绩 (W-L)", "Record (W-L)")}
            value={`${summary!.record.w}-${summary!.record.l}${summary!.record.t ? `-${summary!.record.t}` : ""}`}
            sub={t(`${summary!.record.games_played} 场`, `${summary!.record.games_played} games`)}
          />
          <Stat
            label={t("场均得分", "PPG")}
            value={summary!.points_for_avg != null ? summary!.points_for_avg.toFixed(1) : "—"}
          />
          <Stat
            label={t("场均失分", "PA")}
            value={summary!.points_against_avg != null ? summary!.points_against_avg.toFixed(1) : "—"}
          />
        </div>
      )}
    </section>
  );
}

function Leaders({ summary, slug }: { summary: SeasonSummary | null; slug: string }) {
  const { t } = useLang();
  const hasLeaders =
    !!summary && (summary.leaders.pts || summary.leaders.reb || summary.leaders.ast);
  return (
    <section style={{ marginBottom: 18 }}>
      <h2 style={sectionTitle()}>{t("球队数据领袖", "Team Leaders")}</h2>
      {!hasLeaders ? (
        <div
          style={{
            background: "#fff",
            border: "1px dashed #cbd5e1",
            borderRadius: 12,
            padding: 16,
            color: "#64748b",
            fontSize: 14,
          }}
        >
          {t("球队数据领袖即将上线。", "Team leaders coming soon.")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 10,
          }}
        >
          <LeaderCard slug={slug} category={t("得分王", "Scoring leader")} unit="PPG" leader={summary!.leaders.pts} />
          <LeaderCard slug={slug} category={t("篮板王", "Rebounding leader")} unit="RPG" leader={summary!.leaders.reb} />
          <LeaderCard slug={slug} category={t("助攻王", "Assists leader")} unit="APG" leader={summary!.leaders.ast} />
        </div>
      )}
    </section>
  );
}

function LeaderCard({
  slug,
  category,
  unit,
  leader,
}: {
  slug: string;
  category: string;
  unit: string;
  leader: Leader;
}) {
  if (!leader) {
    return (
      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{category}</div>
        <div style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>—</div>
      </div>
    );
  }
  return (
    <Link
      href={`/basketball-leagues/${slug}/players/${leader.player_id}`}
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{category}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginTop: 6 }}>
        {leader.display_name}
      </div>
      <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700, marginTop: 4 }}>
        {leader.avg.toFixed(1)} {unit}
      </div>
    </Link>
  );
}

function TeamEditButton({
  team,
  onSaved,
}: {
  team: Team;
  onSaved: (team: Team) => void;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          alignSelf: "flex-start",
          padding: "8px 14px",
          background: "#fff",
          border: "1px solid #cbd5e1",
          color: "#1e3a8a",
          borderRadius: 10,
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        {t("编辑球队", "Edit team")}
      </button>
      {open && (
        <TeamEditModal
          team={team}
          onClose={() => setOpen(false)}
          onSaved={(updated) => {
            onSaved(updated);
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function TeamEditModal({
  team,
  onClose,
  onSaved,
}: {
  team: Team;
  onClose: () => void;
  onSaved: (team: Team) => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(team.name);
  const [abbreviation, setAbbreviation] = useState(team.abbreviation ?? "");
  const [city, setCity] = useState(team.city ?? "");
  const [bio, setBio] = useState(team.bio ?? "");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDetails, setErrDetails] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setErr(t("队名不能为空。", "Team name is required."));
      return;
    }
    setBusy(true);
    setErr(null);
    setErrDetails(null);
    try {
      let logoUrl: string | undefined;
      if (logoFile) {
        try {
          logoUrl = await uploadBasketballTeamLogo("", team.id, logoFile);
        } catch (e) {
          const raw = e instanceof Error ? e.message : String(e);
          const status =
            e instanceof Error
              ? (e as Error & { status?: number }).status ?? null
              : null;
          setErr(
            status === 403
              ? t(
                  "你没有权限上传该球队的队徽。",
                  "You do not have permission to upload this team's logo.",
                )
              : t("队徽上传失败，请重试。", "Logo upload failed."),
          );
          setErrDetails(raw);
          setBusy(false);
          return;
        }
      }

      const patch: Record<string, unknown> = {
        name: name.trim(),
        abbreviation: abbreviation.trim() || null,
        city: city.trim() || null,
        bio: bio.trim() || null,
      };
      if (logoUrl) patch.logo_url = logoUrl;

      const res = await basketballFetch(`/api/basketball-teams/${team.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      const body = (await res.json().catch(() => ({}))) as {
        team?: Team;
        error?: string;
      };
      if (!res.ok) {
        setErr(t("保存失败，请重试。", "Save failed."));
        setErrDetails(String(body.error ?? res.status));
        return;
      }
      if (body.team) onSaved(body.team);
      else onSaved({ ...team, ...patch, logo_url: logoUrl ?? team.logo_url });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 16,
          padding: 24,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h2 style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", margin: 0 }}>
            {t("编辑球队信息", "Edit team info")}
          </h2>
          <button
            onClick={onClose}
            aria-label="close"
            style={{
              background: "transparent",
              border: "none",
              fontSize: 18,
              color: "#64748b",
              cursor: "pointer",
              padding: 4,
            }}
          >
            ×
          </button>
        </div>

        <ModalField label={t("队名", "Name")}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={modalInput()}
          />
        </ModalField>
        <ModalField label={t("缩写", "Abbreviation")}>
          <input
            value={abbreviation}
            onChange={(e) => setAbbreviation(e.target.value)}
            style={modalInput()}
          />
        </ModalField>
        <ModalField label={t("城市", "City")}>
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            style={modalInput()}
          />
        </ModalField>
        <ModalField label={t("简介", "Bio")}>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            style={{ ...modalInput(), minHeight: 80, resize: "vertical", fontFamily: "inherit" }}
          />
        </ModalField>
        <ModalField label={t("队徽", "Logo")}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            {team.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logo_url}
                alt=""
                style={{ width: 40, height: 40, borderRadius: 8, objectFit: "cover", background: "#f1f5f9" }}
              />
            ) : (
              <span style={{ width: 40, height: 40, borderRadius: 8, background: "#f1f5f9", display: "inline-block" }} />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 12 }}
            />
            {logoFile && (
              <span style={{ color: "#475569", fontSize: 12 }}>{logoFile.name}</span>
            )}
          </div>
        </ModalField>

        {err && (
          <div style={{ marginTop: 6, marginBottom: 6 }}>
            <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
            {errDetails && (
              <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{errDetails}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "10px 16px",
              background: "transparent",
              border: "1px solid #cbd5e1",
              color: "#475569",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={save}
            disabled={busy}
            style={{
              padding: "10px 16px",
              background: busy ? "#94a3b8" : "#1e3a8a",
              border: "none",
              color: "#fff",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 800,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {busy ? t("保存中…", "Saving…") : t("保存", "Save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function modalInput(): React.CSSProperties {
  return {
    width: "100%",
    padding: "10px 12px",
    background: "#fff",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    color: "#0f172a",
    outline: "none",
  };
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a", marginTop: 4 }}>{value}</div>
      {sub && (
        <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
