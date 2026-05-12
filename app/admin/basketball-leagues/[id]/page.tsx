"use client";

import { use, useCallback, useEffect, useState } from "react";
import LightHeader from "@/components/LightHeader";
import AuthGate from "@/components/basketball/AuthGate";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import LeagueMemberApprovalList from "@/components/basketball/LeagueMemberApprovalList";
import PlayerClaimApprovalList from "@/components/basketball/PlayerClaimApprovalList";
import StatEventInput from "@/components/basketball/StatEventInput";
import AdminBoxScoreOverride from "@/components/basketball/AdminBoxScoreOverride";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "public" | "invite_only" | "private";
  status: string;
};

type Access = {
  canManageLeague: boolean;
  canManageTeamsPlayersGames: boolean;
  canInputStats: boolean;
  leagueAdminRole: "league_owner" | "league_admin" | null;
  isPlatformAdmin: boolean;
};

type Team = { id: string; name: string; abbreviation: string | null; city: string | null };
type Player = {
  id: string;
  display_name: string;
  position: string | null;
  team_id: string | null;
  claimed_by_user_id: string | null;
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
};
type Game = {
  id: string;
  scheduled_at: string | null;
  status: string;
  home_team_id: string | null;
  away_team_id: string | null;
};
type Member = {
  user_id: string;
  role: "stat_keeper" | "player" | "viewer";
  status: "pending" | "approved" | "rejected" | "removed";
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
    setLoading(false);

    if (data.access.canManageTeamsPlayersGames) {
      const [tRes, pRes, gRes, mRes] = await Promise.all([
        basketballJson<{ teams: Team[] }>(`/api/basketball-leagues/${id}/teams`),
        basketballJson<{ players: Player[] }>(`/api/basketball-leagues/${id}/players`),
        basketballJson<{ games: Game[] }>(`/api/basketball-leagues/${id}/games`),
        basketballJson<typeof members>(`/api/basketball-leagues/${id}/members`),
      ]);
      setTeams(tRes.data?.teams ?? []);
      setPlayers(pRes.data?.players ?? []);
      setGames(gRes.data?.games ?? []);
      if (mRes.data) setMembers(mRes.data);
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

  if (!access.canManageLeague) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("仅联赛管理员可访问。", "League admins only.")}
        </main>
      </>
    );
  }

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
          <LeagueVisibilityBadge visibility={league.visibility} />
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{league.status}</span>
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

        {tab === "settings" && <SettingsTab league={league} onSaved={refresh} />}
        {tab === "teams" && <TeamsTab leagueId={id} teams={teams} onChanged={refresh} />}
        {tab === "players" && (
          <PlayersTab leagueId={id} teams={teams} players={players} onChanged={refresh} />
        )}
        {tab === "games" && (
          <GamesTab leagueId={id} teams={teams} games={games} onChanged={refresh} />
        )}
        {tab === "boxscore" && (
          <BoxScoreTab
            games={games}
            teams={teams}
            players={players}
            canOverride={
              access.isPlatformAdmin || access.leagueAdminRole !== null
            }
          />
        )}
        {tab === "members" && (
          <MembersTab
            leagueId={id}
            members={[...members.pending, ...members.members]}
            onChanged={refresh}
          />
        )}
        {tab === "claims" && <PlayerClaimApprovalList players={players} onChanged={refresh} />}
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
      {msg && <div style={{ fontSize: 13, color: "#475569", fontWeight: 700 }}>{msg}</div>}
    </div>
  );
}

// ─────────── Teams tab ───────────

function TeamsTab({
  leagueId,
  teams,
  onChanged,
}: {
  leagueId: string;
  teams: Team[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [abbr, setAbbr] = useState("");
  const [city, setCity] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setErr(null);
    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/teams`, {
      method: "POST",
      body: JSON.stringify({
        name: name.trim(),
        abbreviation: abbr || undefined,
        city: city || undefined,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setName("");
    setAbbr("");
    setCity("");
    onChanged();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
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
        <button onClick={add} style={primaryBtn(false)}>
          {t("添加", "Add")}
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
              <span style={{ fontWeight: 800 }}>{tm.name}</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {[tm.city, tm.abbreviation].filter(Boolean).join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Players tab ───────────

function PlayersTab({
  leagueId,
  teams,
  players,
  onChanged,
}: {
  leagueId: string;
  teams: Team[];
  players: Player[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    if (!name.trim()) return;
    setErr(null);
    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/players`, {
      method: "POST",
      body: JSON.stringify({
        display_name: name.trim(),
        position: position || undefined,
        team_id: teamId || null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setName("");
    setPosition("");
    setTeamId("");
    onChanged();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("球员名", "Display name")}
          style={{ ...inputStyle(), flex: "2 1 200px" }}
        />
        <input
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="POS"
          style={{ ...inputStyle(), flex: "1 1 80px" }}
        />
        <select
          value={teamId}
          onChange={(e) => setTeamId(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 160px" }}
        >
          <option value="">{t("无球队", "No team")}</option>
          {teams.map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
        <button onClick={add} style={primaryBtn(false)}>
          {t("添加", "Add")}
        </button>
      </div>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {err}
        </div>
      )}
      {players.length === 0 ? (
        <Empty text={t("尚无球员", "No players yet")} />
      ) : (
        <ul style={listStyle()}>
          {players.map((p) => (
            <li key={p.id} style={rowStyle()}>
              <span style={{ fontWeight: 800 }}>{p.display_name}</span>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {[p.position, teams.find((tm) => tm.id === p.team_id)?.name]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>
                {p.claim_status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Games tab ───────────

function GamesTab({
  leagueId,
  teams,
  games,
  onChanged,
}: {
  leagueId: string;
  teams: Team[];
  games: Game[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [home, setHome] = useState<string>("");
  const [away, setAway] = useState<string>("");
  const [when, setWhen] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const add = async () => {
    setErr(null);
    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/games`, {
      method: "POST",
      body: JSON.stringify({
        home_team_id: home || null,
        away_team_id: away || null,
        scheduled_at: when ? new Date(when).toISOString() : null,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setHome("");
    setAway("");
    setWhen("");
    onChanged();
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
        <button onClick={add} style={primaryBtn(false)}>
          {t("添加比赛", "Add game")}
        </button>
      </div>
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
              <span style={{ fontWeight: 800 }}>
                {teamName(g.away_team_id)} @ {teamName(g.home_team_id)}
              </span>
              <span style={{ color: "#64748b", fontSize: 12 }}>
                {g.scheduled_at ? new Date(g.scheduled_at).toLocaleString() : t("时间待定", "TBD")}
              </span>
              <span style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700 }}>{g.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Box-score tab ───────────

function BoxScoreTab({
  games,
  teams,
  players,
  canOverride,
}: {
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

  return (
    <div>
      <div style={{ marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          style={{ ...inputStyle(), flex: "1 1 280px" }}
        >
          <option value="">{t("选择比赛", "Select game")}</option>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {teamName(g.away_team_id)} @ {teamName(g.home_team_id)} ·{" "}
              {g.scheduled_at ? new Date(g.scheduled_at).toLocaleDateString() : "TBD"}
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
          <StatEventInput
            key={`events-${game.id}`}
            gameId={game.id}
            players={gamePlayers.map((p) => ({
              id: p.id,
              display_name: p.display_name,
              team_id: p.team_id,
            }))}
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

function MembersTab({
  leagueId,
  members,
  onChanged,
}: {
  leagueId: string;
  members: Member[];
  onChanged: () => void;
}) {
  const { t } = useLang();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<Member["role"]>("viewer");
  const [err, setErr] = useState<string | null>(null);

  const invite = async () => {
    if (!userId.trim()) return;
    setErr(null);
    const res = await basketballFetch(`/api/basketball-leagues/${leagueId}/members`, {
      method: "POST",
      body: JSON.stringify({
        user_id: userId.trim(),
        role,
        status: "approved",
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setUserId("");
    onChanged();
  };

  return (
    <div>
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
          onChange={(e) => setRole(e.target.value as Member["role"])}
          style={{ ...inputStyle(), flex: "0 0 140px" }}
        >
          <option value="viewer">viewer</option>
          <option value="stat_keeper">stat_keeper</option>
          <option value="player">player</option>
        </select>
        <button onClick={invite} style={primaryBtn(false)}>
          {t("邀请并通过", "Invite + approve")}
        </button>
      </div>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          {err}
        </div>
      )}
      <LeagueMemberApprovalList leagueId={leagueId} members={members} onChanged={onChanged} />
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
