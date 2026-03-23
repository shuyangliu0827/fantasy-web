"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { getCurrentSeasonLabel } from "@/lib/season";
import LightHeader from "@/components/LightHeader";

const ROUNDS = [
  {
    badge: "1",
    badgeBg: "#1d4ed8",
    titleZh: "第一轮 — 核心锁定",
    titleEn: "Round 1 — Lock a Core",
    descZh: "Jokić / Giannis / Dončić — 三选一，不犹豫",
    descEn: "Jokić / Giannis / Dončić — pick one, no hesitation",
    tagZh: "必选",
    tagEn: "Must Pick",
    tagBg: "#fef3c7",
    tagColor: "#92400e",
  },
  {
    badge: "2",
    badgeBg: "#f97316",
    titleZh: "第二轮 — 价值最大化",
    titleEn: "Round 2 — Maximize Value",
    descZh: "Curry / Durant / Edwards — 用性价比换深度",
    descEn: "Curry / Durant / Edwards — value over depth",
    tagZh: "高价值",
    tagEn: "High Value",
    tagBg: "#fff7ed",
    tagColor: "#c2410c",
  },
  {
    badge: "3",
    badgeBg: "#6b7280",
    titleZh: "第三轮 — 平衡补充",
    titleEn: "Round 3 — Balance Your Roster",
    descZh: "根据队伍短板补位，关注 SG/SF 双能卫",
    descEn: "Fill positional gaps, target SG/SF versatility",
    tagZh: "高价值",
    tagEn: "High Value",
    tagBg: "#fff7ed",
    tagColor: "#c2410c",
  },
  {
    badge: "7-9",
    badgeBg: "#374151",
    titleZh: "中段轮次 — 潜力挖掘",
    titleEn: "Rounds 7-9 — Find Upside",
    descZh: "新生代突破球员：Wembanyama / Cade / Paolo",
    descEn: "Breakout candidates: Wembanyama / Cade / Paolo",
    tagZh: "潜力股",
    tagEn: "Upside",
    tagBg: "#dcfce7",
    tagColor: "#166534",
  },
  {
    badge: "12-13",
    badgeBg: "#9ca3af",
    titleZh: "末轮捡漏 — 隐藏价值",
    titleEn: "Rounds 12-13 — Hidden Gems",
    descZh: "上赛季伤病复出球员、轮换上位新秀",
    descEn: "Injury returnees, emerging rotation players",
    tagZh: "捡漏",
    tagEn: "Sleeper",
    tagBg: "#f3f4f6",
    tagColor: "#4b5563",
  },
];

const STRATEGIES = [
  {
    titleZh: "Punting 策略",
    titleEn: "Punting Strategy",
    descZh: "主动放弃1-2个统计项，换取在其他类别的绝对优势。",
    descEn: "Sacrifice 1-2 categories to dominate the rest.",
  },
  {
    titleZh: "均衡型选法",
    titleEn: "Balanced Build",
    descZh: "每轮尽量覆盖不同位置，保持9项统计均衡发展。",
    descEn: "Cover different positions each round, stay balanced across all 9 categories.",
  },
  {
    titleZh: "爆分策略",
    titleEn: "Streaming Strategy",
    descZh: "叠加得分+三分+命中率球员，适合高分竞争制联赛。",
    descEn: "Stack scorers and shooters — best for points-heavy leagues.",
  },
];

export default function DraftGuidePage() {
  const { t } = useLang();

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>

      <LightHeader activeHref="/draft-guide" />

      {/* Hero */}
      <div style={{
        background: "#111827",
        backgroundImage: "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        padding: "56px 32px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{
            display: "inline-block",
            fontSize: 13,
            fontWeight: 600,
            color: "#f59e0b",
            marginBottom: 16,
            letterSpacing: "0.5px",
          }}>
            {t(`选秀指南 · ${getCurrentSeasonLabel()}赛季`, `Draft Guide · ${getCurrentSeasonLabel()} Season`)}
          </div>
          <h1 style={{
            fontSize: 52,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.15,
            margin: "0 0 16px 0",
          }}>
            {t("13轮选秀", "13-Round Draft")}<br />
            {t("完全攻略手册", "Complete Strategy Guide")}
          </h1>
          <p style={{ fontSize: 16, color: "#9ca3af", margin: 0, maxWidth: 520 }}>
            {t(
              "从首轮必选到末轮捡漏，每一轮的战略逻辑与推荐球员。",
              "From must-picks in round 1 to sleepers in round 13 — strategy and recommendations for every pick."
            )}
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px", display: "flex", gap: 32, alignItems: "flex-start" }}>

        {/* Left: Round cards */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 20px 0" }}>
            {t("推荐球员 · 按轮次", "Recommended Picks · By Round")}
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {ROUNDS.map((round) => (
              <div key={round.badge} style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}>
                {/* Badge */}
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: round.badgeBg,
                  color: "#fff",
                  fontSize: round.badge.length > 1 ? 12 : 18,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}>
                  {round.badge}
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                    {t(round.titleZh, round.titleEn)}
                  </div>
                  <div style={{ fontSize: 14, color: "#6b7280" }}>
                    {t(round.descZh, round.descEn)}
                  </div>
                </div>

                {/* Tag */}
                <div style={{
                  flexShrink: 0,
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: round.tagBg,
                  color: round.tagColor,
                  fontSize: 12,
                  fontWeight: 600,
                }}>
                  {t(round.tagZh, round.tagEn)}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{
            marginTop: 40,
            padding: "32px",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            textAlign: "center",
          }}>
            <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 20px 0" }}>
              {t("准备好开始了吗？", "Ready to get started?")}
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <Link href="/mock-draft" style={{
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 700,
                color: "#fff",
                background: "#1e3a8a",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-block",
              }}>
                {t("开始模拟选秀", "Start Mock Draft")}
              </Link>
              <Link href="/rankings" style={{
                padding: "12px 28px",
                fontSize: 15,
                fontWeight: 600,
                color: "#374151",
                background: "#fff",
                border: "1.5px solid #d1d5db",
                borderRadius: 10,
                textDecoration: "none",
                display: "inline-block",
              }}>
                {t("查看球员排名", "View Rankings")}
              </Link>
            </div>
          </div>
        </div>

        {/* Right: Strategy sidebar */}
        <div style={{ width: 280, flexShrink: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 16px 0" }}>
            {t("选秀策略", "Draft Strategies")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {STRATEGIES.map((s) => (
              <div key={s.titleZh} style={{
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6 }}>
                  {t(s.titleZh, s.titleEn)}
                </div>
                <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                  {t(s.descZh, s.descEn)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
