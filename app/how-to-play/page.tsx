"use client";

import Link from "next/link";
import { useState } from "react";

const steps = [
  {
    id: 1,
    title: "创建或加入联赛",
    titleEn: "Create or Join a League",
    icon: "🏀",
    content: `第一步是找到一个联赛加入，或者创建你自己的联赛。

**公共联赛**: 在"加入公共联赛"页面可以找到开放的联赛
**私人联赛**: 创建私人联赛，邀请你的朋友一起玩
**联赛设置**: 选择联赛人数（8-14人）、计分方式、选秀日期等`,
    tips: ["新手建议先加入 10-12 人的联赛", "H2H Categories 是最常见的计分方式", "选秀日期最好选在 NBA 赛季开始前 1-2 周"]
  },
  {
    id: 2,
    title: "选秀准备",
    titleEn: "Prepare for Draft",
    icon: "📋",
    content: `选秀是 Fantasy 篮球最重要的环节！在选秀前做好准备：

**研究球员排名**: 查看我们的球员排名页面，了解每个球员的价值
**建立关注列表**: 标记你喜欢的球员，选秀时更容易找到
**学习策略**: 阅读选秀指南，了解不同轮次的选人策略
**模拟选秀**: 在正式选秀前多做几次模拟选秀练习`,
    tips: ["至少做 3-5 次模拟选秀", "准备一份 Cheat Sheet（备忘单）", "了解你的选秀位置，制定相应策略"]
  },
  {
    id: 3,
    title: "参加选秀",
    titleEn: "Join the Draft",
    icon: "🎯",
    content: `选秀当天，按照你的准备来选择球员：

**蛇形选秀**: 按顺序轮流选人，选秀顺序每轮反转
**拍卖选秀**: 用虚拟货币竞拍球员，需要预算管理
**选秀时间**: 每轮通常有 60-90 秒选人时间

**选人优先级**:
1. 前三轮选稳定的球星
2. 中间轮次找价值洼地
3. 后轮补充位置需求`,
    tips: ["不要慌，60秒够用了", "如果你喜欢的球员被选走，看下一个", "注意平衡各个位置"]
  },
  {
    id: 4,
    title: "管理阵容",
    titleEn: "Manage Your Roster",
    icon: "📊",
    content: `赛季开始后，每天/每周管理你的阵容：

**设置首发**: 每天把要比赛的球员放到首发位置
**关注伤病**: 受伤球员放到 IR 位，从弃用区找替补
**弃用区淘金**: 关注近期表现好的弃用区球员
**交易**: 与其他玩家交易，补强你的弱项`,
    tips: ["养成每天看阵容的习惯", "关注"流式球员"策略", "不要因为一两周的表现就放弃球员"]
  },
  {
    id: 5,
    title: "每周对决",
    titleEn: "Weekly Matchups",
    icon: "⚔️",
    content: `大多数联赛采用每周对决制：

**H2H Categories**: 每周比拼各项数据类别，赢的类别多的人获胜
**H2H Points**: 每周比总得分
**Rotisserie**: 全赛季累计排名

**获胜技巧**:
- 关注对手的阵容构成
- 在自己的强项类别巩固优势
- 在接近的类别尝试反超`,
    tips: ["每周初期就设置好阵容", "周末多场比赛，确保首发满的", "关注对手的 streaming 策略"]
  }
];

export default function HowToPlayPage() {
  const [activeStep, setActiveStep] = useState(1);
  const currentStep = steps.find(s => s.id === activeStep) || steps[0];

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-title">蓝本</span>
              <span className="logo-sub">Fantasy 篮球决策平台</span>
            </div>
          </Link>
          <Link href="/" className="btn btn-ghost">← 返回首页</Link>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          <Link href="/" className="nav-link">首页</Link>
          <Link href="/rankings" className="nav-link">球员排名</Link>
          <Link href="/draft-guide" className="nav-link">选秀指南</Link>
          <Link href="/cheat-sheet" className="nav-link">备忘单</Link>
          <Link href="/how-to-play" className="nav-link active">新手入门</Link>
          <Link href="/my-team" className="nav-link">我的球队</Link>
          <Link href="/mock-draft" className="nav-link">模拟选秀</Link>
        </div>
      </nav>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">新手入门 How To Play</h1>
          <p className="page-desc">5 步带你玩转 Fantasy 篮球</p>
        </div>

        {/* Progress Bar */}
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

        {/* Current Step Content */}
        <div className="step-content">
          <div className="step-header">
            <span className="step-badge">Step {currentStep.id}</span>
            <h2 className="step-title">{currentStep.title}</h2>
            <p className="step-subtitle">{currentStep.titleEn}</p>
          </div>

          <div className="step-body">
            {currentStep.content.split('\n\n').map((para, i) => (
              <p key={i} dangerouslySetInnerHTML={{ 
                __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
              }} />
            ))}
          </div>

          <div className="step-tips">
            <h4>💡 小贴士</h4>
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
              ← 上一步
            </button>
            {activeStep < 5 ? (
              <button 
                className="btn btn-primary"
                onClick={() => setActiveStep(activeStep + 1)}
              >
                下一步 →
              </button>
            ) : (
              <Link href="/mock-draft" className="btn btn-primary">
                开始模拟选秀 →
              </Link>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="quick-links">
          <h3>相关页面</h3>
          <div className="links-grid">
            <Link href="/rankings" className="quick-link-card">
              <span className="quick-link-icon">📊</span>
              <span className="quick-link-title">球员排名</span>
              <span className="quick-link-desc">查看完整球员排名</span>
            </Link>
            <Link href="/draft-guide" className="quick-link-card">
              <span className="quick-link-icon">📖</span>
              <span className="quick-link-title">选秀指南</span>
              <span className="quick-link-desc">深入了解选秀策略</span>
            </Link>
            <Link href="/mock-draft" className="quick-link-card">
              <span className="quick-link-icon">🎯</span>
              <span className="quick-link-title">模拟选秀</span>
              <span className="quick-link-desc">练习你的选秀技巧</span>
            </Link>
            <Link href="/cheat-sheet" className="quick-link-card">
              <span className="quick-link-icon">📋</span>
              <span className="quick-link-title">选秀备忘单</span>
              <span className="quick-link-desc">选秀时的快速参考</span>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
