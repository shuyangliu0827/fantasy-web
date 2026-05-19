"use client";
// components/basketball/ScorekeepingPanel.tsx
//
// Phase-3 live scorekeeping workspace. Replaces the flat per-player
// StatEventInput surface inside the admin "数据录入" tab.
//
// Responsibilities:
//   - Render a game header (away/home team chips, score, status, lifecycle
//     controls: Start / Finish).
//   - Two-column split: away on the left, home on the right.
//   - Inside each column, group players by On Court (pinned at top) and
//     Bench (below). Each card carries avatar / jersey / position / live
//     stat summary and 11 stat action buttons (+2, 2 miss, +3, 3 miss,
//     FT+, FT−, REB, AST, STL, BLK, TOV).
//   - "Recent Actions" rail at the bottom with per-event undo.
//   - Hooks: POST /events on a button click, DELETE /events/{id} on undo,
//     PATCH /games/{id} for status + on_court_player_ids.
//
// Source of truth:
//   - Box-score state is server-derived. After every write we use the
//     response body's `stats` + `team_scores` if present, falling back to
//     a reload on errors.
//   - Game score on the page is rendered from `game.home_score` /
//     `game.away_score`, which `recomputeTeamScores` keeps in sync with
//     the event log.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import { basketballJson, basketballFetch } from "@/lib/basketball/client";
import type { StatEventType } from "@/lib/basketball/events";
import { eventLabel, statLabel } from "@/lib/basketball/stat-labels";
import { calcFantasyPoints, ESPN_DEFAULT_WEIGHTS } from "@/lib/fantasy/shared/scoring-config";

type Player = {
  id: string;
  display_name: string;
  team_id: string | null;
  position: string | null;
  jersey_number: string | null;
  avatar_url: string | null;
};

type Team = {
  id: string;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
};

type Game = {
  id: string;
  basketball_league_id: string;
  status: "scheduled" | "live" | "final" | "cancelled";
  scheduled_at: string | null;
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  on_court_player_ids: string[] | null;
};

type StatRow = {
  player_id: string;
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
const ZERO_STAT_ROW = (playerId: string): StatRow => ({
  player_id: playerId,
  pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
  fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0,
  fantasy_points: 0,
});

type StatEvent = {
  id: string;
  player_id: string;
  event_type: StatEventType;
  team_id: string | null;
  created_at: string;
};

type Props = {
  leagueSlug: string;
  game: Game;
  teams: Team[];
  players: Player[];
  canStart: boolean; // gated by stats permission upstream
};

// Wire button order and visual variant only; labels come from
// lib/basketball/stat-labels.ts so Chinese/English mode share one source.
const EVENT_BUTTONS: Array<{
  type: StatEventType;
  variant: "made" | "miss" | "neutral";
}> = [
  { type: "two_pt_made", variant: "made" },
  { type: "two_pt_missed", variant: "miss" },
  { type: "three_pt_made", variant: "made" },
  { type: "three_pt_missed", variant: "miss" },
  { type: "ft_made", variant: "made" },
  { type: "ft_missed", variant: "miss" },
  { type: "reb", variant: "neutral" },
  { type: "ast", variant: "neutral" },
  { type: "stl", variant: "neutral" },
  { type: "blk", variant: "neutral" },
  { type: "tov", variant: "miss" },
];

export default function ScorekeepingPanel({
  leagueSlug,
  game: initialGame,
  teams,
  players,
  canStart,
}: Props) {
  const { t, lang } = useLang();
  const [game, setGame] = useState<Game>(initialGame);
  const [confirmedStats, setConfirmedStats] = useState<Record<string, StatRow>>({});
  const [events, setEvents] = useState<StatEvent[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const homeTeam = teams.find((tm) => tm.id === game.home_team_id) ?? null;
  const awayTeam = teams.find((tm) => tm.id === game.away_team_id) ?? null;
  const onCourtSet = new Set(game.on_court_player_ids ?? []);
  const isFinished = game.status === "final";
  const queueRef = useRef<Array<{ player: Player; type: StatEventType; clientSeq: number }>>([]);
  const drainingRef = useRef(false);
  const nextSeqRef = useRef(1);
  const [pendingEvents, setPendingEvents] = useState<Array<{ player: Player; type: StatEventType; clientSeq: number }>>([]);

  const reload = useCallback(async () => {
    setLoading(true);
    const [boxRes, evRes] = await Promise.all([
      basketballJson<{ stats: StatRow[] }>(
        `/api/basketball-games/${game.id}/box-score`,
      ),
      basketballJson<{ events: StatEvent[] }>(
        `/api/basketball-games/${game.id}/events`,
      ),
    ]);
    if (boxRes.data) {
      const map: Record<string, StatRow> = {};
      boxRes.data.stats.forEach((r) => (map[r.player_id] = r));
      setConfirmedStats(map);
    }
    if (evRes.data) setEvents(evRes.data.events);
    setLoading(false);
  }, [game.id]);

  useEffect(() => {
    setGame(initialGame);
  }, [initialGame]);

  useEffect(() => {
    reload();
  }, [reload]);

  // --- mutation helpers ------------------------------------------------

  const applyEventResponse = (
    body: { event?: StatEvent; stats?: StatRow | null; team_scores?: { home_score: number; away_score: number } | null },
    fallbackPlayerId?: string,
  ) => {
    if (body.event) setEvents((prev) => [body.event!, ...prev]);
    if (body.stats) {
      setConfirmedStats((prev) => ({ ...prev, [body.stats!.player_id]: body.stats! }));
    } else if (fallbackPlayerId) {
      setConfirmedStats((prev) => {
        const copy = { ...prev };
        delete copy[fallbackPlayerId];
        return copy;
      });
    }
    if (body.team_scores) {
      setGame((prev) => ({
        ...prev,
        home_score: body.team_scores!.home_score,
        away_score: body.team_scores!.away_score,
      }));
    }
  };

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      const res = await basketballFetch(`/api/basketball-games/${game.id}/events`, {
        method: "POST",
        body: JSON.stringify({
          player_id: item.player.id,
          event_type: item.type,
          team_id: item.player.team_id,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFailedCount((v) => v + 1);
        setErr(t("某次数据同步失败，已尝试重新校准，请检查网络或刷新页面确认。", "A stat sync failed and we attempted to re-sync. Please check network or refresh."));
        setPendingEvents((prev) => prev.filter((p) => p.clientSeq !== item.clientSeq));
        void reload();
      } else {
        applyEventResponse(body);
        setPendingEvents((prev) => prev.filter((p) => p.clientSeq !== item.clientSeq));
      }
      queueRef.current.shift();
      setPendingCount(queueRef.current.length);
    }
    drainingRef.current = false;
  }, [game.id, t]);

  const addEvent = (player: Player, type: StatEventType) => {
    if (isFinished) {
      setErr(
        t(
          "比赛已结束。如需修改请先重新开放比赛。",
          "Game is finished. Reopen the game to edit stats.",
        ),
      );
      return;
    }
    const start = performance.now();
    setErr(null);
    const clientSeq = nextSeqRef.current++;
    const pending = { player, type, clientSeq };
    setPendingEvents((prev) => [...prev, pending]);
    queueRef.current.push(pending);
    setPendingCount(queueRef.current.length);
    void drainQueue();
    console.info("[perf] scorekeeping:addEvent", { type, playerId: player.id, ms: Math.round(performance.now() - start) });
  };
  const display = useMemo(() => {
    const statMap: Record<string, StatRow> = { ...confirmedStats };
    let home = game.home_score ?? 0;
    let away = game.away_score ?? 0;
    for (const p of pendingEvents) {
      const cur = statMap[p.player.id] ?? null;
      statMap[p.player.id] = applyOptimisticEvent(cur, p.player.id, p.type);
      if (p.type === "two_pt_made" || p.type === "three_pt_made" || p.type === "ft_made") {
        const delta = p.type === "two_pt_made" ? 2 : p.type === "three_pt_made" ? 3 : 1;
        if (p.player.team_id && p.player.team_id === game.home_team_id) home += delta;
        if (p.player.team_id && p.player.team_id === game.away_team_id) away += delta;
      }
    }
    return { stats: statMap, home, away };
  }, [confirmedStats, pendingEvents, game.home_score, game.away_score, game.home_team_id, game.away_team_id]);

  const undoEvent = async (ev: StatEvent) => {
    setBusy(`undo:${ev.id}`);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-games/${game.id}/events/${ev.id}`,
      { method: "DELETE" },
    );
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
    if (body.stats) {
      setConfirmedStats((prev) => ({ ...prev, [body.stats.player_id]: body.stats }));
    } else {
      setConfirmedStats((prev) => {
        const copy = { ...prev };
        delete copy[ev.player_id];
        return copy;
      });
    }
    if (body.team_scores) {
      setGame((prev) => ({
        ...prev,
        home_score: body.team_scores.home_score,
        away_score: body.team_scores.away_score,
      }));
    }
  };

  const patchGame = async (
    payload: { status?: Game["status"]; on_court_player_ids?: string[] },
  ) => {
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-leagues/${game.basketball_league_id}/games/${game.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(body.error ?? `HTTP ${res.status}`);
      return false;
    }
    if (body.game) setGame(body.game as Game);
    return true;
  };

  const toggleOnCourt = async (player: Player) => {
    const next = new Set(onCourtSet);
    if (next.has(player.id)) next.delete(player.id);
    else next.add(player.id);
    setBusy(`oncourt:${player.id}`);
    await patchGame({ on_court_player_ids: Array.from(next) });
    setBusy(null);
  };

  const startGame = () => patchGame({ status: "live" });
  const finishGame = () => patchGame({ status: "final" });
  const reopenGame = () => patchGame({ status: "live" });

  // --- render ----------------------------------------------------------

  const renderTeamColumn = (team: Team | null, side: "away" | "home") => {
    const sideLabel = side === "away" ? t("客队", "Away") : t("主队", "Home");
    const score = side === "away" ? display.away : display.home;
    const roster = players.filter((p) => p.team_id && p.team_id === team?.id);
    const onCourt = roster.filter((p) => onCourtSet.has(p.id));
    const bench = roster.filter((p) => !onCourtSet.has(p.id));

    return (
      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          minWidth: 0,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            borderBottom: "1px solid #f1f5f9",
            paddingBottom: 10,
          }}
        >
          {team?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={team.logo_url}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", background: "#f1f5f9" }}
            />
          ) : (
            <span style={{ width: 36, height: 36, borderRadius: 8, background: "#f1f5f9", flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {sideLabel}
            </div>
            <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 18, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {team ? (
                <Link
                  href={`/basketball-leagues/${leagueSlug}/teams/${team.id}`}
                  style={{ color: "inherit", textDecoration: "none" }}
                >
                  {team.name}
                </Link>
              ) : (
                "—"
              )}
            </div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, marginTop: 2 }}>
              {t(`在场 ${onCourt.length}`, `On court ${onCourt.length}`)}
            </div>
          </div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#1e3a8a", lineHeight: 1 }}>
            {score}
          </div>
        </header>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SubLabel label={t("在场球员", "On Court")} count={onCourt.length} />
          {onCourt.length === 0 ? (
            <EmptyLine text={t("尚无在场球员", "No on-court players")} />
          ) : (
            onCourt.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                stats={display.stats[p.id]}
                onCourt
                disabled={isFinished}
                leagueSlug={leagueSlug}
                onAddEvent={addEvent}
                onToggleOnCourt={toggleOnCourt}
              />
            ))
          )}
          <SubLabel label={t("替补席", "Bench")} count={bench.length} />
          {bench.length === 0 ? (
            <EmptyLine text={t("替补席为空", "Bench empty")} />
          ) : (
            bench.map((p) => (
              <PlayerCard
                key={p.id}
                player={p}
                stats={display.stats[p.id]}
                onCourt={false}
                disabled={isFinished}
                leagueSlug={leagueSlug}
                onAddEvent={addEvent}
                onToggleOnCourt={toggleOnCourt}
              />
            ))
          )}
        </div>
      </section>
    );
  };

  const playerById = (id: string) => players.find((p) => p.id === id) ?? null;
  const recent = events.slice(0, 12);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Game control header */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 16,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <ScoreChip label={t("客队", "Away")} team={awayTeam} score={display.away} />
          <span style={{ fontSize: 22, color: "#94a3b8", fontWeight: 900 }}>—</span>
          <ScoreChip label={t("主队", "Home")} team={homeTeam} score={display.home} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>
              {game.scheduled_at ? new Date(game.scheduled_at).toLocaleString() : t("时间待定", "TBD")}
            </div>
            <StatusBadge status={game.status} />
          </div>
          {canStart && (
            <div style={{ display: "flex", gap: 8 }}>
              {game.status === "scheduled" && (
                <button onClick={startGame} style={primaryBtnStyle()}>
                  {t("开始比赛", "Start Game")}
                </button>
              )}
              {game.status === "live" && (
                <button onClick={finishGame} style={primaryBtnStyle("#0f172a")}>
                  {t("结束比赛", "Finish Game")}
                </button>
              )}
              {game.status === "final" && (
                <button onClick={reopenGame} style={primaryBtnStyle("#475569")}>
                  {t("重新开放", "Reopen")}
                </button>
              )}
              <Link
                href={`/basketball-leagues/${leagueSlug}/games/${game.id}`}
                style={previewLinkStyle()}
              >
                {t("预览公开页 →", "Preview public →")}
              </Link>
            </div>
          )}
        </div>
      </section>

      {err && (
        <div
          style={{
            background: "#fee2e2",
            color: "#991b1b",
            padding: "10px 14px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {err}
        </div>
      )}

      {isFinished && (
        <div
          style={{
            background: "#f1f5f9",
            color: "#475569",
            padding: "10px 14px",
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {t("比赛已结束。如需修改，请使用「重新开放」。", "Game finished. Use \"Reopen\" to edit stats.")}
        </div>
      )}

      {loading ? (
        <div style={{ color: "#94a3b8", fontSize: 14, padding: "12px 0" }}>
          {t("加载中…", "Loading…")}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
            gap: 14,
          }}
        >
          {renderTeamColumn(awayTeam, "away")}
          {renderTeamColumn(homeTeam, "home")}
        </div>
      )}

      {/* Recent actions rail */}
      <section
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 900, color: "#0f172a", letterSpacing: "0.02em" }}>
            {t("最近操作", "Recent Actions")}
            <span style={{ color: "#94a3b8", fontWeight: 700, marginLeft: 8 }}>· {recent.length}</span>
          </h3>
          <div style={{ fontSize: 12, fontWeight: 700, color: failedCount > 0 ? "#b91c1c" : pendingCount > 0 ? "#1e3a8a" : "#065f46" }}>
            {failedCount > 0
              ? t(`同步失败 · ${failedCount}`, `Sync failed · ${failedCount}`)
              : pendingCount > 0
                ? t(`同步中 · ${pendingCount}`, `Syncing · ${pendingCount}`)
                : t("已同步", "Synced")}
          </div>
        </div>
        {recent.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            {t("尚无操作", "No actions yet")}
          </div>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {recent.map((ev) => {
              const p = playerById(ev.player_id);
              const teamLabel =
                p?.team_id === game.away_team_id
                  ? t("客", "A")
                  : p?.team_id === game.home_team_id
                    ? t("主", "H")
                    : "—";
              return (
                <li
                  key={ev.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "8px 10px",
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background: "#eff6ff",
                      color: "#1e3a8a",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {teamLabel}
                  </span>
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    {p ? (p.jersey_number ? `#${p.jersey_number} ${p.display_name}` : p.display_name) : "—"}
                  </span>
                  <span style={{ color: "#475569" }}>
                    · {eventLabel(ev.event_type, lang)}
                  </span>
                  <span style={{ color: "#94a3b8", fontSize: 11, marginLeft: "auto" }}>
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => undoEvent(ev)}
                    disabled={isFinished}
                    style={undoBtnStyle()}
                    title={t("撤销", "Undo")}
                  >
                    {t("撤销", "Undo")} ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function applyOptimisticEvent(current: StatRow | null, playerId: string, type: StatEventType): StatRow {
  const next = { ...(current ?? ZERO_STAT_ROW(playerId)) };
  if (type === "two_pt_made") { next.pts += 2; next.fgm += 1; next.fga += 1; }
  else if (type === "two_pt_missed") { next.fga += 1; }
  else if (type === "three_pt_made") { next.pts += 3; next.fgm += 1; next.fga += 1; next.fg3m += 1; next.fg3a += 1; }
  else if (type === "three_pt_missed") { next.fga += 1; next.fg3a += 1; }
  else if (type === "ft_made") { next.pts += 1; next.ftm += 1; next.fta += 1; }
  else if (type === "ft_missed") { next.fta += 1; }
  else if (type === "reb") { next.reb += 1; }
  else if (type === "ast") { next.ast += 1; }
  else if (type === "stl") { next.stl += 1; }
  else if (type === "blk") { next.blk += 1; }
  else if (type === "tov") { next.tov += 1; }
  next.fantasy_points = calcFantasyPoints(next, ESPN_DEFAULT_WEIGHTS);
  return next;
}

// ─────────────────────── sub-components ────────────────────────────────

function PlayerCard({
  player,
  stats,
  onCourt,
  disabled,
  leagueSlug,
  onAddEvent,
  onToggleOnCourt,
}: {
  player: Player;
  stats: StatRow | undefined;
  onCourt: boolean;
  disabled: boolean;
  leagueSlug: string;
  onAddEvent: (player: Player, type: StatEventType) => void;
  onToggleOnCourt: (player: Player) => void;
}) {
  const { t, lang } = useLang();
  return (
    <div
      style={{
        background: onCourt ? "#fff" : "#f8fafc",
        border: onCourt ? "1px solid #bfdbfe" : "1px solid #e2e8f0",
        borderLeft: onCourt ? "3px solid #1e3a8a" : "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: onCourt ? 1 : 0.92,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        {player.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={player.avatar_url}
            alt=""
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#e2e8f0", flexShrink: 0 }}
          />
        ) : (
          <span style={{ width: 36, height: 36, borderRadius: "50%", background: "#e2e8f0", flexShrink: 0 }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Link
            href={`/basketball-leagues/${leagueSlug}/players/${player.id}`}
            style={{ textDecoration: "none", color: "#0f172a" }}
          >
            <span style={{ fontWeight: 800, fontSize: 14 }}>{player.display_name}</span>
            {player.jersey_number && (
              <span style={{ color: "#1e3a8a", fontWeight: 700, fontSize: 12, marginLeft: 6 }}>#{player.jersey_number}</span>
            )}
          </Link>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginTop: 2 }}>
            {player.position ?? "—"}
            <span style={{ marginLeft: 8 }}>
              {onCourt ? (
                <Badge color="#1e3a8a" bg="#dbeafe">
                  {t("在场", "On Court")}
                </Badge>
              ) : (
                <Badge color="#64748b" bg="#f1f5f9">
                  {t("替补", "Bench")}
                </Badge>
              )}
            </span>
          </div>
        </div>
        <button
          onClick={() => onToggleOnCourt(player)}
          disabled={disabled}
          style={toggleBtnStyle(onCourt)}
        >
          {onCourt ? t("下场", "Bench") : t("上场", "On Court")}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          fontSize: 12,
          color: "#475569",
          flexWrap: "wrap",
          paddingTop: 6,
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <StatChip label={statLabel("pts", lang)} value={stats?.pts ?? 0} />
        <StatChip label={statLabel("fg", lang)} value={`${stats?.fgm ?? 0}/${stats?.fga ?? 0}`} />
        <StatChip label={statLabel("fg3", lang)} value={`${stats?.fg3m ?? 0}/${stats?.fg3a ?? 0}`} />
        <StatChip label={statLabel("ft", lang)} value={`${stats?.ftm ?? 0}/${stats?.fta ?? 0}`} />
        <StatChip label={statLabel("reb", lang)} value={stats?.reb ?? 0} />
        <StatChip label={statLabel("ast", lang)} value={stats?.ast ?? 0} />
        <StatChip label={statLabel("stl", lang)} value={stats?.stl ?? 0} />
        <StatChip label={statLabel("blk", lang)} value={stats?.blk ?? 0} />
        <StatChip label={statLabel("tov", lang)} value={stats?.tov ?? 0} />
        <StatChip
          label={statLabel("fpts", lang)}
          value={stats?.fantasy_points != null ? Number(stats.fantasy_points).toFixed(1) : "0.0"}
          highlight
        />
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {EVENT_BUTTONS.map((b) => (
          <button
            key={b.type}
            onClick={() => onAddEvent(player, b.type)}
            disabled={disabled}
            style={eventBtnStyle(b.variant, false)}
          >
            {eventLabel(b.type, lang)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SubLabel({ label, count }: { label: string; count: number }) {
  return (
    <div
      style={{
        fontSize: 11,
        color: "#64748b",
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {label} <span style={{ color: "#cbd5e1", fontWeight: 700 }}>· {count}</span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div style={{ color: "#94a3b8", fontSize: 13, padding: "6px 4px" }}>{text}</div>
  );
}

function ScoreChip({
  label,
  team,
  score,
}: {
  label: string;
  team: Team | null;
  score: number;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {team?.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={team.logo_url}
          alt=""
          style={{ width: 32, height: 32, borderRadius: 6, objectFit: "cover", background: "#f1f5f9" }}
        />
      ) : (
        <span style={{ width: 32, height: 32, borderRadius: 6, background: "#f1f5f9" }} />
      )}
      <div>
        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {label}
        </div>
        <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
          {team?.name ?? "—"}
        </div>
      </div>
      <div style={{ fontSize: 26, fontWeight: 900, color: "#1e3a8a", lineHeight: 1, marginLeft: 8 }}>
        {score}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Game["status"] }) {
  const { t } = useLang();
  const map: Record<Game["status"], { bg: string; fg: string; label: string }> = {
    scheduled: { bg: "#e0e7ff", fg: "#3730a3", label: t("待开始", "Scheduled") },
    live:      { bg: "#fee2e2", fg: "#991b1b", label: t("进行中", "Live") },
    final:     { bg: "#dcfce7", fg: "#166534", label: t("已结束", "Finished") },
    cancelled: { bg: "#f1f5f9", fg: "#475569", label: t("已取消", "Cancelled") },
  };
  const m = map[status];
  return (
    <span
      style={{
        marginTop: 4,
        padding: "4px 10px",
        background: m.bg,
        color: m.fg,
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        display: "inline-block",
      }}
    >
      {m.label}
    </span>
  );
}

function Badge({ color, bg, children }: { color: string; bg: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: "0.06em",
        padding: "2px 6px",
        borderRadius: 999,
        textTransform: "uppercase",
      }}
    >
      {children}
    </span>
  );
}

function StatChip({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 9, color: "#94a3b8", fontWeight: 800, letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 900, color: highlight ? "#1e3a8a" : "#0f172a" }}>
        {value}
      </div>
    </div>
  );
}

function eventBtnStyle(
  variant: "made" | "miss" | "neutral",
  active: boolean,
): React.CSSProperties {
  const bg = active
    ? "#94a3b8"
    : variant === "made"
      ? "#1e3a8a"
      : variant === "miss"
        ? "#475569"
        : "#0f172a";
  return {
    minHeight: 36,
    minWidth: 60,
    padding: "0 12px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: active ? "default" : "pointer",
  };
}

function toggleBtnStyle(onCourt: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    background: onCourt ? "#fff" : "#1e3a8a",
    color: onCourt ? "#1e3a8a" : "#fff",
    border: "1px solid #1e3a8a",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function primaryBtnStyle(bg = "#1e3a8a"): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: "pointer",
  };
}

function previewLinkStyle(): React.CSSProperties {
  return {
    padding: "8px 14px",
    background: "#fff",
    color: "#1e3a8a",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-block",
  };
}

function undoBtnStyle(): React.CSSProperties {
  return {
    padding: "4px 10px",
    background: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 800,
    cursor: "pointer",
  };
}
