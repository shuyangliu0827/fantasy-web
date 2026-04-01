"use client";

import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import PlayerAvatar from "@/components/PlayerAvatar";
import { getPlayers, getWatchlist, Player } from "@/lib/store";
import { calcFantasyPoints, ESPN_DEFAULT_WEIGHTS } from "@/lib/scoring-config";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const ROUND_COLS = [
  { label: "第1-3轮 必选", labelEn: "Rounds 1-3 · Must-Have", from: 1, to: 5, color: "#1e3a8a", textColor: "#fff" },
  { label: "第4-6轮 高价值", labelEn: "Rounds 4-6 · High Value", from: 6, to: 10, color: "#f59e0b", textColor: "#000" },
  { label: "第7-9轮 潜力股", labelEn: "Rounds 7-9 · Upside", from: 11, to: 15, color: "#374151", textColor: "#fff" },
  { label: "第10-11轮 稳健", labelEn: "Rounds 10-11 · Solid", from: 16, to: 20, color: "#9ca3af", textColor: "#fff" },
  { label: "第12-13轮 捡漏", labelEn: "Rounds 12-13 · Sleeper", from: 21, to: 25, color: "#166534", textColor: "#fff" },
];

const POS_COLS = [
  { pos: "PG", color: "#1e3a8a", textColor: "#fff" },
  { pos: "SG", color: "#2563eb", textColor: "#fff" },
  { pos: "SF", color: "#10b981", textColor: "#fff" },
  { pos: "PF", color: "#f59e0b", textColor: "#000" },
  { pos: "C",  color: "#166534", textColor: "#fff" },
];

function calcFpts(p: Player): number {
  return calcFantasyPoints(
    { pts: p.ppg, reb: p.rpg, ast: p.apg, stl: p.spg, blk: p.bpg, tov: p.tov,
      fgm: 0, fga: 0, fg3m: 0, ftm: 0, fta: 0 },
    ESPN_DEFAULT_WEIGHTS
  );
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(" ");
  if (parts.length < 2) return fullName;
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

export default function CheatSheetPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"overall" | "positions">("overall");

  useEffect(() => {
    setPlayers(getPlayers());
    const wl = getWatchlist();
    setWatchlist(wl.map(w => w.playerId));
    const savedDrafted = localStorage.getItem("bp_cheatsheet_drafted");
    if (savedDrafted) setDrafted(JSON.parse(savedDrafted));
  }, []);

  const toggleDrafted = (playerId: string) => {
    const newDrafted = drafted.includes(playerId)
      ? drafted.filter(id => id !== playerId)
      : [...drafted, playerId];
    setDrafted(newDrafted);
    localStorage.setItem("bp_cheatsheet_drafted", JSON.stringify(newDrafted));
  };

  const clearDrafted = () => {
    setDrafted([]);
    localStorage.removeItem("bp_cheatsheet_drafted");
  };

  const playersByPosition = players.reduce((acc, p) => {
    const mainPos = p.position.split("/")[0];
    if (!acc[mainPos]) acc[mainPos] = [];
    acc[mainPos].push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  function PlayerRow({ p, accentColor, last }: { p: Player; accentColor: string; last: boolean }) {
    const isDrafted = drafted.includes(p.id);
    const isWatchlist = watchlist.includes(p.id);
    const fpts = calcFpts(p);
    return (
      <div
        onClick={() => toggleDrafted(p.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "9px 14px",
          borderBottom: last ? "none" : "1px solid #f3f4f6",
          borderLeft: `3px solid ${isWatchlist ? accentColor : "transparent"}`,
          cursor: "pointer",
          background: isDrafted ? "#f9fafb" : "#fff",
          opacity: isDrafted ? 0.4 : 1,
          transition: "background 0.1s",
        }}
        onMouseEnter={e => { if (!isDrafted) e.currentTarget.style.background = "#f8fafc"; }}
        onMouseLeave={e => { e.currentTarget.style.background = isDrafted ? "#f9fafb" : "#fff"; }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: accentColor, minWidth: 18, textAlign: "right", flexShrink: 0 }}>
          {p.rank}
        </span>
        <PlayerAvatar name={p.name} size={24} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 13, fontWeight: 600,
            color: isDrafted ? "#9ca3af" : "#111827",
            textDecoration: isDrafted ? "line-through" : "none",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {shortName(p.name)}
          </div>
          <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1, letterSpacing: "0.2px" }}>
            {p.team} · {p.position}
          </div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#1e3a8a", flexShrink: 0 }}>
          {fpts.toFixed(1)}
        </span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: FONT }}>
      <LightHeader activeHref="/cheat-sheet" />

      <main style={{ maxWidth: 1300, margin: "0 auto", padding: "32px 24px" }}>
        {/* Page Header Row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: "#111827", margin: "0 0 4px 0" }}>
              {t("选秀备忘单", "Draft Cheat Sheet")}
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              {t("实时选秀助手，点击球员名字标记为已被选走", "Live draft assistant. Click player to mark as drafted")}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {/* View toggle */}
            <div style={{ display: "flex", border: "1.5px solid #d1d5db", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
              <button
                onClick={() => setViewMode("positions")}
                style={{
                  padding: "9px 16px", border: "none",
                  background: viewMode === "positions" ? "#f3f4f6" : "#fff",
                  color: viewMode === "positions" ? "#1e3a8a" : "#6b7280",
                  fontSize: 13, fontWeight: viewMode === "positions" ? 700 : 500,
                  cursor: "pointer", fontFamily: FONT,
                  borderRight: "1px solid #d1d5db",
                }}
              >
                {t("按位置", "By Position")}
              </button>
              <button
                onClick={() => setViewMode("overall")}
                style={{
                  padding: "9px 16px", border: "none",
                  background: viewMode === "overall" ? "#1e3a8a" : "#fff",
                  color: viewMode === "overall" ? "#fff" : "#6b7280",
                  fontSize: 13, fontWeight: viewMode === "overall" ? 700 : 500,
                  cursor: "pointer", fontFamily: FONT,
                }}
              >
                {t("按综合分", "By Overall")}
              </button>
            </div>

            {/* Drafted count */}
            {drafted.length > 0 && (
              <>
                <span style={{ fontSize: 13, color: "#6b7280", padding: "0 4px" }}>
                  {drafted.length} {t("人已被选", "drafted")}
                </span>
                <button
                  onClick={clearDrafted}
                  style={{ padding: "9px 14px", border: "1.5px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, borderRadius: 8, cursor: "pointer", fontFamily: FONT }}
                >
                  {t("清除标记", "Clear")}
                </button>
              </>
            )}

            {/* Export PDF */}
            <button
              onClick={() => window.print()}
              style={{ padding: "9px 16px", border: "none", background: "#f59e0b", color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 8, fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}
            >
               {t("导出PDF", "Export PDF")}
            </button>

            {/* Custom sort */}
            <button
              style={{ padding: "9px 16px", border: "none", background: "#1e3a8a", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", borderRadius: 8, fontFamily: FONT, display: "flex", alignItems: "center", gap: 6 }}
            >
               {t("自定义排序", "Custom Sort")}
            </button>
          </div>
        </div>

        {/* 5-column grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, alignItems: "start" }}>
          {viewMode === "overall"
            ? ROUND_COLS.map((col) => {
                const colPlayers = players.filter(p => p.rank >= col.from && p.rank <= col.to);
                return (
                  <div key={col.label} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                    <div style={{ background: col.color, padding: "11px 14px" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: col.textColor, letterSpacing: "0.2px" }}>
                        {t(col.label, col.labelEn)}
                      </span>
                    </div>
                    {colPlayers.length === 0
                      ? <div style={{ padding: "24px 14px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>{t("暂无数据", "No data")}</div>
                      : colPlayers.map((p, idx) => (
                          <PlayerRow key={p.id} p={p} accentColor={col.color} last={idx === colPlayers.length - 1} />
                        ))
                    }
                  </div>
                );
              })
            : POS_COLS.map(({ pos, color, textColor }) => {
                const posPls = (playersByPosition[pos] || []).slice(0, 15);
                return (
                  <div key={pos} style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 6px rgba(0,0,0,0.07)" }}>
                    <div style={{ background: color, padding: "11px 14px" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: textColor }}>{pos}</span>
                    </div>
                    {posPls.length === 0
                      ? <div style={{ padding: "24px 14px", fontSize: 12, color: "#9ca3af", textAlign: "center" }}>{t("暂无数据", "No data")}</div>
                      : posPls.map((p, idx) => (
                          <PlayerRow key={p.id} p={p} accentColor={color} last={idx === posPls.length - 1} />
                        ))
                    }
                  </div>
                );
              })
          }
        </div>

        {/* Legend */}
        <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 3, height: 14, background: "#1e3a8a", borderRadius: 2 }} />
            <span style={{ fontSize: 12, color: "#6b7280" }}>{t("关注列表", "Watchlist")}</span>
          </div>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>
            {t("点击球员可标记为已被选走", "Click player to mark as drafted")}
          </span>
        </div>
      </main>
    </div>
  );
}
