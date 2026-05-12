"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballJson, basketballFetch } from "@/lib/basketball/client";
import type { StatEventType } from "@/lib/basketball/events";

type Player = { id: string; display_name: string; team_id: string | null };

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

type StatEvent = {
  id: string;
  player_id: string;
  event_type: StatEventType;
  created_at: string;
};

type Props = {
  gameId: string;
  players: Player[];
};

const EVENT_BUTTONS: Array<{
  type: StatEventType;
  label: string;
  variant: "made" | "miss" | "neutral";
}> = [
  { type: "two_pt_made", label: "+2", variant: "made" },
  { type: "two_pt_missed", label: "2 miss", variant: "miss" },
  { type: "three_pt_made", label: "+3", variant: "made" },
  { type: "three_pt_missed", label: "3 miss", variant: "miss" },
  { type: "ft_made", label: "FT+", variant: "made" },
  { type: "ft_missed", label: "FT−", variant: "miss" },
  { type: "reb", label: "REB", variant: "neutral" },
  { type: "ast", label: "AST", variant: "neutral" },
  { type: "stl", label: "STL", variant: "neutral" },
  { type: "blk", label: "BLK", variant: "neutral" },
  { type: "tov", label: "TOV", variant: "miss" },
];

const EVENT_LABEL_ZH: Record<StatEventType, string> = {
  two_pt_made: "2分中",
  two_pt_missed: "2分不中",
  three_pt_made: "3分中",
  three_pt_missed: "3分不中",
  ft_made: "罚球中",
  ft_missed: "罚球不中",
  reb: "篮板",
  ast: "助攻",
  stl: "抢断",
  blk: "盖帽",
  tov: "失误",
};

export default function StatEventInput({ gameId, players }: Props) {
  const { t, lang } = useLang();
  const [stats, setStats] = useState<Record<string, StatRow>>({});
  const [eventsByPlayer, setEventsByPlayer] = useState<Record<string, StatEvent[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [boxRes, evRes] = await Promise.all([
      basketballJson<{ stats: StatRow[] }>(
        `/api/basketball-games/${gameId}/box-score`,
      ),
      basketballJson<{ events: StatEvent[] }>(
        `/api/basketball-games/${gameId}/events`,
      ),
    ]);
    if (boxRes.data) {
      const map: Record<string, StatRow> = {};
      boxRes.data.stats.forEach((r) => (map[r.player_id] = r));
      setStats(map);
    }
    if (evRes.data) {
      const grouped: Record<string, StatEvent[]> = {};
      evRes.data.events.forEach((e) => {
        if (!grouped[e.player_id]) grouped[e.player_id] = [];
        grouped[e.player_id].push(e);
      });
      setEventsByPlayer(grouped);
    }
    setLoading(false);
  }, [gameId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addEvent = async (player: Player, type: StatEventType) => {
    setBusy(`${player.id}:${type}`);
    setErr(null);
    const res = await basketballFetch(`/api/basketball-games/${gameId}/events`, {
      method: "POST",
      body: JSON.stringify({
        player_id: player.id,
        event_type: type,
        team_id: player.team_id,
      }),
    });
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(`${body.error ?? `HTTP ${res.status}`}${body.hint ? ` (${body.hint})` : ""}`);
      return;
    }
    if (body.stats) {
      setStats((prev) => ({ ...prev, [player.id]: body.stats as StatRow }));
    }
    setEventsByPlayer((prev) => ({
      ...prev,
      [player.id]: [body.event as StatEvent, ...(prev[player.id] ?? [])],
    }));
  };

  const undo = async (player: Player, ev: StatEvent) => {
    setBusy(`undo:${ev.id}`);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-games/${gameId}/events/${ev.id}`,
      { method: "DELETE" },
    );
    setBusy(null);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setEventsByPlayer((prev) => ({
      ...prev,
      [player.id]: (prev[player.id] ?? []).filter((e) => e.id !== ev.id),
    }));
    if (body.stats) {
      setStats((prev) => ({ ...prev, [player.id]: body.stats as StatRow }));
    } else {
      // Aggregate deleted (no events left); zero the row in state.
      setStats((prev) => {
        const copy = { ...prev };
        delete copy[player.id];
        return copy;
      });
    }
  };

  if (loading) {
    return (
      <div style={{ color: "#94a3b8", fontSize: 14, padding: "12px 0" }}>
        {t("加载中…", "Loading…")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
      {players.map((p) => {
        const row = stats[p.id];
        const events = eventsByPlayer[p.id] ?? [];
        return (
          <div
            key={p.id}
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>
                {p.display_name}
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 13, color: "#475569" }}>
                <Stat label="PTS" value={row?.pts ?? 0} />
                <Stat label="FG" value={`${row?.fgm ?? 0}/${row?.fga ?? 0}`} />
                <Stat label="3P" value={`${row?.fg3m ?? 0}/${row?.fg3a ?? 0}`} />
                <Stat label="FT" value={`${row?.ftm ?? 0}/${row?.fta ?? 0}`} />
                <Stat label="REB" value={row?.reb ?? 0} />
                <Stat label="AST" value={row?.ast ?? 0} />
                <Stat label="STL" value={row?.stl ?? 0} />
                <Stat label="BLK" value={row?.blk ?? 0} />
                <Stat label="TOV" value={row?.tov ?? 0} />
                <Stat
                  label="FPTS"
                  value={
                    row?.fantasy_points != null
                      ? Number(row.fantasy_points).toFixed(1)
                      : "0.0"
                  }
                  highlight
                />
              </div>
            </div>
            <div
              style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
            >
              {EVENT_BUTTONS.map((b) => (
                <button
                  key={b.type}
                  onClick={() => addEvent(p, b.type)}
                  disabled={busy !== null}
                  style={eventBtnStyle(b.variant, busy === `${p.id}:${b.type}`)}
                >
                  {b.label}
                </button>
              ))}
            </div>
            {events.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid #f1f5f9",
                  paddingTop: 10,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "#94a3b8",
                    fontWeight: 800,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  {t("最近", "Recent")}
                </span>
                {events.slice(0, 5).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => undo(p, ev)}
                    disabled={busy !== null}
                    style={{
                      padding: "4px 8px",
                      background: "#f1f5f9",
                      border: "1px solid #cbd5e1",
                      borderRadius: 8,
                      fontSize: 12,
                      color: "#475569",
                      cursor: "pointer",
                      fontWeight: 700,
                    }}
                    title={t("点击撤销", "Click to undo")}
                  >
                    {lang === "zh" ? EVENT_LABEL_ZH[ev.event_type] : ev.event_type}{" "}
                    ✕
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Stat({
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
      <div
        style={{
          fontSize: 10,
          color: "#94a3b8",
          fontWeight: 800,
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 900,
          color: highlight ? "#1e3a8a" : "#0f172a",
        }}
      >
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
    minHeight: 38,
    minWidth: 64,
    padding: "0 14px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 800,
    cursor: active ? "default" : "pointer",
  };
}
