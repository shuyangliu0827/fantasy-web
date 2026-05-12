"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import BoxScoreInputTable from "./BoxScoreInputTable";

type Player = { id: string; display_name: string; team_id: string | null };

type Props = {
  gameId: string;
  players: Player[];
};

/**
 * Wraps the legacy direct-numeric box-score grid as a collapsible "admin
 * override" block. Used by league admins / platform admins only — stat
 * keepers see only the event-based input above.
 *
 * The numeric grid bypasses the event log: it writes directly into
 * basketball_player_game_stats. Useful for one-shot data correction; not
 * for routine stat-keeping.
 */
export default function AdminBoxScoreOverride({ gameId, players }: Props) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        marginTop: 18,
        border: "1px dashed #cbd5e1",
        borderRadius: 12,
        background: "#fafafa",
        padding: 14,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          color: "#475569",
          fontSize: 13,
          fontWeight: 800,
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "▼" : "▶"}{" "}
        {t(
          "管理员手动覆盖（直接编辑总数）",
          "Admin manual override (direct numeric edit)",
        )}
      </button>
      {open && (
        <div style={{ marginTop: 14 }}>
          <div
            style={{
              fontSize: 12,
              color: "#92400e",
              background: "#fef3c7",
              border: "1px solid #fde68a",
              padding: "8px 12px",
              borderRadius: 8,
              marginBottom: 14,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            {t(
              "此处会直接覆盖比赛总数，不会写入事件日志。仅用于纠错。",
              "Direct edits write to the aggregate row only, bypassing the event log. Use for data correction only.",
            )}
          </div>
          <BoxScoreInputTable gameId={gameId} players={players} />
        </div>
      )}
    </div>
  );
}
