"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import LightHeader from "@/components/LightHeader";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const JOURNEY = [
  { zh: "了解规则", en: "Learn Rules" },
  { zh: "加入联赛", en: "Join League" },
  { zh: "参与选秀", en: "Draft" },
  { zh: "管理球队", en: "Manage Team" },
  { zh: "赢得联赛", en: "Win League" },
];

const CARDS = [
  {
    num: "01",
    icon: "📋",
    iconBg: "#dbeafe",
    titleZh: "什么是幻想篮球?",
    titleEn: "What is Fantasy Basketball?",
    descZh: "你扮演一支NBA球队的GM，通过选秀挑选真实球员组建梦之队。球员在现实比赛中的表现直接转化为你的幻想得分。",
    descEn: "You're the GM of an NBA team, drafting real players to build your dream squad. Real game performances convert directly to your fantasy points.",
  },
  {
    num: "02",
    icon: "🎯",
    iconBg: "#fef3c7",
    titleZh: "蛇形选秀机制",
    titleEn: "Snake Draft System",
    descZh: "选秀按照蛇形顺序进行：奇数轮从1号位开始，偶数轮从最后一位开始，确保每个参与者机会均等。",
    descEn: "Drafts follow snake order: odd rounds go from pick 1, even rounds reverse, ensuring every participant gets fair opportunities.",
  },
  {
    num: "03",
    icon: "📊",
    iconBg: "#dbeafe",
    titleZh: "积分是怎么算的?",
    titleEn: "How is Scoring Calculated?",
    descZh: "得分、篮板、助攻、抢断、盖帽各项均有对应分值。球员真实比赛数据实时转化，每场比赛结束后自动更新。",
    descEn: "Points, rebounds, assists, steals, blocks all have assigned values. Player stats convert in real time, updating automatically after each game.",
  },
  {
    num: "04",
    icon: "🔄",
    iconBg: "#fef3c7",
    titleZh: "赛季管理",
    titleEn: "Season Management",
    descZh: "赛季期间可通过转会市场补强阵容，交易伤病球员，或从 Waiver Wire 捡漏新秀突破球员。",
    descEn: "During the season, strengthen your roster through the trade market, drop injured players, or pick up breakout rookies from the Waiver Wire.",
  },
  {
    num: "05",
    icon: "🏆",
    iconBg: "#fef3c7",
    titleZh: "如何赢得联赛?",
    titleEn: "How to Win the League?",
    descZh: "常规赛积累胜场进入季后赛，通过对抗制决出最终冠军。9个统计类别中赢得更多类别即为胜利。",
    descEn: "Accumulate wins in the regular season to reach playoffs, then win the championship through head-to-head matchups. Win more of the 9 stat categories to beat your opponent.",
  },
];

export default function HowToPlayPage() {
  const { t } = useLang();

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>

      <LightHeader activeHref="/how-to-play" />

      {/* Hero */}
      <div style={{ background: "#fff", padding: "56px 32px 48px", textAlign: "center", borderBottom: "1px solid #f3f4f6" }}>
        <h1 style={{ fontSize: 40, fontWeight: 800, color: "#111827", margin: "0 0 12px 0" }}>
          {t("欢迎来到幻想篮球", "Welcome to Fantasy Basketball")}
        </h1>
        <p style={{ fontSize: 16, color: "#6b7280", margin: "0 0 40px 0" }}>
          {t("不懂也没关系，5分钟读懂规则，立刻开始你的第一次选秀。", "No experience needed — 5 minutes to learn the rules and start your first draft.")}
        </p>

        {/* Step progress */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", gap: 0, maxWidth: 560, margin: "0 auto" }}>
          {JOURNEY.map((step, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                {/* Left line */}
                <div style={{ flex: 1, height: 2, background: i === 0 ? "#1e3a8a" : "#e5e7eb" }} />

                {/* Circle */}
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: i === 0 ? 16 : 14, fontWeight: 700,
                  background: i === 0 ? "#1e3a8a" : "#fff",
                  color: i === 0 ? "#fff" : i === 1 ? "#1e3a8a" : "#9ca3af",
                  border: i === 0 ? "none" : i === 1 ? "2.5px solid #1e3a8a" : "2px solid #d1d5db",
                  transition: "all 0.2s",
                }}>
                  {i === 0 ? "✓" : i + 1}
                </div>

                {/* Right line */}
                <div style={{ flex: 1, height: 2, background: "#e5e7eb" }} />
              </div>
              <div style={{ fontSize: 12, fontWeight: i <= 1 ? 600 : 400, color: i === 0 ? "#1e3a8a" : i === 1 ? "#1e3a8a" : "#9ca3af", marginTop: 8 }}>
                {t(step.zh, step.en)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 32px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20 }}>

          {/* Concept cards */}
          {CARDS.map((card) => (
            <div key={card.num} style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: "28px 24px",
            }}>
              {/* Icon */}
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: card.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, marginBottom: 12,
              }}>
                {card.icon}
              </div>

              {/* Number */}
              <div style={{ fontSize: 40, fontWeight: 800, color: "#f3f4f6", lineHeight: 1, marginBottom: 8 }}>
                {card.num}
              </div>

              {/* Title */}
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
                {t(card.titleZh, card.titleEn)}
              </div>

              {/* Desc */}
              <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.7, margin: 0 }}>
                {t(card.descZh, card.descEn)}
              </p>
            </div>
          ))}

          {/* CTA card */}
          <div style={{
            background: "#1e3a8a",
            borderRadius: 16,
            padding: "28px 24px",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: "#2563eb",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20, marginBottom: 12,
            }}>
              🚀
            </div>
            <div style={{ fontSize: 40, fontWeight: 800, color: "rgba(255,255,255,0.15)", lineHeight: 1, marginBottom: 8 }}>
              GO
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 10 }}>
              {t("准备好了?", "Ready to go?")}
            </div>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, margin: "0 0 20px 0", flex: 1 }}>
              {t("先去看看球员排名，或直接参加一场模拟选秀练手。", "Check the player rankings first, or jump straight into a mock draft.")}
            </p>
            <Link href="/mock-draft" style={{
              display: "inline-block",
              padding: "11px 20px",
              fontSize: 14, fontWeight: 700,
              color: "#fff",
              background: "#1e3a8a",
              borderRadius: 10,
              textDecoration: "none",
              textAlign: "center",
            }}>
              {t("开始模拟选秀 →", "Start Mock Draft →")}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
