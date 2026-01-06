"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { getPlayers, getSessionUser, createDraft, updateDraft, addDraftPick, getDraftPicks, listDrafts, Player, Draft } from "@/lib/store";

export default function MockDraftPage() {
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftStarted, setDraftStarted] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [myPicks, setMyPicks] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [myDrafts, setMyDrafts] = useState<Draft[]>([]);
  const [settings, setSettings] = useState({ name: "Mock Draft", teams: 12, position: 6, rounds: 13, type: "snake" as const });
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setUser(getSessionUser());
    setPlayers(getPlayers());
    setMyDrafts(listDrafts());
  }, []);

  const startDraft = () => {
    const allPlayers = getPlayers();
    setAvailablePlayers([...allPlayers]);
    
    if (user) {
      const result = createDraft({
        name: settings.name,
        type: settings.type,
        teams: settings.teams,
        rounds: settings.rounds,
        userPosition: settings.position
      });
      if (result.ok) {
        setCurrentDraft(result.draft);
      }
    }
    
    setDraftStarted(true);
    setCurrentPick(1);
    setMyPicks([]);
  };

  const isMyPick = () => {
    const round = Math.ceil(currentPick / settings.teams);
    const pickInRound = ((currentPick - 1) % settings.teams) + 1;
    
    if (settings.type === "snake") {
      if (round % 2 === 1) return pickInRound === settings.position;
      return pickInRound === (settings.teams - settings.position + 1);
    }
    return pickInRound === settings.position;
  };

  const handleDraft = (player: Player) => {
    if (!isMyPick()) return;
    
    setMyPicks([...myPicks, player]);
    setAvailablePlayers(availablePlayers.filter(p => p.id !== player.id));
    
    if (currentDraft) {
      addDraftPick(currentDraft.id, player.id, "user", Math.ceil(currentPick / settings.teams), currentPick);
    }
    
    simulateNextPicks();
  };

  const simulateNextPicks = () => {
    let nextPick = currentPick + 1;
    let newAvailable = [...availablePlayers];
    
    while (nextPick <= settings.teams * settings.rounds) {
      const round = Math.ceil(nextPick / settings.teams);
      const pickInRound = ((nextPick - 1) % settings.teams) + 1;
      
      let isUserPick = false;
      if (settings.type === "snake") {
        if (round % 2 === 1) isUserPick = pickInRound === settings.position;
        else isUserPick = pickInRound === (settings.teams - settings.position + 1);
      } else {
        isUserPick = pickInRound === settings.position;
      }
      
      if (isUserPick) {
        setCurrentPick(nextPick);
        setAvailablePlayers(newAvailable);
        return;
      }
      
      // AI picks best available
      if (newAvailable.length > 0) {
        const randomOffset = Math.floor(Math.random() * Math.min(3, newAvailable.length));
        newAvailable = newAvailable.filter((_, i) => i !== randomOffset);
      }
      nextPick++;
    }
    
    // Draft complete
    if (currentDraft) {
      updateDraft(currentDraft.id, { status: "completed", completedAt: Date.now() });
    }
    setCurrentPick(nextPick);
    setAvailablePlayers(newAvailable);
  };

  const isDraftComplete = currentPick > settings.teams * settings.rounds;

  if (!draftStarted) {
    return (
      <div className="app">
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="logo">
              <div className="logo-icon"><svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/><path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/><path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/></svg></div>
              <div className="logo-text"><span className="logo-title">蓝本</span><span className="logo-sub">Fantasy 篮球决策平台</span></div>
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
            <Link href="/how-to-play" className="nav-link">新手入门</Link>
            <Link href="/my-team" className="nav-link">我的球队</Link>
            <Link href="/mock-draft" className="nav-link active">模拟选秀</Link>
          </div>
        </nav>

        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">模拟选秀 Mock Draft</h1>
            <p className="page-desc">练习你的选秀策略，数据会自动保存</p>
          </div>

          <div className="draft-setup">
            <div className="setup-card">
              <h2>开始新的模拟选秀</h2>
              
              <div className="form-group">
                <label className="form-label">选秀名称</label>
                <input className="form-input" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} placeholder="Mock Draft" />
              </div>

              <div className="form-group">
                <label className="form-label">联赛人数</label>
                <select className="form-input" value={settings.teams} onChange={e => setSettings({...settings, teams: +e.target.value, position: Math.min(settings.position, +e.target.value)})}>
                  <option value={10}>10 队</option>
                  <option value={12}>12 队</option>
                  <option value={14}>14 队</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">你的选秀位置</label>
                <select className="form-input" value={settings.position} onChange={e => setSettings({...settings, position: +e.target.value})}>
                  {Array.from({length: settings.teams}, (_, i) => (
                    <option key={i} value={i + 1}>第 {i + 1} 顺位</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">选秀轮数</label>
                <select className="form-input" value={settings.rounds} onChange={e => setSettings({...settings, rounds: +e.target.value})}>
                  <option value={10}>10 轮</option>
                  <option value={13}>13 轮</option>
                  <option value={15}>15 轮</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">选秀类型</label>
                <select className="form-input" value={settings.type} onChange={e => setSettings({...settings, type: e.target.value as any})}>
                  <option value="snake">蛇形选秀 Snake</option>
                  <option value="linear">线性选秀 Linear</option>
                </select>
              </div>

              <button className="btn btn-primary btn-lg" onClick={startDraft} style={{ width: "100%", marginTop: 16 }}>
                开始选秀
              </button>
            </div>

            {myDrafts.length > 0 && (
              <div className="setup-card">
                <h3>历史选秀记录</h3>
                <div className="draft-history">
                  {myDrafts.slice(-5).reverse().map(d => (
                    <div key={d.id} className="history-item">
                      <span className="history-name">{d.name}</span>
                      <span className="history-info">{d.teams} 队 · {d.status === "completed" ? "已完成" : "进行中"}</span>
                      <span className="history-date">{new Date(d.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app draft-room">
      <header className="draft-header">
        <div className="draft-header-inner">
          <div className="draft-info">
            <h1>{settings.name}</h1>
            <span className="draft-status">
              {isDraftComplete ? "选秀完成！" : `第 ${Math.ceil(currentPick / settings.teams)} 轮 · 第 ${currentPick} 顺位`}
            </span>
          </div>
          <div className="draft-actions">
            {isDraftComplete ? (
              <Link href="/my-team" className="btn btn-primary">查看球队</Link>
            ) : (
              <span className={`pick-indicator ${isMyPick() ? "your-turn" : ""}`}>
                {isMyPick() ? "🎯 轮到你选了！" : "⏳ AI 正在选择..."}
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => { setDraftStarted(false); setMyDrafts(listDrafts()); }}>退出</button>
          </div>
        </div>
      </header>

      <div className="draft-main">
        <div className="draft-board">
          <div className="board-header">
            <h2>可选球员</h2>
            <span>{availablePlayers.length} 人可选</span>
          </div>
          <div className="player-grid">
            {availablePlayers.slice(0, 50).map(p => (
              <div 
                key={p.id} 
                className={`draft-player ${isMyPick() ? "selectable" : "disabled"}`}
                onClick={() => isMyPick() && handleDraft(p)}
              >
                <span className="draft-rank">#{p.rank}</span>
                <div className="draft-player-info">
                  <span className="draft-player-name">{p.name}</span>
                  <span className="draft-player-meta">{p.team} · {p.position}</span>
                </div>
                <div className="draft-player-stats">
                  <span>{p.ppg} PPG</span>
                  <span>{p.rpg} RPG</span>
                  <span>{p.apg} APG</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="my-team-panel">
          <div className="panel-header">
            <h2>我的球队</h2>
            <span>{myPicks.length} / {settings.rounds} 人</span>
          </div>
          <div className="my-picks">
            {myPicks.length === 0 ? (
              <div className="empty-picks">等待选秀开始...</div>
            ) : (
              myPicks.map((p, i) => (
                <div key={p.id} className="my-pick-item">
                  <span className="pick-round">Rd {i + 1}</span>
                  <span className="pick-name">{p.name}</span>
                  <span className="pick-pos">{p.position}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
