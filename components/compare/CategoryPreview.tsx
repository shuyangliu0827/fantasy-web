"use client";
// components/compare/CategoryPreview.tsx
// Beta categories mode preview — lightweight, no recommendation engine.
// Architecture designed for future expansion to full 9-cat analysis.

import { useLang } from "@/lib/lang";
import { FONT, COLORS, PLAYER_COLORS } from "./constants";
import type { CompareStats } from "@/lib/compare/types";

interface CategoryPreviewProps {
  players: CompareStats[];
  isMobile: boolean;
}

const CAT_STATS = [
  { key: "fgPct",  label: "FG%",  labelZh: "命中率",  max: 65,  higherIsBetter: true  },
  { key: "ftPct",  label: "FT%",  labelZh: "罚球%",   max: 95,  higherIsBetter: true  },
  { key: "fg3mPg", label: "3PM",  labelZh: "三分/场", max: 5,   higherIsBetter: true  },
  { key: "ppg",    label: "PTS",  labelZh: "得分",    max: 40,  higherIsBetter: true  },
  { key: "rpg",    label: "REB",  labelZh: "篮板",    max: 18,  higherIsBetter: true  },
  { key: "apg",    label: "AST",  labelZh: "助攻",    max: 14,  higherIsBetter: true  },
  { key: "spg",    label: "STL",  labelZh: "抢断",    max: 3,   higherIsBetter: true  },
  { key: "bpg",    label: "BLK",  labelZh: "盖帽",    max: 4,   higherIsBetter: true  },
  { key: "tov",    label: "TOV",  labelZh: "失误",    max: 6,   higherIsBetter: false },
];

export default function CategoryPreview({ players, isMobile }: CategoryPreviewProps) {
  const { t } = useLang();

  return (
    <div style={{ marginTop: 8 }}>
      {/* Beta banner */}
      <div style={{
        background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
        borderRadius: 16,
        padding: "18px 24px",
        marginBottom: 20,
        color: "#fff",
        display: "flex",
        alignItems: isMobile ? "flex-start" : "center",
        gap: 14,
        flexDirection: isMobile ? "column" : "row",
      }}>
        <div style={{ fontSize: 36 }}>🧪</div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>{t("分类制模式", "Categories Mode")}</h3>
            <span style={{ fontSize: 11, fontWeight: 700, background: "rgba(255,255,255,0.2)", padding: "2px 8px", borderRadius: 4 }}>BETA</span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.5 }}>
            {t(
              "9类别积分制对比即将推出。目前仅展示基础类别数据，更多功能（赛季积分、Punt策略、联赛设置同步）正在开发中。",
              "Full 9-category comparison is coming soon. This preview shows category stats only. Full features (category scoring, punt strategies, roster fit, league sync) are in development."
            )}
          </p>
        </div>
      </div>

      {/* Category stats */}
      {players.length >= 2 && (
        <div style={{
          background: COLORS.card,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: "20px 20px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: COLORS.textPrimary, margin: 0, fontFamily: FONT }}>
              {t("分类数据对比", "Category Stats")}
            </h3>
          </div>

          {/* Player legend */}
          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            {players.slice(0, 2).map((p, i) => (
              <div key={p.playerId} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 12, height: 12, borderRadius: 3, background: PLAYER_COLORS[i], display: "inline-block" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary, fontFamily: FONT }}>{p.playerName}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: "12px 24px" }}>
            {CAT_STATS.map(cat => {
              const [pA, pB] = players as [CompareStats, CompareStats];
              const vA = ((pA as unknown as Record<string, unknown>)[cat.key] as number) ?? 0;
              const vB = ((pB as unknown as Record<string, unknown>)[cat.key] as number) ?? 0;
              const pctA = Math.min((vA / cat.max) * 100, 100);
              const pctB = Math.min((vB / cat.max) * 100, 100);
              const aWins = cat.higherIsBetter ? vA > vB : vA < vB;
              const bWins = cat.higherIsBetter ? vB > vA : vB < vA;

              return (
                <div key={cat.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.textSecondary }}>
                      {t(cat.labelZh, cat.label)}
                    </span>
                    {!cat.higherIsBetter && (
                      <span style={{ fontSize: 10, color: COLORS.textMuted }}>{t("越低越好", "lower=better")}</span>
                    )}
                  </div>
                  {[
                    { player: pA, val: vA, pct: pctA, wins: aWins, color: PLAYER_COLORS[0] },
                    { player: pB, val: vB, pct: pctB, wins: bWins, color: PLAYER_COLORS[1] },
                  ].map(({ player, val, pct, wins, color }) => (
                    <div key={player.playerId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 60, fontSize: 11, color: COLORS.textMuted, fontFamily: FONT, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {player.playerName.split(" ").pop()}
                      </span>
                      <div style={{ flex: 1, height: 18, background: COLORS.bg, borderRadius: 6, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, opacity: wins ? 1 : 0.45, transition: "width 0.4s" }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: wins ? 700 : 500, color: wins ? color : COLORS.textSecondary, width: 38, textAlign: "right", fontFamily: FONT }}>
                        {cat.key.includes("Pct") || cat.key === "fgPct" || cat.key === "ftPct" ? val.toFixed(1) + "%" : val.toFixed(1)}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 20, padding: "12px 16px", background: COLORS.bg, borderRadius: 10, border: `1px dashed ${COLORS.border}` }}>
            <p style={{ margin: 0, fontSize: 12, color: COLORS.textMuted, fontFamily: FONT, lineHeight: 1.5 }}>
              {t(
                "🚧 完整的类别推荐引擎（包括Punt策略分析和联赛配置同步）即将推出。",
                "🚧 Full category recommendation engine with punt strategy analysis and league settings sync is coming soon."
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
