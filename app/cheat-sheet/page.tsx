"use client";

import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { getPlayers, getWatchlist, Player } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

export default function CheatSheetPage() {
  const { t } = useLang();
  const [players, setPlayers] = useState<Player[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [drafted, setDrafted] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"tiers" | "positions">("tiers");

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

  const getTier = (rank: number) => {
    if (rank <= 5) return { tier: 1, label: t("Tier 1 - 精英", "Tier 1 - Elite"), color: "#1e3a8a", textColor: "#fff" };
    if (rank <= 12) return { tier: 2, label: t("Tier 2 - 首轮", "Tier 2 - First Round"), color: "#2563eb", textColor: "#fff" };
    if (rank <= 24) return { tier: 3, label: t("Tier 3 - 次轮", "Tier 3 - Second Round"), color: "#10b981", textColor: "#fff" };
    if (rank <= 50) return { tier: 4, label: t("Tier 4 - 中轮", "Tier 4 - Mid Rounds"), color: "#f59e0b", textColor: "#000" };
    return { tier: 5, label: t("Tier 5 - 后轮", "Tier 5 - Late Rounds"), color: "#64748b", textColor: "#fff" };
  };

  const playersByTier = players.reduce((acc, p) => {
    const { tier } = getTier(p.rank);
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(p);
    return acc;
  }, {} as Record<number, Player[]>);

  const playersByPosition = players.reduce((acc, p) => {
    const mainPos = p.position.split("/")[0];
    if (!acc[mainPos]) acc[mainPos] = [];
    acc[mainPos].push(p);
    return acc;
  }, {} as Record<string, Player[]>);

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/cheat-sheet" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 16px" }}>
        {/* Page Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 8px 0" }}>
            {t("选秀备忘单", "Draft Cheat Sheet")}
          </h1>
          <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
            {t("实时选秀助手，点击球员名字标记为已被选走", "Live draft assistant. Click player names to mark as drafted")}
          </p>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 20px" }}>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setViewMode("tiers")}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid " + (viewMode === "tiers" ? "#1e3a8a" : "#e5e7eb"), background: viewMode === "tiers" ? "#1e3a8a" : "#fff", color: viewMode === "tiers" ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
            >
              {t("按 Tier 分组", "By Tier")}
            </button>
            <button
              onClick={() => setViewMode("positions")}
              style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid " + (viewMode === "positions" ? "#1e3a8a" : "#e5e7eb"), background: viewMode === "positions" ? "#1e3a8a" : "#fff", color: viewMode === "positions" ? "#fff" : "#374151", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}
            >
              {t("按位置分组", "By Position")}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 500 }}>
              {drafted.length} {t("人已被选", "drafted")}
            </span>
            <button
              onClick={clearDrafted}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}
            >
              {t("清除标记", "Clear")}
            </button>
            <button
              onClick={() => window.print()}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", background: "#fff", color: "#374151", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: FONT }}
            >
              {t("打印", "Print")}
            </button>
          </div>
        </div>

        {viewMode === "tiers" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1, 2, 3, 4, 5].map(tier => {
              const tierInfo = getTier(tier === 1 ? 1 : tier === 2 ? 6 : tier === 3 ? 13 : tier === 4 ? 25 : 51);
              const tierPlayers = playersByTier[tier] || [];
              return (
                <div key={tier} style={{ background: "#fff", border: `1.5px solid ${tierInfo.color}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: tierInfo.color, padding: "10px 20px" }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tierInfo.textColor }}>
                      {tierInfo.label}
                    </h3>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    {tierPlayers.map((p, idx) => {
                      const isDrafted = drafted.includes(p.id);
                      const isWatchlist = watchlist.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleDrafted(p.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 12,
                            padding: "10px 20px",
                            background: isDrafted ? "#f3f4f6" : idx % 2 === 0 ? "#fff" : "#fafafa",
                            borderTop: idx > 0 ? "1px solid #f3f4f6" : "none",
                            cursor: "pointer",
                            opacity: isDrafted ? 0.5 : 1,
                            textDecoration: isDrafted ? "line-through" : "none",
                          }}
                        >
                          <span style={{ width: 28, textAlign: "right", fontSize: 13, fontWeight: 700, color: tierInfo.color, flexShrink: 0 }}>
                            {p.rank}
                          </span>
                          <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: "#6b7280", minWidth: 32 }}>{p.position}</span>
                          <span style={{ fontSize: 12, color: "#9ca3af", minWidth: 40 }}>{p.team}</span>
                          {isWatchlist && <span style={{ fontSize: 14, color: "#f59e0b" }}>★</span>}
                        </div>
                      );
                    })}
                    {tierPlayers.length === 0 && (
                      <div style={{ padding: "16px 20px", fontSize: 13, color: "#9ca3af" }}>{t("暂无球员", "No players")}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            {["PG", "SG", "SF", "PF", "C"].map((pos, posIdx) => {
              const posColors = ["#1e3a8a", "#2563eb", "#10b981", "#f59e0b", "#64748b"];
              const posTextColors = ["#fff", "#fff", "#fff", "#000", "#fff"];
              const col = posColors[posIdx];
              const tcol = posTextColors[posIdx];
              return (
                <div key={pos} style={{ background: "#fff", border: `1.5px solid ${col}`, borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ background: col, padding: "10px 16px" }}>
                    <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: tcol }}>{pos}</h3>
                  </div>
                  <div>
                    {(playersByPosition[pos] || []).slice(0, 15).map((p, idx) => {
                      const isDrafted = drafted.includes(p.id);
                      const isWatchlist = watchlist.includes(p.id);
                      return (
                        <div
                          key={p.id}
                          onClick={() => toggleDrafted(p.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "9px 16px",
                            background: isDrafted ? "#f3f4f6" : idx % 2 === 0 ? "#fff" : "#fafafa",
                            borderTop: idx > 0 ? "1px solid #f3f4f6" : "none",
                            cursor: "pointer",
                            opacity: isDrafted ? 0.5 : 1,
                            textDecoration: isDrafted ? "line-through" : "none",
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 700, color: col, width: 22, flexShrink: 0 }}>{p.rank}</span>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "#111827" }}>{p.name}</span>
                          {isWatchlist && <span style={{ fontSize: 13, color: "#f59e0b" }}>★</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 24, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 20px", display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#f59e0b", display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#374151" }}>{t("关注列表", "Watchlist")}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: "#d1d5db", display: "inline-block" }} />
            <span style={{ fontSize: 13, color: "#374151" }}>{t("已被选走", "Drafted")}</span>
          </div>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>
            {t("点击球员名字可以标记/取消标记为已被选走，数据会自动保存", "Click player names to mark/unmark as drafted. Data saves automatically")}
          </p>
        </div>
      </main>
    </div>
  );
}
