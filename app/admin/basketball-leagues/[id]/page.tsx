"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import AuthGate from "@/components/basketball/AuthGate";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import LeagueMemberApprovalList from "@/components/basketball/LeagueMemberApprovalList";
import PlayerClaimApprovalList from "@/components/basketball/PlayerClaimApprovalList";
import ScorekeepingPanel from "@/components/basketball/ScorekeepingPanel";
import AdminBoxScoreOverride from "@/components/basketball/AdminBoxScoreOverride";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import {
  uploadBasketballTeamLogo,
  uploadBasketballPlayerAvatar,
  uploadBasketballLeagueLogo,
} from "@/lib/basketball/uploads";
import { memberRoleLabel, MEMBER_ROLE_VALUES } from "@/lib/basketball/role-labels";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "public" | "invite_only" | "private";
  status: string;
  is_contest_enabled: boolean;
  logo_url: string | null;
};

type Access = {
  canManageLeague: boolean;
  canManageTeamsPlayersGames: boolean;
  canManageOwnTeam: boolean;
  canInputStats: boolean;
  leagueAdminRole: "league_owner" | "league_admin" | null;
  isPlatformAdmin: boolean;
  memberTeamId: string | null;
};

type Team = {
  id: string;
  name: string;
  abbreviation: string | null;
  city: string | null;
  logo_url: string | null;
  bio: string | null;
};
type Player = {
  id: string;
  display_name: string;
  position: string | null;
  team_id: string | null;
  claimed_by_user_id: string | null;
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
  jersey_number: string | null;
  avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  birth_year: number | null;
  bio: string | null;
  is_active: boolean;
};
type Game = {
  id: string;
  basketball_league_id: string;
  scheduled_at: string | null;
  status: "scheduled" | "live" | "final" | "cancelled";
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  on_court_player_ids: string[] | null;
};
type MemberRole =
  | "league_admin"
  | "team_manager"
  | "player"
  | "referee"
  | "scorekeeper"
  | "viewer";
type Member = {
  user_id: string;
  role: MemberRole;
  status: "pending" | "approved" | "rejected" | "removed";
  team_id: string | null;
};

type Tab = "settings" | "teams" | "players" | "games" | "members" | "claims" | "boxscore";

export default function LeagueAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <AuthGate>
      <LeagueAdminPageInner id={id} />
    </AuthGate>
  );
}

function LeagueAdminPageInner({ id }: { id: string }) {
  const { t } = useLang();
  const [league, setLeague] = useState<League | null>(null);
  const [access, setAccess] = useState<Access | null>(null);
  const [tab, setTab] = useState<Tab>("settings");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [members, setMembers] = useState<{ admins: unknown[]; members: Member[]; pending: Member[] }>(
    { admins: [], members: [], pending: [] },
  );

  const refresh = useCallback(async () => {
    const { data, error } = await basketballJson<{ league: League; access: Access }>(
      `/api/basketball-leagues/${id}`,
    );
    if (error || !data) {
      setErr(error ?? "load_failed");
      setLoading(false);
      return;
    }
    setLeague(data.league);
    setAccess(data.access);
    if (!data.access.canManageLeague && data.access.canManageOwnTeam) {
      setTab("players");
    } else if (
      !data.access.canManageLeague &&
      !data.access.canManageOwnTeam &&
      data.access.canInputStats
    ) {
      setTab("boxscore");
    }
    setLoading(false);

    if (
      data.access.canManageTeamsPlayersGames ||
      data.access.canManageOwnTeam ||
      data.access.canInputStats
    ) {
      const [tRes, pRes, gRes] = await Promise.all([
        basketballJson<{ teams: Team[] }>(`/api/basketball-leagues/${id}/teams`),
        basketballJson<{ players: Player[] }>(`/api/basketball-leagues/${id}/players`),
        basketballJson<{ games: Game[] }>(`/api/basketball-leagues/${id}/games`),
      ]);
      setTeams(tRes.data?.teams ?? []);
      setPlayers(pRes.data?.players ?? []);
      setGames(gRes.data?.games ?? []);
      if (data.access.canManageLeague) {
        const mRes = await basketballJson<typeof members>(
          `/api/basketball-leagues/${id}/members`,
        );
        if (mRes.data) setMembers(mRes.data);
      }
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

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
          {err}
        </main>
      </>
    );
  }

  if (!access.canManageLeague && !access.canManageOwnTeam && !access.canInputStats) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("仅联赛管理员可访问。", "League admins only.")}
        </main>
      </>
    );
  }

  // Team managers (who are not league/platform admins) get a restricted shell:
  // only the Players tab is interactive; other tabs render a per-tab notice.
  const isAdminLike = access.canManageLeague;
  const restrictedNotice = (
    <div style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
      {t("仅联赛管理员可访问。", "League admins only.")}
    </div>
  );

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "settings", label: t("设置", "Settings") },
    { id: "teams", label: t("球队", "Teams") },
    { id: "players", label: t("球员", "Players") },
    { id: "games", label: t("比赛", "Games") },
    { id: "boxscore", label: t("数据录入", "Box Score") },
    { id: "members", label: t("成员", "Members") },
    { id: "claims", label: t("球员认领", "Claims") },
  ];

  return (
    <>
      <LightHeader activeHref="" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 80px" }}>
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
            marginBottom: 10,
          }}
        >
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{ textDecoration: "none", color: "inherit" }}
            title={t("查看公开页面", "View public page")}
          >
            <h1
              style={{
                fontSize: 28,
                fontWeight: 900,
                color: "#0f172a",
                letterSpacing: "-0.02em",
                margin: 0,
              }}
            >
              {league.name}
            </h1>
          </Link>
          <LeagueVisibilityBadge visibility={league.visibility} />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{league.status}</span>
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{ fontSize: 13, color: "#1e3a8a", textDecoration: "none", fontWeight: 800 }}
          >
            {t("查看公开页面 →", "View public page →")}
          </Link>
        </div>

        <nav
          style={{
            display: "flex",
            gap: 6,
            flexWrap: "wrap",
            borderBottom: "1px solid #e2e8f0",
            marginBottom: 22,
          }}
        >
          {tabs.map((tt) => (
            <button
              key={tt.id}
              onClick={() => setTab(tt.id)}
              style={{
                padding: "10px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: tab === tt.id ? 800 : 600,
                color: tab === tt.id ? "#1e3a8a" : "#64748b",
                borderBottom: tab === tt.id ? "2px solid #1e3a8a" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {tt.label}
            </button>
          ))}
        </nav>

        {tab === "settings" &&
          (isAdminLike ? <SettingsTab league={league} onSaved={refresh} /> : restrictedNotice)}
        {tab === "teams" &&
          (isAdminLike ? (
            <TeamsTab leagueId={id} leagueSlug={league.slug} teams={teams} onChanged={refresh} />
          ) : (
            restrictedNotice
          ))}
        {tab === "players" && (
          <PlayersTab
            leagueId={id}
            leagueSlug={league.slug}
            teams={teams}
            players={players}
            onChanged={refresh}
            isAdminLike={isAdminLike}
            managerTeamId={access.memberTeamId ?? null}
          />
        )}
        {tab === "games" &&
          (isAdminLike ? (
            <GamesTab leagueId={id} leagueSlug={league.slug} teams={teams} games={games} onChanged={refresh} />
          ) : (
            restrictedNotice
          ))}
        {tab === "boxscore" &&
          (isAdminLike || access.canInputStats ? (
            <BoxScoreTab
              leagueSlug={league.slug}
              games={games}
              teams={teams}
              players={players}
              canOverride={
                access.isPlatformAdmin || access.leagueAdminRole !== null
              }
            />
          ) : (
            restrictedNotice
          ))}
        {tab === "members" &&
          (isAdminLike ? (
            <MembersTab
              leagueId={id}
              teams={teams}
              members={[...members.pending, ...members.members]}
              onChanged={refresh}
            />
          ) : (
            restrictedNotice
          ))}
        {tab === "claims" &&
          (isAdminLike ? (
            <PlayerClaimApprovalList players={players} onChanged={refresh} />
          ) : (
            restrictedNotice
          ))}
      </main>
    </>
  );
}

// ─────────── Settings (incl. visibility) ───────────

function SettingsTab({ league, onSaved }: { league: League; onSaved: () => void }) {
  const { t } = useLang();
  const [visibility, setVisibility] = useState(league.visibility);
  const [name, setName] = useState(league.name);
  const [description, setDescription] = useState(league.description ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const saveMeta = async () => {
    setBusy(true);
    setMsg(null);
    const res = await basketballFetch(`/api/basketball-leagues/${league.id}`, {
      method: "PATCH",
      body: JSON.stringify({ name, description }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setMsg(t("已保存", "Saved"));
    onSaved();
  };

  const saveVisibility = async (next: League["visibility"]) => {
    setVisibility(next);
    const res = await basketballFetch(
      `/api/basketball-leagues/${league.id}/visibility`,
      { method: "PATCH", body: JSON.stringify({ visibility: next }) },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setMsg(body.error ?? `HTTP ${res.status}`);
      return;
    }
    onSaved();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 640 }}>
      <Field label={t("名称", "Name")}>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle()} />
      </Field>
      <Field label={t("简介", "Description")}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle(), minHeight: 90, padding: 10, resize: "vertical" }}
        />
      </Field>
      <button onClick={saveMeta} disabled={busy} style={primaryBtn(busy)}>
        {busy ? t("保存中…", "Saving…") : t("保存", "Save")}
      </button>
      <LeagueLogoField league={league} onSaved={onSaved} />
      <Field label={t("可见性", "Visibility")}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {(["public", "invite_only", "private"] as const).map((v) => (
            <button
              key={v}
              onClick={() => saveVisibility(v)}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                border: visibility === v ? "2px solid #1e3a8a" : "1px solid #cbd5e1",
                background: visibility === v ? "#eef2ff" : "#fff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {v}
            </button>
          ))}
        </div>
      </Field>
      <ContestEnabledToggle league={league} onSaved={onSaved} />
      {msg && <div style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

function LeagueLogoField({
  league,
  onSaved,
}: {
  league: League;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDetails, setErrDetails] = useState<string | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setErr(null);
    setErrDetails(null);
    try {
      const url = await uploadBasketballLeagueLogo(league.id, file);
      const res = await basketballFetch(`/api/basketball-leagues/${league.id}`, {
        method: "PATCH",
        body: JSON.stringify({ logo_url: url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(t("保存失败，请重试。", "Save failed."));
        setErrDetails(String((body as { error?: string }).error ?? res.status));
        return;
      }
      onSaved();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const status = e instanceof Error ? (e as Error & { status?: number }).status ?? null : null;
      setErr(
        status === 403
          ? t("你没有权限上传联赛 logo。", "You do not have permission to upload the league logo.")
          : t("上传失败，请重试。", "Upload failed."),
      );
      setErrDetails(raw);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(t("移除联赛 logo？", "Remove league logo?"))) return;
    setBusy(true);
    const res = await basketballFetch(`/api/basketball-leagues/${league.id}`, {
      method: "PATCH",
      body: JSON.stringify({ logo_url: null }),
    });
    setBusy(false);
    if (res.ok) onSaved();
  };

  return (
    <Field label={t("联赛 Logo", "League Logo")}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12,
          flexWrap: "wrap",
        }}
      >
        {league.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={league.logo_url}
            alt=""
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              objectFit: "cover",
              background: "#fff",
              border: "1px solid #e2e8f0",
            }}
          />
        ) : (
          <span
            style={{
              width: 48,
              height: 48,
              borderRadius: 10,
              background: "#fff",
              border: "1px dashed #cbd5e1",
              display: "inline-block",
            }}
          />
        )}
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569" }}>
          {t("选择图片", "Choose image")}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.target.value = "";
            }}
            style={{ fontSize: 12 }}
          />
        </label>
        {league.logo_url && (
          <button
            onClick={remove}
            disabled={busy}
            style={{
              padding: "6px 12px",
              background: "transparent",
              border: "1px solid #fecaca",
              color: "#991b1b",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: busy ? "default" : "pointer",
            }}
          >
            {t("移除", "Remove")}
          </button>
        )}
        {busy && (
          <span style={{ color: "#64748b", fontSize: 12, fontWeight: 700 }}>
            {t("上传中…", "Uploading…")}
          </span>
        )}
      </div>
      {err && (
        <div style={{ marginTop: 6 }}>
          <div style={{ color: "#991b1b", fontSize: 12, fontWeight: 700 }}>{err}</div>
          {errDetails && (
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{errDetails}</div>
          )}
        </div>
      )}
    </Field>
  );
}

function ContestEnabledToggle({
  league,
  onSaved,
}: {
  league: League;
  onSaved: () => void;
}) {
  const { t } = useLang();
  const [enabled, setEnabled] = useState(league.is_contest_enabled);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggle = async () => {
    const next = !enabled;
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(`/api/basketball-leagues/${league.id}`, {
      method: "PATCH",
      body: JSON.stringify({ is_contest_enabled: next }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setEnabled(next);
    onSaved();
  };

  return (
    <Field label={t("每日竞赛 (/contest/<slug>)", "Daily contest (/contest/<slug>)")}>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 10,
          padding: 12,
        }}
      >
        <button
          onClick={toggle}
          disabled={busy}
          style={{
            position: "relative",
            width: 48,
            height: 28,
            borderRadius: 14,
            background: enabled ? "#1e3a8a" : "#cbd5e1",
            border: "none",
            cursor: busy ? "default" : "pointer",
            flexShrink: 0,
          }}
          aria-pressed={enabled}
        >
          <span
            style={{
              position: "absolute",
              top: 3,
              left: enabled ? 23 : 3,
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: "#fff",
              transition: "left 0.15s",
            }}
          />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
            {enabled
              ? t("已开放每日竞赛", "Fantasy contest enabled")
              : t("未开放每日竞赛", "Fantasy contest disabled")}
          </div>
          <div style={{ color: "#64748b", fontSize: 12, marginTop: 2, lineHeight: 1.5 }}>
            {t(
              "开启后该联赛会出现在「每日竞赛 / 其他联赛」列表，并可通过 /contest/<slug> 进入。",
              "Once enabled this league appears under Daily Contest / Other Leagues and becomes reachable at /contest/<slug>.",
            )}
          </div>
        </div>
      </div>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 12, marginTop: 6, fontWeight: 700 }}>{err}</div>
      )}
    </Field>
  );
}

// ─────────── Teams tab ───────────

function TeamsTab({
  leagueId,
  leagueSlug,
  teams,
  onChanged,
}: {
  leagueId: string;
  leagueSlug: string;
  teams: Team[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/teams`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          abbreviation: abbr || undefined,
          city: city || undefined,
          bio: bio || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      // If a logo was provided, upload to storage now that we have the team id,
      // then PATCH the row with the public URL.
      if (logoFile) {
        const body = (await res.json()) as { team: { id: string } };
        try {
          const url = await uploadBasketballTeamLogo(leagueId, body.team.id, logoFile);
          const patchRes = await basketballFetch(`/api/basketball-teams/${body.team.id}`, {
            method: "PATCH",
            body: JSON.stringify({ logo_url: url }),
          });
          if (!patchRes.ok) {
            const pb = await patchRes.json().catch(() => ({}));
            setErr(`logo_save_failed: ${pb.error ?? patchRes.status}`);
          }
        } catch (uploadErr) {
          setErr(
            `logo_upload_failed: ${uploadErr instanceof Error ? uploadErr.message : String(uploadErr)}`,
          );
        }
      }
      setName("");
      setAbbr("");
      setCity("");
      setBio("");
      setLogoFile(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("队名", "Name")}
          style={{ ...inputStyle(), flex: "2 1 160px" }}
        />
        <input
          value={abbr}
          onChange={(e) => setAbbr(e.target.value)}
          placeholder="ABV"
          style={{ ...inputStyle(), flex: "1 1 80px" }}
        />
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder={t("城市", "City")}
          style={{ ...inputStyle(), flex: "1 1 140px" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", flex: "1 1 200px" }}>
          {t("队徽", "Logo")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12 }}
          />
        </label>
      </div>
      <textarea
        value={bio}
        onChange={(e) => setBio(e.target.value)}
        placeholder={t("球队简介 (可选)", "Team bio (optional)")}
        rows={2}
        style={{
          ...inputStyle(),
          width: "100%",
          minHeight: 60,
          padding: "8px 12px",
          marginBottom: 10,
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      <div style={{ marginBottom: 14 }}>
        <button onClick={add} disabled={busy} style={primaryBtn(busy)}>
          {busy ? t("添加中…", "Adding…") : t("添加", "Add")}
        </button>
      </div>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {err}
        </div>
      )}
      {teams.length === 0 ? (
        <Empty text={t("尚无球队", "No teams yet")} />
      ) : (
        <ul style={listStyle()}>
          {teams.map((tm) => (
            <li key={tm.id} style={rowStyle()}>
              {tm.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={tm.logo_url}
                  alt=""
                  style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover", background: "#f1f5f9" }}
                />
              ) : (
                <span
                  style={{
                    width: 28, height: 28, borderRadius: 6, background: "#f1f5f9",
                    display: "inline-block", flexShrink: 0,
                  }}
                />
              )}
              <Link
                href={`/basketball-leagues/${leagueSlug}/teams/${tm.id}`}
                style={{ fontWeight: 800, color: "#0f172a", textDecoration: "none" }}
              >
                {tm.name}
              </Link>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {[tm.city, tm.abbreviation].filter(Boolean).join(" · ")}
              </span>
              {tm.bio && (
                <span style={{ color: "#94a3b8", fontSize: 11, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tm.bio}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Players tab ───────────

// Keep in sync with lib/basketball/contest-positions.ts CANONICAL_POSITIONS.
const POSITION_OPTIONS = [
  "PG", "SG", "SF", "PF", "C",
  "PG/SG", "SG/SF", "SF/PF", "PF/C",
] as const;

function avatarUploadErrorMessage(
  status: number | null,
  t: (zh: string, en: string) => string,
): string {
  if (status === 403) {
    return t(
      "你没有权限为该球员上传头像。",
      "You do not have permission to upload this player avatar.",
    );
  }
  return t("头像上传失败，请重试。", "Avatar upload failed. Please try again.");
}

function PlayersTab({
  leagueId,
  leagueSlug,
  teams,
  players,
  onChanged,
  isAdminLike,
  managerTeamId,
}: {
  leagueId: string;
  leagueSlug: string;
  teams: Team[];
  players: Player[];
  onChanged: () => void;
  isAdminLike: boolean;
  managerTeamId: string | null;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState<string>(isAdminLike ? "" : managerTeamId ?? "");
  const [jersey, setJersey] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDetails, setErrDetails] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const canEdit = (p: Player) =>
    isAdminLike || (managerTeamId != null && p.team_id === managerTeamId);

  const add = async () => {
    setErr(null);
    setErrDetails(null);
    if (!name.trim()) { setErr(t("请填写球员名", "Display name is required")); return; }
    if (!teamId) { setErr(t("请选择球队", "Pick a team")); return; }
    if (!position) { setErr(t("请选择位置", "Pick a position")); return; }
    setBusy(true);
    try {
      const heightCmNum = heightCm ? Number(heightCm) : undefined;
      const weightKgNum = weightKg ? Number(weightKg) : undefined;
      const birthYearNum = birthYear ? Number(birthYear) : undefined;
      const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/players`, {
        method: "POST",
        body: JSON.stringify({
          display_name: name.trim(),
          position,
          team_id: teamId,
          jersey_number: jersey || undefined,
          height_cm: Number.isFinite(heightCmNum) ? heightCmNum : undefined,
          weight_kg: Number.isFinite(weightKgNum) ? weightKgNum : undefined,
          birth_year: Number.isFinite(birthYearNum) ? birthYearNum : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      if (avatarFile) {
        const body = (await res.json()) as { player: { id: string } };
        try {
          const url = await uploadBasketballPlayerAvatar(leagueId, body.player.id, avatarFile);
          const patchRes = await basketballFetch(`/api/basketball-players/${body.player.id}/profile`, {
            method: "PATCH",
            body: JSON.stringify({ avatar_url: url }),
          });
          if (!patchRes.ok) {
            const pb = await patchRes.json().catch(() => ({}));
            setErr(avatarUploadErrorMessage(patchRes.status, t));
            setErrDetails(String(pb.error ?? patchRes.status));
          }
        } catch (uploadErr) {
          const raw =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          const status =
            uploadErr instanceof Error
              ? (uploadErr as Error & { status?: number }).status ?? null
              : null;
          setErr(avatarUploadErrorMessage(status, t));
          setErrDetails(raw);
        }
      }
      setName("");
      setPosition("");
      if (isAdminLike) setTeamId("");
      setJersey("");
      setHeightCm("");
      setWeightKg("");
      setBirthYear("");
      setAvatarFile(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = !!name.trim() && !!position && !!teamId && !busy;
  const teamOptions = isAdminLike
    ? teams
    : teams.filter((tm) => tm.id === managerTeamId);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("球员名", "Display name")}
          style={{ ...inputStyle(), flex: "2 1 180px" }}
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 110px" }}
        >
          <option value="">{t("位置", "Position")}</option>
          {POSITION_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          disabled={!isAdminLike}
          style={{ ...inputStyle(), flex: "1 1 160px" }}
        >
          <option value="">{t("选择球队", "Pick team")}</option>
          {teamOptions.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
        <input
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          placeholder={t("球衣号", "Jersey #")}
          style={{ ...inputStyle(), flex: "0 1 100px" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        <input
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("身高 cm", "Height cm")}
          style={{ ...inputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("体重 kg", "Weight kg")}
          style={{ ...inputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("出生年", "Birth year")}
          style={{ ...inputStyle(), flex: "1 1 130px" }}
        />
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#475569", flex: "1 1 200px" }}>
          {t("头像", "Avatar")}
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            style={{ fontSize: 12 }}
          />
        </label>
      </div>
      <div style={{ marginBottom: 14 }}>
        <button onClick={add} disabled={!canSubmit} style={primaryBtn(!canSubmit)}>
          {busy ? t("添加中…", "Adding…") : t("添加", "Add")}
        </button>
      </div>
      {err && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
          {errDetails && (
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{errDetails}</div>
          )}
        </div>
      )}
      {players.length === 0 ? (
        <Empty text={t("尚无球员", "No players yet")} />
      ) : (
        <ul style={listStyle()}>
          {players.map((p) => (
            <li key={p.id} style={{ ...rowStyle(), flexDirection: "column", alignItems: "stretch" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.avatar_url}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", background: "#f1f5f9" }}
                  />
                ) : (
                  <span
                    style={{
                      width: 28, height: 28, borderRadius: "50%", background: "#f1f5f9",
                      display: "inline-block", flexShrink: 0,
                    }}
                  />
                )}
                <Link
                  href={`/basketball-leagues/${leagueSlug}/players/${p.id}`}
                  style={{ fontWeight: 800, color: "#0f172a", textDecoration: "none" }}
                >
                  {p.display_name}
                </Link>
                {p.jersey_number && (
                  <span style={{ color: "#1e3a8a", fontSize: 12, fontWeight: 700 }}>#{p.jersey_number}</span>
                )}
                <span style={{ color: "#64748b", fontSize: 12 }}>
                  {[p.position, teams.find((tm) => tm.id === p.team_id)?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>
                  {p.claim_status}
                </span>
                {!p.is_active && (
                  <span style={{ color: "#b45309", fontSize: 11, fontWeight: 700 }}>
                    {t("已停用", "inactive")}
                  </span>
                )}
                {canEdit(p) && (
                  <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                    <button
                      onClick={() =>
                        setEditingId((cur) => (cur === p.id ? null : p.id))
                      }
                      style={smallBtn("#1e3a8a")}
                    >
                      {editingId === p.id ? t("收起", "Close") : t("编辑", "Edit")}
                    </button>
                  </div>
                )}
              </div>
              {editingId === p.id && canEdit(p) && (
                <PlayerEditForm
                  leagueId={leagueId}
                  player={p}
                  teams={teams}
                  isAdminLike={isAdminLike}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    onChanged();
                  }}
                  onDeleted={() => {
                    setEditingId(null);
                    onChanged();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlayerEditForm({
  leagueId,
  player,
  teams,
  isAdminLike,
  onCancel,
  onSaved,
  onDeleted,
}: {
  leagueId: string;
  player: Player;
  teams: Team[];
  isAdminLike: boolean;
  onCancel: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(player.display_name);
  const [position, setPosition] = useState(player.position ?? "");
  const [teamId, setTeamId] = useState<string>(player.team_id ?? "");
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
  const [isActive, setIsActive] = useState(player.is_active);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [errDetails, setErrDetails] = useState<string | null>(null);

  const save = async () => {
    setErr(null);
    setErrDetails(null);
    if (!name.trim()) {
      setErr(t("请填写球员名", "Display name is required"));
      return;
    }
    setBusy(true);
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        try {
          avatarUrl = await uploadBasketballPlayerAvatar(leagueId, player.id, avatarFile);
        } catch (uploadErr) {
          const raw =
            uploadErr instanceof Error ? uploadErr.message : String(uploadErr);
          const status =
            uploadErr instanceof Error
              ? (uploadErr as Error & { status?: number }).status ?? null
              : null;
          setErr(avatarUploadErrorMessage(status, t));
          setErrDetails(raw);
          return;
        }
      }

      const heightCmNum = heightCm ? Number(heightCm) : null;
      const weightKgNum = weightKg ? Number(weightKg) : null;
      const birthYearNum = birthYear ? Number(birthYear) : null;
      const patch: Record<string, unknown> = {
        display_name: name.trim(),
        position: position || null,
        jersey_number: jersey || null,
        height_cm: heightCmNum != null && Number.isFinite(heightCmNum) ? heightCmNum : null,
        weight_kg: weightKgNum != null && Number.isFinite(weightKgNum) ? weightKgNum : null,
        birth_year: birthYearNum != null && Number.isFinite(birthYearNum) ? birthYearNum : null,
        bio: bio || null,
      };
      if (avatarUrl) patch.avatar_url = avatarUrl;
      if (isAdminLike) {
        if (teamId) patch.team_id = teamId;
        patch.is_active = isActive;
      }

      const res = await basketballFetch(
        `/api/basketball-players/${player.id}/profile`,
        { method: "PATCH", body: JSON.stringify(patch) },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (force: boolean) => {
    setErr(null);
    setErrDetails(null);
    const confirmMsg = force
      ? t(
          "该球员有历史数据，强制删除将一并清除其全部数据，是否继续？",
          "This player has stat history. Forcing delete will also remove ALL their box-score data. Continue?",
        )
      : t("确认删除该球员？此操作无法撤销。", "Delete this player? This cannot be undone.");
    if (!window.confirm(confirmMsg)) return;
    setBusy(true);
    try {
      const res = await basketballFetch(
        `/api/basketball-players/${player.id}${force ? "?force=true" : ""}`,
        { method: "DELETE" },
      );
      if (res.status === 204) {
        onDeleted();
        return;
      }
      const body = await res.json().catch(() => ({}));
      const code = (body as { error?: string }).error;
      if (code === "has_stats") {
        setErr(
          t(
            "该球员有历史数据，无法直接删除，可改为停用。",
            "This player has stat history and cannot be deleted directly. You can deactivate them instead.",
          ),
        );
      } else if (code === "has_binding") {
        setErr(
          t(
            "该球员已绑定平台用户，请先解绑。",
            "This player is linked to a platform user. Please unbind first.",
          ),
        );
      } else {
        setErr(code ?? `HTTP ${res.status}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: 12,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("球员名", "Display name")}
          style={{ ...inputStyle(), flex: "2 1 180px" }}
        />
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 110px" }}
        >
          <option value="">{t("位置", "Position")}</option>
          {POSITION_OPTIONS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {isAdminLike && (
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            style={{ ...inputStyle(), flex: "1 1 160px" }}
          >
            <option value="">{t("选择球队", "Pick team")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
        )}
        <input
          value={jersey}
          onChange={(e) => setJersey(e.target.value)}
          placeholder={t("球衣号", "Jersey #")}
          style={{ ...inputStyle(), flex: "0 1 100px" }}
        />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={heightCm}
          onChange={(e) => setHeightCm(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("身高 cm", "Height cm")}
          style={{ ...inputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={weightKg}
          onChange={(e) => setWeightKg(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("体重 kg", "Weight kg")}
          style={{ ...inputStyle(), flex: "1 1 120px" }}
        />
        <input
          value={birthYear}
          onChange={(e) => setBirthYear(e.target.value)}
          type="number"
          inputMode="numeric"
          placeholder={t("出生年", "Birth year")}
          style={{ ...inputStyle(), flex: "1 1 130px" }}
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
        rows={2}
        style={{
          ...inputStyle(),
          width: "100%",
          minHeight: 60,
          padding: "8px 12px",
          resize: "vertical",
          fontFamily: "inherit",
        }}
      />
      {isAdminLike && (
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 13,
            color: "#0f172a",
            fontWeight: 700,
          }}
        >
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          {t("启用球员（取消勾选即停用）", "Active (uncheck to deactivate)")}
        </label>
      )}
      {err && (
        <div>
          <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
          {errDetails && (
            <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 2 }}>{errDetails}</div>
          )}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={save} disabled={busy} style={primaryBtn(busy)}>
          {busy ? t("保存中…", "Saving…") : t("保存", "Save")}
        </button>
        <button onClick={onCancel} disabled={busy} style={smallBtn("#475569")}>
          {t("取消", "Cancel")}
        </button>
        <button
          onClick={() => remove(false)}
          disabled={busy}
          style={{
            ...smallBtn("#991b1b"),
            background: "transparent",
            color: "#991b1b",
            border: "1px solid #fecaca",
          }}
        >
          {t("删除", "Delete")}
        </button>
        {isAdminLike && (
          <button
            onClick={() => remove(true)}
            disabled={busy}
            style={{
              ...smallBtn("#991b1b"),
              background: "transparent",
              color: "#991b1b",
              border: "1px dashed #fecaca",
            }}
            title={t(
              "强制删除：包括历史数据。",
              "Force delete: also removes box-score history.",
            )}
          >
            {t("强制删除", "Force delete")}
          </button>
        )}
      </div>
    </div>
  );
}

// ─────────── Games tab ───────────

function GamesTab({
  leagueId,
  leagueSlug,
  teams,
  games,
  onChanged,
}: {
  leagueId: string;
  leagueSlug: string;
  teams: Team[];
  games: Game[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [home, setHome] = useState<string>("");
  const [away, setAway] = useState<string>("");
  const [when, setWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const sameTeam = !!home && !!away && home === away;
  const canSubmit = !!home && !!away && !!when && !sameTeam;

  const add = async () => {
    setErr(null);
    if (!home) { setErr(t("请选择主队", "Pick a home team")); return; }
    if (!away) { setErr(t("请选择客队", "Pick an away team")); return; }
    if (!when) { setErr(t("请选择比赛时间", "Pick a scheduled time")); return; }
    if (home === away) { setErr(t("主客队不能相同", "Home and away cannot be the same team")); return; }

    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/games`, {
      method: "POST",
      body: JSON.stringify({
        home_team_id: home,
        away_team_id: away,
        scheduled_at: new Date(when).toISOString(),
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.reason ?? body.error ?? `HTTP ${res.status}`);
      return;
    }
    setHome("");
    setAway("");
    setWhen("");
    onChanged();
  };

  const remove = async (gameId: string) => {
    setErr(null);
    if (!confirm(t("确认删除该比赛？此操作无法撤销。", "Delete this game? This cannot be undone."))) {
      return;
    }
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/games/${gameId}`,
      { method: "DELETE" },
    );
    if (res.status === 204) {
      onChanged();
      return;
    }
    const body = await res.json().catch(() => ({}));
    setErr(body.error ?? `HTTP ${res.status}`);
  };

  const teamName = (id: string | null) =>
    id ? teams.find((tm) => tm.id === id)?.name ?? "—" : "—";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <select
          value={away}
          onChange={(e) => setAway(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 160px" }}
        >
          <option value="">{t("客队", "Away team")}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
        <span style={{ alignSelf: "center", color: "#64748b" }}>@</span>
        <select
          value={home}
          onChange={(e) => setHome(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 160px" }}
        >
          <option value="">{t("主队", "Home team")}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 200px" }}
        />
        <button onClick={add} disabled={!canSubmit} style={primaryBtn(!canSubmit)}>
          {t("添加比赛", "Add game")}
        </button>
      </div>
      {sameTeam && (
        <div style={{ color: "#991b1b", fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {t("主客队不能相同", "Home and away cannot be the same team")}
        </div>
      )}
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {err}
        </div>
      )}
      {games.length === 0 ? (
        <Empty text={t("尚无比赛", "No games yet")} />
      ) : (
        <ul style={listStyle()}>
          {games.map((g) => (
            <li key={g.id} style={rowStyle()}>
              <Link
                href={`/basketball-leagues/${leagueSlug}/games/${g.id}`}
                style={{ fontWeight: 800, color: "#0f172a", textDecoration: "none" }}
              >
                {teamName(g.away_team_id)} @ {teamName(g.home_team_id)}
              </Link>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {g.scheduled_at ? new Date(g.scheduled_at).toLocaleString() : t("时间待定", "TBD")}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>{g.status}</span>
              {(g.home_score != null || g.away_score != null) && (
                <span style={{ color: "#1e3a8a", fontWeight: 800, fontSize: 12 }}>
                  {g.away_score ?? 0} – {g.home_score ?? 0}
                </span>
              )}
              <div style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Link
                  href={`/basketball-leagues/${leagueSlug}/games/${g.id}`}
                  style={{
                    background: "#fff",
                    border: "1px solid #cbd5e1",
                    color: "#1e3a8a",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  {t("预览", "Preview")}
                </Link>
                <button
                  onClick={() => remove(g.id)}
                  style={{
                    background: "transparent",
                    border: "1px solid #fecaca",
                    color: "#991b1b",
                    borderRadius: 6,
                    padding: "4px 10px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("删除", "Delete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ContestDiagnosticsPanel leagueId={leagueId} />
    </div>
  );
}

function ContestDiagnosticsPanel({ leagueId }: { leagueId: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setErr(null);
    const res = await basketballJson<Record<string, unknown>>(
      `/api/basketball-leagues/${leagueId}/contest-diagnostics`,
    );
    setLoading(false);
    if (res.error) { setErr(res.error); return; }
    setData(res.data ?? null);
  };

  return (
    <div style={{ marginTop: 24, border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fafafa" }}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open && !data) load(); }}
        style={{
          background: "transparent", border: "none", cursor: "pointer",
          fontSize: 13, fontWeight: 700, color: "#0f172a",
        }}
      >
        {open ? "▾" : "▸"} {t("竞赛诊断", "Contest diagnostics")}
      </button>
      {open && (
        <div style={{ marginTop: 10, fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
          {loading && <div style={{ color: "#64748b" }}>{t("加载中…", "Loading…")}</div>}
          {err && <div style={{ color: "#991b1b" }}>{err}</div>}
          {data && (
            <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          )}
          <button
            onClick={load}
            style={{
              marginTop: 8,
              background: "#1e3a8a", color: "#fff",
              border: "none", borderRadius: 6,
              padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
            }}
          >
            {t("刷新", "Refresh")}
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────── Box-score tab ───────────

function BoxScoreTab({
  leagueSlug,
  games,
  teams,
  players,
  canOverride,
}: {
  leagueSlug: string;
  games: Game[];
  teams: Team[];
  players: Player[];
  canOverride: boolean;
}) {
  const { t } = useLang();
  const [gameId, setGameId] = useState<string>(games[0]?.id ?? "");
  const game = games.find((g) => g.id === gameId);
  const gamePlayers = game
    ? players.filter(
        (p) => p.team_id && (p.team_id === game.home_team_id || p.team_id === game.away_team_id),
      )
    : [];

  const teamName = (id: string | null) =>
    id ? teams.find((tm) => tm.id === id)?.name ?? "—" : "—";

  if (games.length === 0) {
    return (
      <Empty
        text={t(
          "暂无可录入比赛。请先在「比赛」标签新建比赛。",
          "No games available for scorekeeping. Create one in the Games tab first.",
        )}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 280px" }}
        >
          <option value="">{t("选择比赛", "Select game")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {teamName(g.away_team_id)} @ {teamName(g.home_team_id)} ·{" "}
              {g.scheduled_at ? new Date(g.scheduled_at).toLocaleDateString() : "TBD"} · {g.status}
            </option>
          ))}
        </select>
      </div>
      {!game ? (
        <Empty text={t("请选择比赛", "Select a game above.")} />
      ) : gamePlayers.length === 0 ? (
        <Empty
          text={t(
            "该比赛两队尚未关联球员。请在「球员」标签中为球队分配球员。",
            "No players assigned to either team. Add team players in the Players tab.",
          )}
        />
      ) : (
        <>
          <ScorekeepingPanel
            key={`panel-${game.id}`}
            leagueSlug={leagueSlug}
            game={{
              id: game.id,
              basketball_league_id: game.basketball_league_id,
              status: game.status,
              scheduled_at: game.scheduled_at,
              home_team_id: game.home_team_id,
              away_team_id: game.away_team_id,
              home_score: game.home_score,
              away_score: game.away_score,
              on_court_player_ids: game.on_court_player_ids ?? [],
            }}
            teams={teams.map((tm) => ({
              id: tm.id,
              name: tm.name,
              abbreviation: tm.abbreviation,
              logo_url: tm.logo_url,
            }))}
            players={gamePlayers.map((p) => ({
              id: p.id,
              display_name: p.display_name,
              team_id: p.team_id,
              position: p.position,
              jersey_number: p.jersey_number,
              avatar_url: p.avatar_url,
            }))}
            canStart
          />
          {canOverride && (
            <AdminBoxScoreOverride
              key={`override-${game.id}`}
              gameId={game.id}
              players={gamePlayers.map((p) => ({
                id: p.id,
                display_name: p.display_name,
                team_id: p.team_id,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}

// ─────────── Members tab ───────────

const TEAM_SCOPED_MEMBER_ROLES = new Set<MemberRole>(["team_manager", "player"]);

function MembersTab({
  leagueId,
  teams,
  members,
  onChanged,
}: {
  leagueId: string;
  teams: Team[];
  members: Member[];
  onChanged: () => void;
}) {
  const { t, lang } = useLang();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<MemberRole>("scorekeeper");
  const [memberTeamId, setMemberTeamId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [usernameQuery, setUsernameQuery] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);

  const needsTeam = TEAM_SCOPED_MEMBER_ROLES.has(role);

  const lookupByUsername = async () => {
    const q = usernameQuery.trim();
    if (!q) return;
    setErr(null);
    setInfo(null);
    setLookupBusy(true);
    try {
      const res = await basketballFetch(
        `/api/basketball-leagues/${leagueId}/lookup-user?u=${encodeURIComponent(q)}`,
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (res.status === 404) {
          setErr(t(`未找到用户名 "${q}"`, `Username "${q}" not found`));
        } else {
          setErr(body.error ?? `HTTP ${res.status}`);
        }
        return;
      }
      const body = (await res.json()) as { user_id: string; username: string; name: string | null };
      setUserId(body.user_id);
      setInfo(t(`已找到：${body.name ?? body.username}`, `Found: ${body.name ?? body.username}`));
    } finally {
      setLookupBusy(false);
    }
  };

  const invite = async () => {
    if (!userId.trim()) return;
    setErr(null);
    setInfo(null);
    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/members`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId.trim(),
        role,
        status: "approved",
        team_id: needsTeam ? memberTeamId || null : null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    if (body?.warning === "user_not_found_in_public_users") {
      setInfo(
        t(
          "成员已添加，但该 UUID 在平台用户表中未找到（请确认 UUID 正确）。",
          "Member added, but this UUID was not found in the platform users table (please verify the UUID).",
        ),
      );
    } else {
      setInfo(t("已添加为活跃成员。", "Added as an active member."));
    }
    setUserId("");
    setUsernameQuery("");
    setMemberTeamId("");
    onChanged();
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          marginBottom: 10,
          alignItems: "center",
        }}
      >
        <input
          value={usernameQuery}
          onChange={(e) => setUsernameQuery(e.target.value)}
          placeholder={t("用户名 (查找)", "Username (lookup)")}
          onKeyDown={(e) => {
            if (e.key === "Enter") lookupByUsername();
          }}
          style={{ ...inputStyle(), flex: "1 1 200px" }}
        />
        <button onClick={lookupByUsername} disabled={lookupBusy} style={primaryBtn(lookupBusy)}>
          {lookupBusy ? t("查找中…", "Looking up…") : t("查找", "Look up")}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="user_id (uuid)"
          style={{
            ...inputStyle(),
            flex: "1 1 260px",
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as MemberRole)}
          style={{ ...inputStyle(), flex: "0 0 160px" }}
        >
          {MEMBER_ROLE_VALUES.map((r) => (
            <option key={r} value={r}>{memberRoleLabel(r, lang)}</option>
          ))}
        </select>
        {needsTeam && (
          <select
            value={memberTeamId}
            onChange={(e) => setMemberTeamId(e.target.value)}
            style={{ ...inputStyle(), flex: "1 1 180px" }}
          >
            <option value="">{t("选择球队 (可选)", "Pick team (optional)")}</option>
            {teams.map((tm) => (
              <option key={tm.id} value={tm.id}>{tm.name}</option>
            ))}
          </select>
        )}
        <button onClick={invite} style={primaryBtn(false)}>
          {t("邀请并通过", "Invite + approve")}
        </button>
      </div>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {err}
        </div>
      )}
      {info && (
        <div style={{ color: "#166534", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {info}
        </div>
      )}
      <LeagueMemberApprovalList
        leagueId={leagueId}
        teams={teams}
        members={members}
        onChanged={onChanged}
      />
    </div>
  );
}

// ─────────── Shared visuals ───────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "#475569", fontWeight: 700, letterSpacing: "0.04em" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  };
}

function smallBtn(bg: string): React.CSSProperties {
  return {
    minHeight: 28,
    padding: "0 10px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}

function primaryBtn(busy: boolean): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 18px",
    background: busy ? "#94a3b8" : "#1e3a8a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 800,
    cursor: busy ? "default" : "pointer",
  };
}

function listStyle(): React.CSSProperties {
  return {
    listStyle: "none",
    padding: 0,
    margin: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  };
}

function rowStyle(): React.CSSProperties {
  return {
    background: "#fff",
    border: "1px solid #e2e8f0",
    borderRadius: 10,
    padding: "10px 14px",
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  };
}

function Empty({ text }: { text: string }) {
  return <div style={{ color: "#94a3b8", fontSize: 14, padding: "12px 0" }}>{text}</div>;
}
