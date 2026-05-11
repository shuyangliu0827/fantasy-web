"use client";

import { useMemo, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";

type Player = { id: string; display_name: string; team_id: string | null };
type StatRow = {
  player_id: string;
  team_id: string | null;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  fg3m: number;
  ftm: number;
  fta: number;
  fantasy_points?: number | null;
};

type Props = {
  gameId: string;
  players: Player[];
  initialStats?: StatRow[];
  onSaved?: (stats: StatRow[]) => void;
};

const COLS: Array<{ key: keyof StatRow; label: string }> = [
  { key: "min", label: "MIN" },
  { key: "pts", label: "PTS" },
  { key: "reb", label: "REB" },
  { key: "ast", label: "AST" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TOV" },
  { key: "fgm", label: "FGM" },
  { key: "fga", label: "FGA" },
  { key: "fg3m", label: "3PM" },
  { key: "ftm", label: "FTM" },
  { key: "fta", label: "FTA" },
];

function blankRow(p: Player): StatRow {
  return {
    player_id: p.id,
    team_id: p.team_id,
    min: 0,
    pts: 0,
    reb: 0,
    ast: 0,
    stl: 0,
    blk: 0,
    tov: 0,
    fgm: 0,
    fga: 0,
    fg3m: 0,
    ftm: 0,
    fta: 0,
  };
}

export default function BoxScoreInputTable({
  gameId,
  players,
  initialStats,
  onSaved,
}: Props) {
  const { t } = useLang();
  const initialMap = useMemo(() => {
    const m = new Map<string, StatRow>();
    (initialStats ?? []).forEach((s) => m.set(s.player_id, s));
    return m;
  }, [initialStats]);

  const [rows, setRows] = useState<StatRow[]>(
    players.map((p) => initialMap.get(p.id) ?? blankRow(p)),
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  const updateCell = (idx: number, key: keyof StatRow, value: string) => {
    setRows((prev) => {
      const next = [...prev];
      const num = value === "" ? 0 : Number(value);
      next[idx] = { ...next[idx], [key]: Number.isFinite(num) ? num : 0 };
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    setMsg(null);
    const res = await basketballFetch(
      `/api/basketball-games/${gameId}/box-score`,
      { method: "POST", body: JSON.stringify({ stats: rows }) },
    );
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: body.error ?? `HTTP ${res.status}` });
      return;
    }
    setMsg({ kind: "ok", text: t("已保存", "Saved") });
    const saved = (body.stats ?? []) as StatRow[];
    setRows((prev) =>
      prev.map((r) => saved.find((s) => s.player_id === r.player_id) ?? r),
    );
    onSaved?.(saved);
  };

  return (
    <div>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            minWidth: 760,
          }}
        >
          <thead>
            <tr style={{ background: "#f8fafc", textAlign: "left" }}>
              <th style={th()}>{t("球员", "Player")}</th>
              {COLS.map((c) => (
                <th key={c.key} style={{ ...th(), textAlign: "center" }}>
                  {c.label}
                </th>
              ))}
              <th style={{ ...th(), textAlign: "center" }}>FPTS</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p, idx) => (
              <tr key={p.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={td()}>
                  <div style={{ fontWeight: 700, color: "#0f172a" }}>{p.display_name}</div>
                </td>
                {COLS.map((c) => (
                  <td key={c.key} style={{ ...td(), textAlign: "center" }}>
                    <input
                      type="number"
                      step="any"
                      value={(rows[idx][c.key] as number) ?? 0}
                      onChange={(e) => updateCell(idx, c.key, e.target.value)}
                      style={{
                        width: 64,
                        height: 32,
                        textAlign: "center",
                        border: "1px solid #cbd5e1",
                        borderRadius: 6,
                        fontSize: 13,
                      }}
                    />
                  </td>
                ))}
                <td style={{ ...td(), textAlign: "center", fontWeight: 800, color: "#1e3a8a" }}>
                  {rows[idx].fantasy_points != null
                    ? Number(rows[idx].fantasy_points).toFixed(1)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 14, alignItems: "center" }}>
        <button
          onClick={save}
          disabled={busy}
          style={{
            minHeight: 40,
            padding: "0 20px",
            background: busy ? "#94a3b8" : "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? t("保存中…", "Saving…") : t("保存比赛数据", "Save box score")}
        </button>
        {msg && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: msg.kind === "err" ? "#991b1b" : "#166534",
            }}
          >
            {msg.text}
          </span>
        )}
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
  };
}

function td(): React.CSSProperties {
  return { padding: "10px 12px", color: "#0f172a" };
}
