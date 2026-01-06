"use client";

import Link from "next/link";
import { useState } from "react";

const guides = [
  {
    id: "basics",
    title: "Fantasy 篮球基础",
    titleEn: "Fantasy Basketball Basics",
    sections: [
      {
        heading: "什么是 Fantasy 篮球？",
        content: `Fantasy 篮球是一种虚拟体育游戏，你可以组建一支由真实 NBA 球员组成的虚拟球队。球员在真实比赛中的表现会转化为你的 Fantasy 得分。

你的目标是通过选秀、交易、阵容调整等方式，打造最强的 Fantasy 球队。`
      },
      {
        heading: "基本规则",
        content: `1. **选秀 (Draft)**: 每个联赛开始前，所有玩家轮流选择球员组建初始阵容
2. **阵容设置**: 每天设置你的首发阵容，只有首发球员才能获得得分
3. **交易 & 弃用**: 赛季期间可以和其他玩家交易，或从弃用区捡人
4. **每周对决**: 与联赛中其他玩家进行数据比拼`
      },
      {
        heading: "计分方式",
        content: `常见的计分类别包括：
- **得分 (PTS)**: 球员得分
- **篮板 (REB)**: 进攻+防守篮板
- **助攻 (AST)**: 传球助攻
- **抢断 (STL)**: 断球
- **盖帽 (BLK)**: 封盖
- **三分球 (3PM)**: 三分命中数
- **投篮命中率 (FG%)**: 投篮准确度
- **罚球命中率 (FT%)**: 罚球准确度
- **失误 (TO)**: 负面数据，越少越好`
      }
    ]
  },
  {
    id: "draft-strategy",
    title: "选秀策略",
    titleEn: "Draft Strategy",
    sections: [
      {
        heading: "前三轮：稳定是王道",
        content: `前三轮选秀是你球队的基石。这几轮要优先选择：
- **稳定出场的球星**: 避免伤病历史严重的球员
- **全能型球员**: 能在多个类别贡献的球员价值更高
- **高使用率球员**: 球队核心通常更稳定`
      },
      {
        heading: "中轮策略：找价值洼地",
        content: `第 4-8 轮是找"便宜货"的关键：
- **年轻新星**: 有突破潜力的二三年级球员
- **换队球员**: 去到更好位置的球员可能爆发
- **伤愈归来**: 低 ADP 的伤愈球员可能超值`
      }
    ]
  },
  {
    id: "punting",
    title: "Punting 策略",
    titleEn: "Punting Strategy",
    sections: [
      {
        heading: "什么是 Punting？",
        content: `Punting 是一种进阶策略：故意放弃 1-2 个计分类别，集中资源在其他类别取得优势。

例如：Punt FT%（放弃罚球命中率）可以让你放心选择 Giannis、Zion 这类低罚球但其他数据爆炸的球员。`
      },
      {
        heading: "常见 Punt 组合",
        content: `**Punt 助攻 (AST)** - 适合锋线为主的阵容
**Punt 篮板 (REB)** - 适合后卫为主的阵容
**Punt 三分 (3PM)** - 适合内线+切入型球员
**Punt 罚球 (FT%)** - 适合低罚球命中率球员`
      }
    ]
  }
];

export default function DraftGuidePage() {
  const [activeGuide, setActiveGuide] = useState(guides[0].id);
  const currentGuide = guides.find(g => g.id === activeGuide) || guides[0];

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
          <Link href="/draft-guide" className="nav-link active">选秀指南</Link>
          <Link href="/cheat-sheet" className="nav-link">备忘单</Link>
          <Link href="/how-to-play" className="nav-link">新手入门</Link>
          <Link href="/my-team" className="nav-link">我的球队</Link>
          <Link href="/mock-draft" className="nav-link">模拟选秀</Link>
        </div>
      </nav>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">选秀指南 Draft Guide</h1>
          <p className="page-desc">从新手到高手的完整 Fantasy 篮球攻略</p>
        </div>

        <div className="guide-layout">
          <aside className="guide-sidebar">
            <h3 className="sidebar-title">目录</h3>
            {guides.map(guide => (
              <button
                key={guide.id}
                className={`guide-nav-item ${activeGuide === guide.id ? "active" : ""}`}
                onClick={() => setActiveGuide(guide.id)}
              >
                <span className="guide-nav-title">{guide.title}</span>
                <span className="guide-nav-subtitle">{guide.titleEn}</span>
              </button>
            ))}
          </aside>

          <article className="guide-content">
            <h2 className="guide-main-title">{currentGuide.title}</h2>
            <p className="guide-main-subtitle">{currentGuide.titleEn}</p>

            {currentGuide.sections.map((section, idx) => (
              <section key={idx} className="guide-section">
                <h3 className="guide-section-title">{section.heading}</h3>
                <div className="guide-section-content">
                  {section.content.split('\n\n').map((para, i) => (
                    <p key={i} dangerouslySetInnerHTML={{ 
                      __html: para.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')
                    }} />
                  ))}
                </div>
              </section>
            ))}

            <div className="guide-cta">
              <p>准备好开始了吗？</p>
              <div className="guide-cta-buttons">
                <Link href="/mock-draft" className="btn btn-primary">开始模拟选秀</Link>
                <Link href="/rankings" className="btn btn-ghost">查看球员排名</Link>
              </div>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
