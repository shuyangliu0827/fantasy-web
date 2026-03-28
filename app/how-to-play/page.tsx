"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/lib/lang";
import LightHeader from "@/components/LightHeader";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const STEPS = [
  { zh: "了解规则", en: "Learn Rules", icon: "📖" },
  { zh: "加入联赛", en: "Join League", icon: "🏆" },
  { zh: "参与选秀", en: "Draft", icon: "🎯" },
  { zh: "管理球队", en: "Manage Team", icon: "⚙️" },
  { zh: "赢得联赛", en: "Win League", icon: "🥇" },
];

type StepContent = {
  titleZh: string;
  titleEn: string;
  subtitleZh: string;
  subtitleEn: string;
  sections: {
    iconBg: string;
    icon: string;
    headingZh: string;
    headingEn: string;
    items: { zh: string; en: string }[];
  }[];
};

const STEP_CONTENT: StepContent[] = [
  // Step 1 — Learn Rules
  {
    titleZh: "什么是范特西篮球？",
    titleEn: "What is Fantasy Basketball?",
    subtitleZh: "你扮演一支 NBA 球队的 GM，用真实球员组建梦之队，他们的比赛数据就是你的得分。",
    subtitleEn: "You're the GM of an NBA team. Draft real players, and their real game stats become your fantasy points.",
    sections: [
      {
        iconBg: "#dbeafe",
        icon: "🏀",
        headingZh: "基本概念",
        headingEn: "The Basics",
        items: [
          { zh: "每位玩家通过选秀选出一支由真实 NBA 球员组成的队伍", en: "Each manager drafts a roster of real NBA players" },
          { zh: "球员在现实比赛中的表现直接转化为你的 fpts（分数）", en: "Player real-game stats convert directly into your fantasy points" },
          { zh: "每周你的队伍与另一位玩家的队伍正面对决", en: "Each week your team faces off head-to-head against another manager" },
          { zh: "积累更多胜场，进入季后赛争夺冠军", en: "Stack wins during the regular season to make the playoffs and compete for the title" },
        ],
      },
      {
        iconBg: "#fef3c7",
        icon: "📊",
        headingZh: "积分换算规则",
        headingEn: "Points Scoring System",
        items: [
          { zh: "得分（PTS）× 1 分", en: "Points (PTS) × 1 pt" },
          { zh: "篮板（REB）× 1.2 分", en: "Rebounds (REB) × 1.2 pts" },
          { zh: "助攻（AST）× 1.5 分", en: "Assists (AST) × 1.5 pts" },
          { zh: "抢断（STL）× 3 分", en: "Steals (STL) × 3 pts" },
          { zh: "盖帽（BLK）× 3 分", en: "Blocks (BLK) × 3 pts" },
          { zh: "三分球命中（3PM）× 1 分（与得分叠加）", en: "3-Pointers Made (3PM) × 1 pt (stacks with PTS)" },
          { zh: "失误（TOV）× −1 分（扣分项，越少越好）", en: "Turnovers (TOV) × −1 pt (penalty; fewer is better)" },
        ],
      },
      {
        iconBg: "#dcfce7",
        icon: "⚔️",
        headingZh: "H2H 积分制对决",
        headingEn: "H2H Points Matchups",
        items: [
          { zh: "每周双方所有首发球员的 fpts（分数）加总相比较", en: "Each week, both teams' total fantasy points are compared" },
          { zh: "总积分高者赢得本周对决，记为 1 胜", en: "The team with the higher total wins the matchup and earns 1 win" },
          { zh: "不按统计类别分项比较，总分直接决定胜负", en: "No per-category breakdown — your combined total determines the result" },
          { zh: "常规赛结束后，胜场数最多的球队进入季后赛", en: "After the regular season, teams with the most wins advance to the playoffs" },
        ],
      },
    ],
  },

  // Step 2 — Join League
  {
    titleZh: "如何加入或创建联赛？",
    titleEn: "How to Join or Create a League",
    subtitleZh: "联赛是整个游戏的核心。你可以加入朋友的私人联赛，或等待公开联赛邀请。",
    subtitleEn: "The league is the heart of the game. Join a friend's private league or wait for a public league invite.",
    sections: [
      {
        iconBg: "#dbeafe",
        icon: "🔗",
        headingZh: "加入联赛",
        headingEn: "Joining a League",
        items: [
          { zh: "通过联赛邀请链接直接加入私人联赛", en: "Use a league invite link to join a private league directly" },
          { zh: "联赛专员（Commissioner）负责管理和设置联赛规则", en: "The Commissioner manages the league and configures the rules" },
          { zh: "加入后需创建你的队名，这是你在联赛中的身份", en: "After joining, create your team name — that's your identity in the league" },
          { zh: "确认加入后你将收到选秀顺序通知", en: "Once confirmed, you'll be notified of your draft position" },
        ],
      },
      {
        iconBg: "#fef3c7",
        icon: "⚙️",
        headingZh: "联赛基本设置",
        headingEn: "Key League Settings",
        items: [
          { zh: "联赛人数：通常 8–12 人，人越多竞争越激烈", en: "League size: typically 8–12 managers; more teams = tougher competition" },
          { zh: "赛季长度：与 NBA 常规赛同步，通常 10–20 周", en: "Season length: mirrors the NBA regular season, usually 10–20 weeks" },
          { zh: "首发位置：每队设有 PG、SG、SF、PF、C 及替补席", en: "Roster spots: each team has PG, SG, SF, PF, C, and bench positions" },
          { zh: "每日阵容：每天可调整首发名单应对赛程变化", en: "Daily lineups: you can adjust starters each day to respond to the schedule" },
        ],
      },
      {
        iconBg: "#dcfce7",
        icon: "📅",
        headingZh: "选秀前准备",
        headingEn: "Before the Draft",
        items: [
          { zh: "提前研究球员排名，了解每个位置的强力球员", en: "Study player rankings in advance and know the top players at each position" },
          { zh: "关注赛前伤病报告，避免浪费高顺位选中伤员", en: "Check injury reports before the draft; avoid wasting a high pick on an injured player" },
          { zh: "了解每支 NBA 球队的上场时间分配情况", en: "Understand each NBA team's rotation and minutes distribution" },
          { zh: "准备一份 Cheat Sheet（速查表）列出目标球员优先级", en: "Prepare a cheat sheet ranking your target players by priority" },
        ],
      },
    ],
  },

  // Step 3 — Draft
  {
    titleZh: "选秀怎么进行？",
    titleEn: "How Does the Draft Work?",
    subtitleZh: "选秀是整个赛季最重要的时刻。蛇形制选秀确保每位参与者机会均等。",
    subtitleEn: "The draft is the most critical moment of your season. Snake format ensures everyone gets a fair shot.",
    sections: [
      {
        iconBg: "#dbeafe",
        icon: "🐍",
        headingZh: "蛇形选秀机制",
        headingEn: "Snake Draft Format",
        items: [
          { zh: "第 1 轮：1 → 2 → 3 → … → 12 顺序进行", en: "Round 1: picks go 1 → 2 → 3 → … → 12 in order" },
          { zh: "第 2 轮：12 → 11 → 10 → … → 1 倒序进行（蛇形反转）", en: "Round 2: reverses to 12 → 11 → 10 → … → 1 (the snake turn)" },
          { zh: "如此交替，直到所有球队阵容满员", en: "This alternates every round until all rosters are filled" },
          { zh: "越靠前的顺位有更多机会选到顶级球员", en: "Earlier picks give you access to more elite players in early rounds" },
        ],
      },
      {
        iconBg: "#fef3c7",
        icon: "🎯",
        headingZh: "选秀策略",
        headingEn: "Draft Strategy",
        items: [
          { zh: "前两轮优先选能贡献多个类别的全能球员（如 LeBron、约基奇）", en: "In the first 2 rounds, target multi-category contributors (e.g. LeBron, Jokic)" },
          { zh: "第 3–5 轮：寻找单类别强力球员（抢断王、三分专家）补充短板", en: "Rounds 3–5: find category specialists (steal kings, 3-point shooters) to fill gaps" },
          { zh: "关注 FG% 和 FT%：选高效射手提升命中率类别", en: "Mind FG% and FT%: target efficient shooters to win percentage categories" },
          { zh: "不要只看得分，篮板和助攻同样是 9 个类别中的 2 个", en: "Don't only chase scorers — rebounds and assists are 2 of the 9 categories too" },
          { zh: "记录已被选走的位置，避免阵容位置不平衡", en: "Track which positions have been drafted to avoid roster imbalances" },
        ],
      },
      {
        iconBg: "#dcfce7",
        icon: "💡",
        headingZh: "新手建议",
        headingEn: "Beginner Tips",
        items: [
          { zh: "不确定时选上场时间稳定的球员，不要赌潜力新秀", en: "When in doubt, pick high-floor players with consistent minutes over upside rookies" },
          { zh: "每轮留意对手的阵容构成，有时可以抢走他们急需的球员", en: "Watch your opponents' roster needs; sometimes it's worth targeting their urgently needed player" },
          { zh: "选秀结束后立即检查自由球员市场，可能有漏网之鱼", en: "Check the waiver wire immediately after the draft — hidden gems may have slipped through" },
          { zh: "不要在选秀时恐慌，按照你的计划稳步执行", en: "Don't panic during the draft — stick to your plan and execute steadily" },
        ],
      },
    ],
  },

  // Step 4 — Manage Team
  {
    titleZh: "赛季中如何管理球队？",
    titleEn: "How to Manage Your Team During the Season",
    subtitleZh: "选秀结束只是开始。赛季管理才是区分好 GM 和普通玩家的关键。",
    subtitleEn: "The draft is just the start. In-season management is what separates great GMs from casual players.",
    sections: [
      {
        iconBg: "#dbeafe",
        icon: "📋",
        headingZh: "每日阵容管理",
        headingEn: "Daily Lineup Management",
        items: [
          { zh: "每天锁定阵容前，将当天有比赛的球员排入首发", en: "Before daily lineup locks, start players who have games scheduled that day" },
          { zh: "检查每位球员的赛程：背靠背比赛可能导致休息轮换", en: "Check each player's schedule — back-to-back games may mean rest days" },
          { zh: "不要让替补席上有比赛的球员坐冷板凳", en: "Never leave a player with a game on your bench; you're leaving free points behind" },
          { zh: "利用 NBA 密集赛程周（4 场以上）积累统计数据优势", en: "Take advantage of heavy-schedule weeks (4+ games) to pile up stats" },
        ],
      },
      {
        iconBg: "#fef3c7",
        icon: "🔄",
        headingZh: "自由球员与裁员",
        headingEn: "Waiver Wire & Free Agents",
        items: [
          { zh: "裁员市场（Waiver Wire）是赛季中补强球队的最佳途径", en: "The waiver wire is your best tool for upgrading your roster mid-season" },
          { zh: "当球员因伤缺阵或表现不佳时，果断裁员补充新力量", en: "Drop underperformers or injured players and pick up emerging talent" },
          { zh: "优先关注赛程好的球员：接下来几周有大量比赛的球员", en: "Prioritize players with favorable schedules — lots of upcoming games" },
          { zh: "新秀爆发或老将复出都可能是绝佳的捡漏机会", en: "Rookie breakouts or veteran returns can be gold on the waiver wire" },
        ],
      },
      {
        iconBg: "#dcfce7",
        icon: "🤝",
        headingZh: "交易策略",
        headingEn: "Trade Strategy",
        items: [
          { zh: "交易是补强弱势类别的重要手段，用你的强项换取你缺少的", en: "Trades help balance your categories — trade surplus stats for your weaknesses" },
          { zh: "分析对手阵容：找出他们的弱势类别，提出互利的交易", en: "Study opponents' rosters to find mutually beneficial deals based on their weaknesses" },
          { zh: "不要只看球员名气，看他当前赛季的状态和赛程", en: "Don't trade by name alone; look at current form and upcoming schedule" },
          { zh: "交易截止日临近前是最佳时机，争季后赛的球队更有谈判动力", en: "The trade deadline creates urgency — playoff-hungry managers deal more aggressively" },
        ],
      },
    ],
  },

  // Step 5 — Win League
  {
    titleZh: "如何赢得联赛冠军？",
    titleEn: "How to Win the Championship",
    subtitleZh: "从常规赛到季后赛，冠军属于准备最充分的 GM。",
    subtitleEn: "From the regular season to the playoffs, the championship goes to the most prepared GM.",
    sections: [
      {
        iconBg: "#dbeafe",
        icon: "📈",
        headingZh: "常规赛策略",
        headingEn: "Regular Season Strategy",
        items: [
          { zh: "目标进入季后赛：通常前 4–6 名晋级，稳定出战比爆冷更重要", en: "Target a playoff spot: usually top 4–6 advance; consistency beats boom-or-bust" },
          { zh: "专注赢得 5–6 个类别而不是全面押注，局部优势更容易转化为胜场", en: "Focus on winning 5–6 categories per week; partial dominance is more reliable" },
          { zh: "注意赛程优势：某些周 4–5 场比赛的球队球员价值倍增", en: "Exploit schedule advantages — players on 4–5 game teams are more valuable that week" },
          { zh: "提前为季后赛赛程做准备，季后赛赛程与常规赛不同", en: "Prepare early for the playoff schedule, which differs from the regular season" },
        ],
      },
      {
        iconBg: "#fef3c7",
        icon: "🏆",
        headingZh: "季后赛心态",
        headingEn: "Playoff Mindset",
        items: [
          { zh: "季后赛通常只持续 3–4 周，没有第二次机会，每周都是决赛", en: "Playoffs typically last 3–4 weeks with no second chances — every week is a final" },
          { zh: "提前规划好季后赛每周的赛程，尽量选赛程多的球员首发", en: "Plan the playoff schedule in advance; start players with the most games each week" },
          { zh: "交易或签入赛程好的球员，用赛程优势碾压对手", en: "Trade or sign players with favorable schedules to outpace opponents with volume" },
          { zh: "针对你的季后赛对手分析他们的弱势类别，集中攻击", en: "Scout your specific playoff opponent; target their weak categories for an edge" },
        ],
      },
      {
        iconBg: "#dcfce7",
        icon: "🎓",
        headingZh: "冠军经验总结",
        headingEn: "Championship Wisdom",
        items: [
          { zh: "每天花 5 分钟查看球员伤病和自由球员市场，小投入大回报", en: "Spend 5 minutes daily checking injuries and the waiver wire — small effort, big payoff" },
          { zh: "不要因为一周输了而恐慌性抛售优质球员", en: "Don't panic-sell quality players after a bad week; variance is normal" },
          { zh: "记住：运气很重要，但做足准备的 GM 长期来看总会赢", en: "Luck matters short-term, but the most prepared GM wins over the long haul" },
          { zh: "参与联赛群聊和交流，增加乐趣也能获得信息优势", en: "Engage in your league's chat — more fun, plus you gain information advantages" },
        ],
      },
    ],
  },
];

export default function HowToPlayPage() {
  const { t } = useLang();
  const [activeStep, setActiveStep] = useState(0);

  const content = STEP_CONTENT[activeStep];
  const canPrev = activeStep > 0;
  const canNext = activeStep < STEPS.length - 1;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/how-to-play" />

      {/* Hero */}
      <div style={{ background: "#fff", padding: "48px 24px 0", borderBottom: "1px solid #e5e7eb", textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111827", margin: "0 0 10px 0", lineHeight: 1.2 }}>
          {t("欢迎来到范特西篮球", "Welcome to Fantasy Basketball")}
        </h1>
        <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 36px 0", maxWidth: 520, marginLeft: "auto", marginRight: "auto" }}>
          {t("不懂也没关系，5 分钟读懂规则，立刻开始你的第一次选秀。", "No experience needed — 5 minutes to learn the rules and start your first draft.")}
        </p>

        {/* Step nav — horizontally scrollable on mobile */}
        <div style={{
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          paddingBottom: 0,
        } as React.CSSProperties}>
          <div style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            gap: 0,
            minWidth: 480,
            margin: "0 auto",
            maxWidth: 640,
          }}>
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isPast = i < activeStep;
              return (
                <div
                  key={i}
                  style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, cursor: "pointer" }}
                  onClick={() => setActiveStep(i)}
                >
                  <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                    {/* Left connector line */}
                    <div style={{ flex: 1, height: 2, background: i === 0 ? "transparent" : isPast || isActive ? "#1e3a8a" : "#e5e7eb" }} />

                    {/* Circle */}
                    <div style={{
                      width: 42, height: 42, borderRadius: "50%", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: isActive ? 18 : 14,
                      fontWeight: 700,
                      background: isActive ? "#1e3a8a" : isPast ? "#1e3a8a" : "#fff",
                      color: isActive ? "#fff" : isPast ? "#fff" : "#9ca3af",
                      border: isActive ? "none" : isPast ? "none" : "2px solid #d1d5db",
                      transition: "all 0.2s",
                      boxShadow: isActive ? "0 4px 12px rgba(30,58,138,0.3)" : "none",
                    }}>
                      {isPast ? "✓" : isActive ? step.icon : i + 1}
                    </div>

                    {/* Right connector line */}
                    <div style={{ flex: 1, height: 2, background: isPast ? "#1e3a8a" : "#e5e7eb" }} />
                  </div>

                  {/* Label */}
                  <div style={{
                    fontSize: 11,
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? "#1e3a8a" : isPast ? "#374151" : "#9ca3af",
                    marginTop: 8,
                    marginBottom: 12,
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                  }}>
                    {t(step.zh, step.en)}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active step indicator bar */}
          <div style={{ position: "relative", height: 3, maxWidth: 640, margin: "0 auto" }}>
            <div style={{
              position: "absolute",
              left: `${(activeStep / (STEPS.length - 1)) * 80 + 10}%`,
              width: "20%",
              height: "100%",
              background: "#1e3a8a",
              borderRadius: 2,
              transition: "left 0.3s ease",
            }} />
          </div>
        </div>
      </div>

      {/* Step content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 20px 60px" }}>

        {/* Step header */}
        <div style={{ marginBottom: 32, display: "flex", alignItems: "flex-start", gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "#1e3a8a",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, flexShrink: 0,
          }}>
            {STEPS[activeStep].icon}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a8a", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              {t(`第 ${activeStep + 1} 步 / 共 ${STEPS.length} 步`, `Step ${activeStep + 1} of ${STEPS.length}`)}
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 6px 0", lineHeight: 1.2 }}>
              {t(content.titleZh, content.titleEn)}
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.6 }}>
              {t(content.subtitleZh, content.subtitleEn)}
            </p>
          </div>
        </div>

        {/* Content sections */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          gap: 20,
          marginBottom: 40,
        }}>
          {content.sections.map((section, si) => (
            <div key={si} style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 16,
              padding: "24px 22px",
            }}>
              {/* Section header */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: section.iconBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  {section.icon}
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  {t(section.headingZh, section.headingEn)}
                </div>
              </div>

              {/* Items */}
              <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
                {section.items.map((item, ii) => (
                  <li key={ii} style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "8px 0",
                    borderTop: ii === 0 ? "none" : "1px solid #f3f4f6",
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: "50%",
                      background: "#1e3a8a", flexShrink: 0,
                      marginTop: 7,
                    }} />
                    <span style={{ fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                      {t(item.zh, item.en)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Prev / Next navigation */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => canPrev && setActiveStep(activeStep - 1)}
            style={{
              padding: "12px 24px",
              fontSize: 14, fontWeight: 600,
              color: canPrev ? "#1e3a8a" : "#d1d5db",
              background: "#fff",
              border: `1.5px solid ${canPrev ? "#1e3a8a" : "#e5e7eb"}`,
              borderRadius: 10,
              cursor: canPrev ? "pointer" : "not-allowed",
              transition: "all 0.15s",
            }}
          >
            ← {t("上一步", "Previous")}
          </button>

          {/* Step dots */}
          <div style={{ display: "flex", gap: 8 }}>
            {STEPS.map((_, i) => (
              <div
                key={i}
                onClick={() => setActiveStep(i)}
                style={{
                  width: i === activeStep ? 20 : 8,
                  height: 8, borderRadius: 4,
                  background: i === activeStep ? "#1e3a8a" : i < activeStep ? "#93c5fd" : "#e5e7eb",
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              />
            ))}
          </div>

          {canNext ? (
            <button
              onClick={() => setActiveStep(activeStep + 1)}
              style={{
                padding: "12px 24px",
                fontSize: 14, fontWeight: 600,
                color: "#fff",
                background: "#1e3a8a",
                border: "none",
                borderRadius: 10,
                cursor: "pointer",
                transition: "background 0.15s",
              }}
            >
              {t("下一步", "Next")} →
            </button>
          ) : (
            <Link href="/league" style={{
              padding: "12px 24px",
              fontSize: 14, fontWeight: 600,
              color: "#fff",
              background: "#059669",
              borderRadius: 10,
              textDecoration: "none",
              display: "inline-block",
            }}>
              {t("去参加联赛 →", "Join a League →")}
            </Link>
          )}
        </div>
      </div>

      {/* Xiaohongshu article section */}
      <div style={{
        background: "#fff",
        borderTop: "1px solid #e5e7eb",
        padding: "40px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 540, margin: "0 auto" }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>📕</div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 8px 0" }}>
            {t("想了解更多？", "Want to learn more?")}
          </h3>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 20px 0", lineHeight: 1.7 }}>
            {t(
              "我们在小红书上发布了一篇详细的新手入门攻略，包括选秀技巧、赛季管理和冠军策略，图文并茂，适合完全零基础的新玩家。",
              "We published a detailed beginner's guide on Xiaohongshu covering draft tips, season management, and championship strategy — illustrated and perfect for first-timers."
            )}
          </p>
          <a
            href="https://www.xiaohongshu.com/explore/69c348c90000000023004121?xsec_token=ABcBDvh3mFCRtTLg0fqlWpTFEHDi37bAWfAkBm7K-4nRg=&xsec_source=pc_user"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "13px 28px",
              fontSize: 15, fontWeight: 700,
              color: "#fff",
              background: "#ff2442",
              borderRadius: 12,
              textDecoration: "none",
              transition: "opacity 0.15s",
            }}
          >
            <span>📕</span>
            {t("在小红书查看完整攻略", "Read Full Guide on Xiaohongshu")}
          </a>
          <p style={{ fontSize: 12, color: "#9ca3af", margin: "12px 0 0 0" }}>
            {t("将在新标签页打开", "Opens in a new tab")}
          </p>
        </div>
      </div>

      {/* Bottom CTA */}
      <div style={{
        background: "#1e3a8a",
        padding: "48px 24px",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 500, margin: "0 auto" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🏆</div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 10px 0" }}>
            {t("准备好开始了吗？", "Ready to get started?")}
          </h3>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", margin: "0 0 24px 0", lineHeight: 1.7 }}>
            {t(
              "学以致用，先去模拟选秀练练手，或直接加入一个联赛开始你的冠军之旅。",
              "Put it into practice — try a mock draft to warm up, or jump straight into a league and start your championship run."
            )}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/mock-draft" style={{
              padding: "13px 28px",
              fontSize: 15, fontWeight: 700,
              color: "#1e3a8a",
              background: "#fff",
              borderRadius: 12,
              textDecoration: "none",
              display: "inline-block",
            }}>
              {t("模拟选秀", "Mock Draft")}
            </Link>
            <Link href="/league" style={{
              padding: "13px 28px",
              fontSize: 15, fontWeight: 700,
              color: "#fff",
              background: "rgba(255,255,255,0.15)",
              border: "1.5px solid rgba(255,255,255,0.4)",
              borderRadius: 12,
              textDecoration: "none",
              display: "inline-block",
            }}>
              {t("加入联赛", "Join a League")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
