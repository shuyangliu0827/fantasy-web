"use client";

import Link from "next/link";
import { useState } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

export default function DraftGuidePage() {
  const { t } = useLang();
  const [activeGuide, setActiveGuide] = useState("basics");

  const guides = [
    {
      id: "basics",
      title: t("Fantasy 篮球基础", "Fantasy Basketball Basics"),
      sections: [
        {
          heading: t("什么是 Fantasy 篮球？", "What is Fantasy Basketball?"),
          content: t(
            "Fantasy 篮球是一种虚拟体育游戏，你可以组建一支由真实 NBA 球员组成的虚拟球队。球员在真实比赛中的表现会转化为你的 Fantasy 得分。你的目标是通过选秀、交易、阵容调整等方式，打造最强的 Fantasy 球队。",
            "Fantasy basketball is a virtual sports game where you build a team of real NBA players. Their real-game performance translates to your Fantasy points. Your goal is to build the strongest Fantasy team through drafting, trading, and roster management."
          )
        },
        {
          heading: t("计分方式", "Scoring Categories"),
          content: t(
            "常见的计分类别包括：得分 (PTS)、篮板 (REB)、助攻 (AST)、抢断 (STL)、盖帽 (BLK)、三分球 (3PM)、投篮命中率 (FG%)、罚球命中率 (FT%)、失误 (TO) - 负面数据，越少越好",
            "Common scoring categories include: Points (PTS), Rebounds (REB), Assists (AST), Steals (STL), Blocks (BLK), 3-Pointers (3PM), Field Goal % (FG%), Free Throw % (FT%), Turnovers (TO) - negative stat, fewer is better"
          )
        }
      ]
    },
    {
      id: "draft-strategy",
      title: t("选秀策略", "Draft Strategy"),
      sections: [
        {
          heading: t("前三轮：稳定是王道", "Rounds 1-3: Stability is Key"),
          content: t(
            "前三轮选秀是你球队的基石。优先选择：稳定出场的球星（避免伤病历史严重的球员）、全能型球员（能在多个类别贡献的球员价值更高）、高使用率球员（球队核心通常更稳定）",
            "The first three rounds are your team's foundation. Prioritize: Durable stars (avoid injury-prone players), versatile players (those contributing across multiple categories are more valuable), high-usage players (team cornerstones are typically more consistent)"
          )
        },
        {
          heading: t("中轮策略：找价值洼地", "Mid Rounds: Find Value"),
          content: t(
            "第 4-8 轮是找便宜货的关键：年轻新星（有突破潜力的二三年级球员）、换队球员（去到更好位置的球员可能爆发）、伤愈归来（低 ADP 的伤愈球员可能超值）",
            "Rounds 4-8 are key for finding bargains: Young stars (2nd-3rd year players with breakout potential), players on new teams (may thrive in better situations), returning from injury (low ADP players recovering may be undervalued)"
          )
        }
      ]
    },
    {
      id: "punting",
      title: t("Punting 策略", "Punting Strategy"),
      sections: [
        {
          heading: t("什么是 Punting？", "What is Punting?"),
          content: t(
            "Punting 是一种进阶策略：故意放弃 1-2 个计分类别，集中资源在其他类别取得优势。例如：Punt FT%（放弃罚球命中率）可以让你放心选择 Giannis、Zion 这类低罚球但其他数据爆炸的球员。",
            "Punting is an advanced strategy: intentionally giving up 1-2 scoring categories to dominate others. Example: Punting FT% lets you confidently draft players like Giannis or Zion who have poor free throw rates but excel everywhere else."
          )
        },
        {
          heading: t("常见 Punt 组合", "Common Punt Builds"),
          content: t(
            "Punt 助攻 (AST) - 适合锋线为主的阵容；Punt 篮板 (REB) - 适合后卫为主的阵容；Punt 三分 (3PM) - 适合内线+切入型球员；Punt 罚球 (FT%) - 适合低罚球命中率球员",
            "Punt Assists (AST) - suits forward-heavy builds; Punt Rebounds (REB) - suits guard-heavy builds; Punt 3-Pointers (3PM) - suits bigs + slashers; Punt Free Throws (FT%) - suits poor FT shooters"
          )
        }
      ]
    }
  ];

  const currentGuide = guides.find(g => g.id === activeGuide) || guides[0];

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("选秀指南", "Draft Guide")}</h1>
          <p className="page-desc">{t("从新手到高手的完整 Fantasy 篮球攻略", "Complete Fantasy basketball guide from beginner to expert")}</p>
        </div>

        <div className="guide-layout">
          <aside className="guide-sidebar">
            <h3 className="sidebar-title">{t("目录", "Contents")}</h3>
            {guides.map(guide => (
              <button
                key={guide.id}
                className={`guide-nav-item ${activeGuide === guide.id ? "active" : ""}`}
                onClick={() => setActiveGuide(guide.id)}
              >
                <span className="guide-nav-title">{guide.title}</span>
              </button>
            ))}
          </aside>

          <article className="guide-content">
            <h2 className="guide-main-title">{currentGuide.title}</h2>

            {currentGuide.sections.map((section, idx) => (
              <section key={idx} className="guide-section">
                <h3 className="guide-section-title">{section.heading}</h3>
                <div className="guide-section-content">
                  <p>{section.content}</p>
                </div>
              </section>
            ))}

            <div className="guide-cta">
              <p>{t("准备好开始了吗？", "Ready to get started?")}</p>
              <div className="guide-cta-buttons">
                <Link href="/mock-draft" className="btn btn-primary">{t("开始模拟选秀", "Start Mock Draft")}</Link>
                <Link href="/rankings" className="btn btn-ghost">{t("查看球员排名", "View Rankings")}</Link>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
