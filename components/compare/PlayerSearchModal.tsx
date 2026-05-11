"use client";
// components/compare/PlayerSearchModal.tsx
// Player search modal for selecting players to compare.

import { useState } from "react";
import PlayerAvatar from "@/components/PlayerAvatar";
import { useLang } from "@/lib/lang";
import { translateTeam } from "@/lib/shared/i18n";
import { FONT, COLORS } from "./constants";

export interface PlayerSummary {
  id: string;       // BDL numeric player_id as string
  name: string;
  team: string;
  position: string;
  fptsAvg: number;
}

interface PlayerSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (id: string, name: string) => void;
  excludeIds: string[];
  allPlayers: PlayerSummary[];
}

export default function PlayerSearchModal({ isOpen, onClose, onSelect, excludeIds, allPlayers }: PlayerSearchModalProps) {
  const { t, lang } = useLang();
  const [query, setQuery] = useState("");

  if (!isOpen) return null;

  const filtered = allPlayers
    .filter(p => !excludeIds.includes(p.id))
    .filter(p =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.team.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 15);

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: COLORS.card, borderRadius: 16, padding: 24, width: "90%", maxWidth: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 8px 32px rgba(0,0,0,0.14)", fontFamily: FONT }}
        onClick={e => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 16px 0", fontSize: 18, fontWeight: 700, color: COLORS.textPrimary }}>
          {t("搜索球员", "Search Player")}
        </h3>
        <input
          type="text"
          autoFocus
          style={{ width: "100%", background: COLORS.bg, border: `1.5px solid ${COLORS.border}`, borderRadius: 8, padding: "11px 14px", color: COLORS.textPrimary, fontSize: 15, marginBottom: 14, outline: "none", fontFamily: FONT, boxSizing: "border-box" }}
          placeholder={t("输入球员名字或球队...", "Player name or team...")}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div style={{ flex: 1, overflowY: "auto", marginBottom: 14 }}>
          {filtered.length === 0 && (
            <div style={{ textAlign: "center", padding: 32, color: COLORS.textMuted, fontSize: 14 }}>
              {t("未找到球员", "No players found")}
            </div>
          )}
          {filtered.map(player => (
            <div
              key={player.id}
              onClick={() => { onSelect(player.id, player.name); setQuery(""); onClose(); }}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 10px", borderRadius: 8, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = COLORS.bg)}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <PlayerAvatar name={player.name} size={40} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: COLORS.textPrimary, fontSize: 14 }}>{player.name}</div>
                <div style={{ fontSize: 12, color: COLORS.textSecondary }}>{translateTeam(player.team, lang)} · {player.position}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, color: COLORS.navy, fontSize: 15 }}>{player.fptsAvg.toFixed(1)}</div>
                <div style={{ fontSize: 10, color: COLORS.textMuted }}>FPTS/G</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", padding: "11px 0", background: COLORS.bg, border: `1px solid ${COLORS.border}`, borderRadius: 8, color: COLORS.textSecondary, cursor: "pointer", fontWeight: 600, fontSize: 14, fontFamily: FONT }}
        >
          {t("取消", "Cancel")}
        </button>
      </div>
    </div>
  );
}
