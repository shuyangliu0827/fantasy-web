"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PrivateLeagueWall from "@/components/basketball/PrivateLeagueWall";
import InviteOnlyLeagueWall from "@/components/basketball/InviteOnlyLeagueWall";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { uploadBasketballPlayerAvatar } from "@/lib/basketball/uploads";
import { useLang } from "@/lib/lang";

type LeagueLite = {
  id: string;
  slug: string;
  name: string;
  visibility: "public" | "invite_only" | "private";
};

type LeagueAccess = {
  canView: boolean;
  visibility: "public" | "invite_only" | "private";
  memberStatus: "pending" | "approved" | "rejected" | "removed" | null;
  canEditOwnPlayerProfile: boolean;
};

type Player = {
  id: string;
  display_name: string;
  position: string | null;
  jersey_number: string | null;
  height: string | null;
  weight: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birth_year: number | null;
  bio: string | null;
  avatar_url: string | null;
  team_id: string | null;
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
  claimed_by_user_id: string | null;
};

type TeamRef = { id: string; name: string; abbreviation: string | null };

type ClaimedUser = {
  user_id: string;
  username: string;
  name: string | null;
  avatar_url: string | null;
} | null;

type GameLogRow = {
  game_id: string;
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
};

type Season = {
  games_played: number;
  totals: Record<string, number>;
  averages: Record<string, number>;
};

const AVG_KEYS = [
  ["pts", "PTS"],
  ["reb", "REB"],
  ["ast", "AST"],
  ["stl", "STL"],
  ["blk", "BLK"],
  ["tov", "TOV"],
  ["fantasy_points", "FPTS"],
] as const;

export default function PlayerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; playerId: string }>;
}) {
  const { slug, playerId } = use(params);
  const { t } = useLang();
  const [league, setLeague] = useState<LeagueLite | null>(null);
  const [leagueAccess, setLeagueAccess] = useState<LeagueAccess | null>(null);
  const [player, setPlayer] = useState<Player | null>(null);
  const [team, setTeam] = useState<TeamRef | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [gameLog, setGameLog] = useState<GameLogRow[]>([]);
  const [claimedUser, setClaimedUser] = useState<ClaimedUser>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const leagueRes = await basketballJson<{ league: LeagueLite; access: LeagueAccess }>(
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

    const playerRes = await basketballJson<{
      player: Player;
      team: TeamRef | null;
      season: Season;
      game_log: GameLogRow[];
      claimed_user: ClaimedUser;
    }>(`/api/basketball-players/${playerId}`);
    if (playerRes.error || !playerRes.data) {
      setErr(playerRes.error ?? "player_load_failed");
      setLoading(false);
      return;
    }
    setPlayer(playerRes.data.player);
    setTeam(playerRes.data.team);
    setSeason(playerRes.data.season);
    setGameLog(playerRes.data.game_log);
    setClaimedUser(playerRes.data.claimed_user ?? null);
    setLoading(false);
  }, [slug, playerId]);

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
  if (!player || !season) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该球员。", "Player not found.")}
        </main>
      </>
    );
  }

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
          {player.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatar_url}
              alt=""
              style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 88,
                height: 88,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #f59e0b, #d97706)",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 28,
                fontWeight: 900,
              }}
            >
              {player.display_name[0]?.toUpperCase()}
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
              {player.display_name}
            </h1>
            <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
              {[
                player.position,
                player.jersey_number ? `#${player.jersey_number}` : null,
                team ? (
                  <Link
                    key="team"
                    href={`/basketball-leagues/${slug}/teams/${team.id}`}
                    style={{ color: "#1e3a8a", fontWeight: 700, textDecoration: "none" }}
                  >
                    {team.name}
                  </Link>
                ) : null,
                player.height_cm != null
                  ? `${player.height_cm} cm`
                  : player.height,
                player.weight_kg != null
                  ? `${player.weight_kg} kg`
                  : player.weight,
                player.birth_year != null
                  ? t(
                      `${new Date().getFullYear() - player.birth_year} 岁`,
                      `Age ${new Date().getFullYear() - player.birth_year}`,
                    )
                  : null,
              ]
                .filter(Boolean)
                .map((v, i, arr) => (
                  <span key={i}>
                    {v}
                    {i < arr.length - 1 ? " · " : ""}
                  </span>
                ))}
            </div>
            <PlatformLink claimedUser={claimedUser} claimStatus={player.claim_status} />
            {player.bio && (
              <p style={{ marginTop: 12, color: "#475569", fontSize: 14, lineHeight: 1.5 }}>
                {player.bio}
              </p>
            )}
            {leagueAccess.canEditOwnPlayerProfile && !editing && (
              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setEditing(true)}
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
                  {t("编辑资料", "Edit Profile")}
                </button>
                <UnbindButton
                  playerId={player.id}
                  onUnbound={() => {
                    setEditing(false);
                    load();
                  }}
                />
              </div>
            )}
          </div>
        </div>
        {editing && leagueAccess.canEditOwnPlayerProfile && (
          <SelfEditProfileForm
            player={player}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              load();
            }}
          />
        )}

        <h2 style={sectionTitle()}>
          {t("赛季均值", "Season averages")}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            · {season.games_played} {t("场", "GP")}
          </span>
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {AVG_KEYS.map(([key, label]) => (
            <div
              key={key}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {label}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 22,
                  fontWeight: 900,
                  color: label === "FPTS" ? "#1e3a8a" : "#0f172a",
                }}
              >
                {(season.averages[key] ?? 0).toFixed(1)}
              </div>
            </div>
          ))}
        </div>

        <h2 style={sectionTitle()}>
          {t("比赛记录", "Game log")}{" "}
          <span style={{ color: "#94a3b8", fontWeight: 700, fontSize: 13 }}>
            · {gameLog.length}
          </span>
        </h2>
        {gameLog.length === 0 ? (
          <Empty text={t("尚无比赛记录", "No games recorded yet")} />
        ) : (
          <div
            style={{
              overflowX: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              background: "#fff",
            }}
          >
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 720 }}
            >
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={th()}>{t("比赛", "Game")}</th>
                  <th style={{ ...th(), textAlign: "center" }}>PTS</th>
                  <th style={{ ...th(), textAlign: "center" }}>REB</th>
                  <th style={{ ...th(), textAlign: "center" }}>AST</th>
                  <th style={{ ...th(), textAlign: "center" }}>STL</th>
                  <th style={{ ...th(), textAlign: "center" }}>BLK</th>
                  <th style={{ ...th(), textAlign: "center" }}>FG</th>
                  <th style={{ ...th(), textAlign: "center" }}>3P</th>
                  <th style={{ ...th(), textAlign: "center" }}>FT</th>
                  <th style={{ ...th(), textAlign: "center", color: "#1e3a8a" }}>FPTS</th>
                </tr>
              </thead>
              <tbody>
                {gameLog.map((g) => (
                  <tr key={g.game_id} style={{ borderTop: "1px solid #f1f5f9" }}>
                    <td style={td()}>
                      <Link
                        href={`/basketball-leagues/${slug}/games/${g.game_id}`}
                        style={{ color: "#1e3a8a", fontWeight: 700, textDecoration: "none" }}
                      >
                        {t("查看", "View")} →
                      </Link>
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>{g.pts}</td>
                    <td style={{ ...td(), textAlign: "center" }}>{g.reb}</td>
                    <td style={{ ...td(), textAlign: "center" }}>{g.ast}</td>
                    <td style={{ ...td(), textAlign: "center" }}>{g.stl}</td>
                    <td style={{ ...td(), textAlign: "center" }}>{g.blk}</td>
                    <td style={{ ...td(), textAlign: "center" }}>
                      {g.fgm}/{g.fga}
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>
                      {g.fg3m}/{g.fg3a}
                    </td>
                    <td style={{ ...td(), textAlign: "center" }}>
                      {g.ftm}/{g.fta}
                    </td>
                    <td
                      style={{
                        ...td(),
                        textAlign: "center",
                        fontWeight: 900,
                        color: "#1e3a8a",
                      }}
                    >
                      {g.fantasy_points != null ? Number(g.fantasy_points).toFixed(1) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <section style={{ marginTop: 24 }}>
          <h2 style={sectionTitle()}>{t("AI 技术画像", "AI Scouting Snapshot")}</h2>
          <div
            style={{
              background: "#fff",
              border: "1px dashed #cbd5e1",
              borderRadius: 12,
              padding: 18,
              color: "#64748b",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            {t(
              "基于比赛数据的球员技术分析即将上线。",
              "Data-driven player scouting coming soon.",
            )}
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.05em" }}>
              COMING SOON
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function PlatformLink({
  claimedUser,
  claimStatus,
}: {
  claimedUser: ClaimedUser;
  claimStatus: Player["claim_status"];
}) {
  const { t } = useLang();
  if (claimedUser && claimStatus === "approved") {
    return (
      <div style={{ marginTop: 10 }}>
        <Link
          href={`/u/${claimedUser.username}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 700,
            color: "#1e3a8a",
            textDecoration: "none",
          }}
        >
          {claimedUser.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={claimedUser.avatar_url}
              alt=""
              style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : null}
          {t("查看平台主页", "View platform profile")} · @{claimedUser.username}
          <span style={{ color: "#1e3a8a", fontWeight: 800 }}>→</span>
        </Link>
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 10,
        fontSize: 12,
        color: "#94a3b8",
        fontWeight: 600,
      }}
    >
      {t("该球员暂未绑定平台账号。", "This player has not yet been linked to a platform account.")}
    </div>
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
function Empty({ text }: { text: string }) {
  return <div style={{ color: "#94a3b8", fontSize: 14, padding: "8px 0 24px" }}>{text}</div>;
}

function UnbindButton({
  playerId,
  onUnbound,
}: {
  playerId: string;
  onUnbound: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const click = async () => {
    if (
      !window.confirm(
        t(
          "解绑后此档案将不再与你的账号关联，你的统计仍保留。确认解绑？",
          "After unbinding, this profile will no longer be linked to your account. Your stats are kept. Continue?",
        ),
      )
    )
      return;
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-players/${playerId}/claim`,
      { method: "DELETE" },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr((body as { error?: string }).error ?? `HTTP ${res.status}`);
      return;
    }
    onUnbound();
  };
  return (
    <>
      <button
        onClick={click}
        disabled={busy}
        style={{
          padding: "6px 14px",
          background: "transparent",
          border: "1px solid #fecaca",
          color: "#991b1b",
          borderRadius: 999,
          fontSize: 13,
          fontWeight: 800,
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? t("解绑中…", "Unbinding…") : t("解绑档案", "Unbind Profile")}
      </button>
      {err && (
        <span style={{ color: "#991b1b", fontSize: 12, fontWeight: 700, alignSelf: "center" }}>
          {err}
        </span>
      )}
    </>
  );
}

function SelfEditProfileForm({
  player,
  onCancel,
  onSaved,
}: {
  player: {
    id: string;
    display_name: string;
    position: string | null;
    jersey_number: string | null;
    height_cm: number | null;
    weight_kg: number | null;
    birth_year: number | null;
    bio: string | null;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [displayName, setDisplayName] = useState(player.display_name);
  const [position, setPosition] = useState(player.position ?? "");
  const [jersey, setJersey] = useState(player.jersey_number ?? "");
  const [heightCm, setHeightCm] = useState(
    player.height_cm != null ? String(player.height_cm) : "",
  );
  const [weightKg, setWeightKg] = useState(
    player.weight_kg != null ? String(player.weight_kg) : "",
  );
  const [birthYear, setBirthYear] = useState(
    player.birth_year != null ? String(player.birth_year) : "",
  );
  const [bio, setBio] = useState(player.bio ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDetails, setErrDetails] = useState<string | null>(null);

  const positions = ["PG", "SG", "SF", "PF", "C", "PG/SG", "SG/SF", "SF/PF", "PF/C"];

  const save = async () => {
    setErr(null);
    setErrDetails(null);
    if (!displayName.trim()) {
      setErr(t("请填写球员名。", "Display name is required."));
      return;
    }
    setBusy(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        try {
          avatarUrl = await uploadBasketballPlayerAvatar(
            "",
            player.id,
            avatarFile,
          );
        } catch (uploadErr) {
          const raw =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          const status =
            uploadErr instanceof Error
              ? (uploadErr as Error & { status?: number }).status ?? null
              : null;
          setErr(
            status === 403
              ? t(
                  "你没有权限上传该球员头像。",
                  "You do not have permission to upload this avatar.",
                )
              : t("头像上传失败，请重试。", "Avatar upload failed. Please try again."),
          );
          setErrDetails(raw);
          return;
        }
      }

      const heightCmNum = heightCm ? Number(heightCm) : null;
      const weightKgNum = weightKg ? Number(weightKg) : null;
      const birthYearNum = birthYear ? Number(birthYear) : null;
      const patch: Record<string, unknown> = {
        display_name: displayName.trim(),
        position: position || null,
        jersey_number: jersey || null,
        height_cm:
          heightCmNum != null && Number.isFinite(heightCmNum) ? heightCmNum : null,
        weight_kg:
          weightKgNum != null && Number.isFinite(weightKgNum) ? weightKgNum : null,
        birth_year:
          birthYearNum != null && Number.isFinite(birthYearNum) ? birthYearNum : null,
        bio: bio || null,
      };
      if (avatarUrl) patch.avatar_url = avatarUrl;

      const res = await basketballFetch(
        `/api/basketball-players/${player.id}/profile`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr((body as { error?: string }).error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: -8,
        marginBottom: 24,
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 15 }}>
        {t("编辑我的资料", "Edit My Profile")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("球员名", "Display name")}
          style={{ ...editInputStyle(), flex: "2 1 200px" }}
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={{ ...editInputStyle(), flex: "1 1 110px" }}
        >
          <option value="">{t("位置", "Position")}</option>
          {positions.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <input
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          placeholder={t("球衣号", "Jersey #")}
          style={{ ...editInputStyle(), flex: "0 1 110px" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("身高 cm", "Height cm")}
          style={{ ...editInputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("体重 kg", "Weight kg")}
          style={{ ...editInputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("出生年", "Birth year")}
          style={{ ...editInputStyle(), flex: "1 1 130px" }}
        />
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 13,
            color: "#475569",
            flex: "1 1 200px",
          }}
        >
          {t("替换头像", "Replace avatar")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12 }}
          />
        </label>
      </div>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={t("简介 (可选)", "Bio (optional)")}
        rows={3}
        style={{
          ...editInputStyle(),
          width: "100%",
          minHeight: 70,
          padding: "8px 12px",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {err && (
        <div>
          <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
          {errDetails && (
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{errDetails}</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={save}
          disabled={busy}
          style={{
            padding: "8px 16px",
            background: busy ? "#94a3b8" : "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontWeight: 800,
            fontSize: 13,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? t("保存中…", "Saving…") : t("保存", "Save")}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          style={{
            padding: "8px 16px",
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
            color: "#0f172a",
            cursor: busy ? "default" : "pointer",
          }}
        >
          {t("取消", "Cancel")}
        </button>
      </div>
    </div>
  );
}

function editInputStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  };
}
