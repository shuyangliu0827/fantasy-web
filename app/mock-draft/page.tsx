"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getPlayers, getSessionUser, createDraft, updateDraft, addDraftPick, listDrafts, Player, Draft } from "@/lib/store";

export default function MockDraftPage() {
  const { t } = useLang();
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftStarted, setDraftStarted] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [myPicks, setMyPicks] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [myDrafts, setMyDrafts] = useState<Draft[]>([]);
  const [settings, setSettings] = useState({ name: "Mock Draft", teams: 12, position: 6, rounds: 13, type: "snake" as const });

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
      
      if (newAvailable.length > 0) {
        const randomOffset = Math.floor(Math.random() * Math.min(3, newAvailable.length));
        newAvailable = newAvailable.filter((_, i) => i !== randomOffset);
      }
      nextPick++;
    }
    
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
        <Header />

        <main className="page-content">
          <div className="page-header">
            <h1 className="page-title">{t("模拟选秀", "Mock Draft")}</h1>
            <p className="page-desc">{t("练习你的选秀策略，数据会自动保存", "Practice your draft strategy. Data saves automatically")}</p>
          </div>

          <div className="draft-setup">
            <div className="setup-card">
              <h2>{t("开始新的模拟选秀", "Start New Mock Draft")}</h2>
              
              <div className="form-group">
                <label className="form-label">{t("选秀名称", "Draft Name")}</label>
                <input className="form-input" value={settings.name} onChange={e => setSettings({...settings, name: e.target.value})} placeholder="Mock Draft" />
              </div>

              <div className="form-group">
                <label className="form-label">{t("联赛人数", "Number of Teams")}</label>
                <select className="form-input" value={settings.teams} onChange={e => setSettings({...settings, teams: +e.target.value, position: Math.min(settings.position, +e.target.value)})}>
                  <option value={10}>10 {t("队", "Teams")}</option>
                  <option value={12}>12 {t("队", "Teams")}</option>
                  <option value={14}>14 {t("队", "Teams")}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t("你的选秀位置", "Your Draft Position")}</label>
                <select className="form-input" value={settings.position} onChange={e => setSettings({...settings, position: +e.target.value})}>
                  {Array.from({length: settings.teams}, (_, i) => (
                    <option key={i} value={i + 1}>{t(`第 ${i + 1} 顺位`, `Pick #${i + 1}`)}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t("选秀轮数", "Number of Rounds")}</label>
                <select className="form-input" value={settings.rounds} onChange={e => setSettings({...settings, rounds: +e.target.value})}>
                  <option value={10}>10 {t("轮", "Rounds")}</option>
                  <option value={13}>13 {t("轮", "Rounds")}</option>
                  <option value={15}>15 {t("轮", "Rounds")}</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">{t("选秀类型", "Draft Type")}</label>
                <select className="form-input" value={settings.type} onChange={e => setSettings({...settings, type: e.target.value as any})}>
                  <option value="snake">{t("蛇形选秀", "Snake Draft")}</option>
                  <option value="linear">{t("线性选秀", "Linear Draft")}</option>
                </select>
              </div>

              <button className="btn btn-primary btn-lg" onClick={startDraft} style={{ width: "100%", marginTop: 16 }}>
                {t("开始选秀", "Start Draft")}
              </button>
            </div>

            {myDrafts.length > 0 && (
              <div className="setup-card">
                <h3>{t("历史选秀记录", "Draft History")}</h3>
                <div className="draft-history">
                  {myDrafts.slice(-5).reverse().map(d => (
                    <div key={d.id} className="history-item">
                      <span className="history-name">{d.name}</span>
                      <span className="history-info">{d.teams} {t("队", "teams")} · {d.status === "completed" ? t("已完成", "Completed") : t("进行中", "In Progress")}</span>
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
              {isDraftComplete ? t("选秀完成！", "Draft Complete!") : t(`第 ${Math.ceil(currentPick / settings.teams)} 轮 · 第 ${currentPick} 顺位`, `Round ${Math.ceil(currentPick / settings.teams)} · Pick ${currentPick}`)}
            </span>
          </div>
          <div className="draft-actions">
            {isDraftComplete ? (
              <Link href="/my-team" className="btn btn-primary">{t("查看球队", "View Team")}</Link>
            ) : (
              <span className={`pick-indicator ${isMyPick() ? "your-turn" : ""}`}>
                {isMyPick() ? t("🎯 轮到你选了！", "🎯 Your Pick!") : t("⏳ AI 正在选择...", "⏳ AI is picking...")}
              </span>
            )}
            <button className="btn btn-ghost" onClick={() => { setDraftStarted(false); setMyDrafts(listDrafts()); }}>{t("退出", "Exit")}</button>
          </div>
        </div>
      </header>

      <div className="draft-main">
        <div className="draft-board">
          <div className="board-header">
            <h2>{t("可选球员", "Available Players")}</h2>
            <span>{availablePlayers.length} {t("人可选", "available")}</span>
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
            <h2>{t("我的球队", "My Team")}</h2>
            <span>{myPicks.length} / {settings.rounds}</span>
          </div>
          <div className="my-picks">
            {myPicks.length === 0 ? (
              <div className="empty-picks">{t("等待选秀开始...", "Waiting for draft to start...")}</div>
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
