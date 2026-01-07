"use client";

import Link from "next/link";
import { useState } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";

export default function HowToPlayPage() {
  const { t } = useLang();
  const [activeStep, setActiveStep] = useState(1);

  const steps = [
    {
      id: 1,
      icon: "🏀",
      title: t("创建或加入联赛", "Create or Join a League"),
      content: t(
        "第一步是找到一个联赛加入，或者创建你自己的联赛。公共联赛可以在「加入公共联赛」页面找到；私人联赛需要邀请朋友一起玩；联赛设置包括人数（8-14人）、计分方式、选秀日期等。",
        "First, find a league to join or create your own. Public leagues can be found on the 'Join Public League' page; Private leagues require inviting friends; League settings include team count (8-14), scoring type, draft date, etc."
      ),
      tips: [
        t("新手建议先加入 10-12 人的联赛", "Beginners should start with 10-12 team leagues"),
        t("H2H Categories 是最常见的计分方式", "H2H Categories is the most common format"),
        t("选秀日期最好选在 NBA 赛季开始前 1-2 周", "Draft date should be 1-2 weeks before NBA season")
      ]
    },
    {
      id: 2,
      icon: "📋",
      title: t("选秀准备", "Prepare for Draft"),
      content: t(
        "选秀是 Fantasy 篮球最重要的环节！研究球员排名，了解每个球员的价值；建立关注列表，标记你喜欢的球员；学习策略，阅读选秀指南；在正式选秀前多做几次模拟选秀练习。",
        "The draft is the most important part! Study player rankings to understand each player's value; Build a watchlist of players you like; Learn strategies by reading the draft guide; Practice with mock drafts before your real draft."
      ),
      tips: [
        t("至少做 3-5 次模拟选秀", "Do at least 3-5 mock drafts"),
        t("准备一份 Cheat Sheet（备忘单）", "Prepare a Cheat Sheet"),
        t("了解你的选秀位置，制定相应策略", "Know your draft position and plan accordingly")
      ]
    },
    {
      id: 3,
      icon: "🎯",
      title: t("参加选秀", "Join the Draft"),
      content: t(
        "选秀当天，按照你的准备来选择球员。蛇形选秀按顺序轮流选人，选秀顺序每轮反转；拍卖选秀用虚拟货币竞拍球员；每轮通常有 60-90 秒选人时间。选人优先级：前三轮选稳定的球星，中间轮次找价值洼地，后轮补充位置需求。",
        "On draft day, follow your preparation. Snake drafts alternate picks with order reversing each round; Auction drafts use virtual currency to bid; Each pick usually has 60-90 seconds. Priority: Draft stable stars in rounds 1-3, find value in middle rounds, fill roster needs late."
      ),
      tips: [
        t("不要慌，60秒够用了", "Don't panic, 60 seconds is enough"),
        t("如果你喜欢的球员被选走，看下一个", "If your target is taken, move to the next"),
        t("注意平衡各个位置", "Balance all positions")
      ]
    },
    {
      id: 4,
      icon: "📊",
      title: t("管理阵容", "Manage Your Roster"),
      content: t(
        "赛季开始后，每天/每周管理你的阵容。设置首发：每天把要比赛的球员放到首发位置；关注伤病：受伤球员放到 IR 位，从弃用区找替补；弃用区淘金：关注近期表现好的弃用区球员；交易：与其他玩家交易，补强你的弱项。",
        "After the season starts, manage your roster daily/weekly. Set lineups: Put playing players in starting slots each day; Monitor injuries: Move injured players to IR, find replacements; Waiver wire: Watch for hot free agents; Trading: Trade with others to improve weaknesses."
      ),
      tips: [
        t("养成每天看阵容的习惯", "Make checking lineups a daily habit"),
        t("关注 streaming 策略", "Learn streaming strategies"),
        t("不要因为一两周的表现就放弃球员", "Don't drop players after 1-2 bad weeks")
      ]
    },
    {
      id: 5,
      icon: "⚔️",
      title: t("每周对决", "Weekly Matchups"),
      content: t(
        "大多数联赛采用每周对决制。H2H Categories 每周比拼各项数据类别，赢的类别多的人获胜；H2H Points 每周比总得分；Rotisserie 全赛季累计排名。获胜技巧：关注对手的阵容构成，在自己的强项类别巩固优势，在接近的类别尝试反超。",
        "Most leagues use weekly matchups. H2H Categories: Compare stats category by category, most wins takes the week; H2H Points: Compare total points; Rotisserie: Season-long cumulative rankings. Tips: Study opponent's roster, strengthen your dominant categories, push close categories."
      ),
      tips: [
        t("每周初期就设置好阵容", "Set lineups early each week"),
        t("周末多场比赛，确保首发满的", "Weekends have more games, ensure full lineups"),
        t("关注对手的 streaming 策略", "Watch opponent's streaming moves")
      ]
    }
  ];

  const currentStep = steps.find(s => s.id === activeStep) || steps[0];

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{t("新手入门", "How To Play")}</h1>
          <p className="page-desc">{t("5 步带你玩转 Fantasy 篮球", "5 steps to master Fantasy basketball")}</p>
        </div>

        <div className="steps-progress">
          {steps.map(step => (
            <button
              key={step.id}
              className={`step-dot ${activeStep >= step.id ? "active" : ""} ${activeStep === step.id ? "current" : ""}`}
              onClick={() => setActiveStep(step.id)}
            >
              <span className="step-icon">{step.icon}</span>
              <span className="step-number">Step {step.id}</span>
            </button>
          ))}
          <div className="progress-line">
            <div className="progress-fill" style={{ width: `${((activeStep - 1) / 4) * 100}%` }}></div>
          </div>
        </div>

        <div className="step-content">
          <div className="step-header">
            <span className="step-badge">Step {currentStep.id}</span>
            <h2 className="step-title">{currentStep.title}</h2>
          </div>

          <div className="step-body">
            <p>{currentStep.content}</p>
          </div>

          <div className="step-tips">
            <h4>💡 {t("小贴士", "Tips")}</h4>
            <ul>
              {currentStep.tips.map((tip, i) => (
                <li key={i}>{tip}</li>
              ))}
            </ul>
          </div>

          <div className="step-navigation">
            <button 
              className="btn btn-ghost" 
              onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
              disabled={activeStep === 1}
            >
              ← {t("上一步", "Previous")}
            </button>
            {activeStep < 5 ? (
              <button 
                className="btn btn-primary"
                onClick={() => setActiveStep(activeStep + 1)}
              >
                {t("下一步", "Next")} →
              </button>
            ) : (
              <Link href="/mock-draft" className="btn btn-primary">
                {t("开始模拟选秀", "Start Mock Draft")} →
              </Link>
            )}
          </div>
        </div>

        <div className="quick-links">
          <h3>{t("相关页面", "Related Pages")}</h3>
          <div className="links-grid">
            <Link href="/rankings" className="quick-link-card">
              <span className="quick-link-icon">📊</span>
              <span className="quick-link-title">{t("球员排名", "Rankings")}</span>
              <span className="quick-link-desc">{t("查看完整球员排名", "View full player rankings")}</span>
            </Link>
            <Link href="/draft-guide" className="quick-link-card">
              <span className="quick-link-icon">📖</span>
              <span className="quick-link-title">{t("选秀指南", "Draft Guide")}</span>
              <span className="quick-link-desc">{t("深入了解选秀策略", "Learn draft strategies")}</span>
            </Link>
            <Link href="/mock-draft" className="quick-link-card">
              <span className="quick-link-icon">🎯</span>
              <span className="quick-link-title">{t("模拟选秀", "Mock Draft")}</span>
              <span className="quick-link-desc">{t("练习你的选秀技巧", "Practice your draft skills")}</span>
            </Link>
            <Link href="/cheat-sheet" className="quick-link-card">
              <span className="quick-link-icon">📋</span>
              <span className="quick-link-title">{t("选秀备忘单", "Cheat Sheet")}</span>
              <span className="quick-link-desc">{t("选秀时的快速参考", "Quick reference for drafts")}</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
