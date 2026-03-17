"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang";
import { getPlayers, getSessionUser, createDraft, updateDraft, addDraftPick, listDrafts, Player, Draft } from "@/lib/store";

const NAV = [
  { href: "/", zh: "首页", en: "Home" },
  { href: "/rankings", zh: "球员排名", en: "Rankings" },
  { href: "/league", zh: "公开联赛", en: "Leagues" },
  { href: "/compare", zh: "球员对比", en: "Compare" },
  { href: "/draft-guide", zh: "选秀指南", en: "Draft Guide" },
  { href: "/cheat-sheet", zh: "备忘单", en: "Cheat Sheet" },
  { href: "/how-to-play", zh: "新手入门", en: "How To Play" },
  { href: "/mock-draft", zh: "模拟选秀", en: "Mock Draft", active: true },
];

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 13px", fontSize: 14,
  border: "1.5px solid #e5e7eb", borderRadius: 9, outline: "none",
  color: "#111827", background: "#fff", boxSizing: "border-box",
  appearance: "none" as const,
};

export default function MockDraftPage() {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [draftStarted, setDraftStarted] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [myPicks, setMyPicks] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [myDrafts, setMyDrafts] = useState<Draft[]>([]);
  const [settings, setSettings] = useState({ name: "Mock Draft", teams: 12, position: 6, rounds: 13, type: "snake" as const });
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setUser(getSessionUser());
    setMyDrafts(listDrafts());
  }, []);

  const startDraft = () => {
    const allPlayers = getPlayers();
    setAvailablePlayers([...allPlayers]);
    if (user) {
      const result = createDraft({ name: settings.name, type: settings.type, teams: settings.teams, rounds: settings.rounds, userPosition: settings.position });
      if (result.ok) setCurrentDraft(result.draft);
    }
    setDraftStarted(true);
    setCurrentPick(1);
    setMyPicks([]);
    setSearchQuery("");
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
    if (currentDraft) addDraftPick(currentDraft.id, player.id, "user", Math.ceil(currentPick / settings.teams), currentPick);
    simulateNextPicks();
  };

  const simulateNextPicks = () => {
    let nextPick = currentPick + 1;
    let newAvailable = [...availablePlayers];
    while (nextPick <= settings.teams * settings.rounds) {
      const round = Math.ceil(nextPick / settings.teams);
      const pickInRound = ((nextPick - 1) % settings.teams) + 1;
      let isUserPick = settings.type === "snake"
        ? (round % 2 === 1 ? pickInRound === settings.position : pickInRound === (settings.teams - settings.position + 1))
        : pickInRound === settings.position;
      if (isUserPick) { setCurrentPick(nextPick); setAvailablePlayers(newAvailable); return; }
      if (newAvailable.length > 0) {
        const randomOffset = Math.floor(Math.random() * Math.min(3, newAvailable.length));
        newAvailable = newAvailable.filter((_, i) => i !== randomOffset);
      }
      nextPick++;
    }
    if (currentDraft) updateDraft(currentDraft.id, { status: "completed", completedAt: Date.now() });
    setCurrentPick(nextPick);
    setAvailablePlayers(newAvailable);
  };

  const isDraftComplete = currentPick > settings.teams * settings.rounds;
  const currentRound = Math.ceil(currentPick / settings.teams);
  const filteredPlayers = availablePlayers.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.team?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!draftStarted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        {/* Header */}
        <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px", height: 60, display: "flex", alignItems: "center", gap: 40 }}>
            <Link href="/" style={{ textDecoration: "none", flexShrink: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: "#1e3a8a" }}>蓝本·</span>
            </Link>
            <nav style={{ display: "flex", alignItems: "center", gap: 2, flex: 1, overflow: "hidden" }}>
              {NAV.map(item => (
                <Link key={item.href} href={item.href} style={{
                  padding: "6px 12px", fontSize: 13, fontWeight: item.active ? 600 : 400,
                  color: item.active ? "#1e3a8a" : "#6b7280", textDecoration: "none",
                  borderBottom: item.active ? "2px solid #f59e0b" : "2px solid transparent",
                  whiteSpace: "nowrap",
                }}>
                  {t(item.zh, item.en)}
                </Link>
              ))}
            </nav>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <button onClick={() => setLang(lang === "zh" ? "en" : "zh")} style={{ padding: "5px 11px", fontSize: 13, color: "#4b5563", background: "#f3f4f6", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
                中 / EN
              </button>
              {user ? (
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 500 }}>@{user.username}</span>
              ) : (
                <>
                  <Link href="/auth/login" style={{ padding: "6px 14px", fontSize: 13, fontWeight: 500, color: "#374151", textDecoration: "none", border: "1.5px solid #e5e7eb", borderRadius: 7 }}>{t("登录", "Login")}</Link>
                  <Link href="/auth/signup" style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, color: "#fff", textDecoration: "none", background: "#1e3a8a", borderRadius: 7 }}>{t("注册", "Sign Up")}</Link>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <div style={{ maxWidth: 960, margin: "0 auto", padding: "48px 32px" }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111827", margin: "0 0 6px 0" }}>{t("模拟选秀", "Mock Draft")}</h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 36px 0" }}>{t("练习你的选秀策略，数据会自动保存", "Practice your draft strategy. Data saves automatically.")}</p>

          <div style={{ display: "grid", gridTemplateColumns: myDrafts.length > 0 ? "1fr 1fr" : "1fr", gap: 24 }}>
            {/* Setup card */}
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 28px" }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 24px 0" }}>{t("开始新的模拟选秀", "Start New Mock Draft")}</h2>

              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                <div>
                  <label style={labelStyle}>{t("选秀名称", "Draft Name")}</label>
                  <input style={inputStyle} value={settings.name} onChange={e => setSettings({ ...settings, name: e.target.value })} placeholder="Mock Draft"
                    onFocus={e => (e.currentTarget.style.borderColor = "#f59e0b")}
                    onBlur={e => (e.currentTarget.style.borderColor = "#e5e7eb")} />
                </div>

                <div>
                  <label style={labelStyle}>{t("联赛人数", "Number of Teams")}</label>
                  <select style={inputStyle} value={settings.teams} onChange={e => setSettings({ ...settings, teams: +e.target.value, position: Math.min(settings.position, +e.target.value) })}>
                    <option value={10}>10 {t("队", "Teams")}</option>
                    <option value={12}>12 {t("队", "Teams")}</option>
                    <option value={14}>14 {t("队", "Teams")}</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{t("你的选秀位置", "Your Draft Position")}</label>
                  <select style={inputStyle} value={settings.position} onChange={e => setSettings({ ...settings, position: +e.target.value })}>
                    {Array.from({ length: settings.teams }, (_, i) => (
                      <option key={i} value={i + 1}>{t(`第 ${i + 1} 顺位`, `Pick #${i + 1}`)}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{t("选秀轮数", "Number of Rounds")}</label>
                  <select style={inputStyle} value={settings.rounds} onChange={e => setSettings({ ...settings, rounds: +e.target.value })}>
                    <option value={10}>10 {t("轮", "Rounds")}</option>
                    <option value={13}>13 {t("轮", "Rounds")}</option>
                    <option value={15}>15 {t("轮", "Rounds")}</option>
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>{t("选秀类型", "Draft Type")}</label>
                  <select style={inputStyle} value={settings.type} onChange={e => setSettings({ ...settings, type: e.target.value as "snake" | "linear" })}>
                    <option value="snake">{t("蛇形选秀", "Snake Draft")}</option>
                    <option value="linear">{t("线性选秀", "Linear Draft")}</option>
                  </select>
                </div>

                <button onClick={startDraft} style={{
                  width: "100%", padding: "13px", fontSize: 15, fontWeight: 700,
                  color: "#fff", background: "linear-gradient(90deg, #f59e0b, #f97316)",
                  border: "none", borderRadius: 10, cursor: "pointer", marginTop: 4,
                }}>
                  {t("开始选秀", "Start Draft")}
                </button>
              </div>
            </div>

            {/* Draft history */}
            {myDrafts.length > 0 && (
              <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 28px" }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: "0 0 20px 0" }}>{t("历史选秀记录", "Draft History")}</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {myDrafts.slice(-5).reverse().map(d => (
                    <div key={d.id} style={{ padding: "12px 14px", background: "#f9fafb", borderRadius: 9, border: "1px solid #f3f4f6" }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 3 }}>{d.name}</div>
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        {d.teams} {t("队", "teams")} · {d.status === "completed" ? t("已完成", "Completed") : t("进行中", "In Progress")} · {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Draft room ────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT, display: "flex", flexDirection: "column" }}>
      {/* Draft header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link href="/" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#1e3a8a" }}>蓝本·</span>
            </Link>
            <div style={{ width: 1, height: 20, background: "#e5e7eb" }} />
            <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{settings.name}</span>
            {!isDraftComplete && (
              <span style={{ fontSize: 13, color: "#6b7280", background: "#f3f4f6", padding: "3px 10px", borderRadius: 20 }}>
                {t(`第 ${currentRound} 轮 · 第 ${currentPick} 顺位`, `Round ${currentRound} · Pick ${currentPick}`)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {isDraftComplete ? (
              <Link href="/my-team" style={{ padding: "8px 20px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(90deg,#f59e0b,#f97316)", borderRadius: 8, textDecoration: "none" }}>
                {t("查看球队", "View Team")}
              </Link>
            ) : (
              <span style={{
                padding: "7px 16px", fontSize: 13, fontWeight: 700, borderRadius: 20,
                background: isMyPick() ? "#fef3c7" : "#f3f4f6",
                color: isMyPick() ? "#92400e" : "#6b7280",
              }}>
                {isMyPick() ? t("🎯 轮到你选了！", "🎯 Your Pick!") : t("⏳ AI 正在选择...", "⏳ AI Picking...")}
              </span>
            )}
            <button onClick={() => { setDraftStarted(false); setMyDrafts(listDrafts()); }} style={{ padding: "7px 16px", fontSize: 13, fontWeight: 500, color: "#6b7280", background: "#fff", border: "1.5px solid #e5e7eb", borderRadius: 8, cursor: "pointer" }}>
              {t("退出", "Exit")}
            </button>
          </div>
        </div>
      </header>

      {/* Draft body */}
      <div style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "24px", display: "flex", gap: 20, alignItems: "flex-start" }}>

        {/* Available players */}
        <div style={{ flex: 1, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>{t("可选球员", "Available Players")}</span>
              <span style={{ marginLeft: 10, fontSize: 13, color: "#9ca3af" }}>{availablePlayers.length} {t("人", "left")}</span>
            </div>
            <input
              placeholder={t("搜索球员...", "Search players...")}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ padding: "7px 12px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 8, outline: "none", width: 180, color: "#111827" }}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            {filteredPlayers.slice(0, 60).map(p => (
              <div
                key={p.id}
                onClick={() => isMyPick() && !isDraftComplete && handleDraft(p)}
                style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "12px 20px", borderBottom: "1px solid #f9fafb",
                  cursor: isMyPick() && !isDraftComplete ? "pointer" : "default",
                  background: "#fff",
                  transition: "background 0.1s",
                }}
                onMouseEnter={e => { if (isMyPick() && !isDraftComplete) e.currentTarget.style.background = "#fffbeb"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#fff"; }}
              >
                <div style={{ width: 28, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#9ca3af" }}>#{p.rank}</div>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#2563eb",
                }}>
                  {p.position}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: "#9ca3af" }}>{p.team}</div>
                </div>
                <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                  {[["PPG", p.ppg], ["RPG", p.rpg], ["APG", p.apg]].map(([label, val]) => (
                    <div key={label as string} style={{ textAlign: "center", minWidth: 36 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{val}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{label}</div>
                    </div>
                  ))}
                </div>
                {isMyPick() && !isDraftComplete && (
                  <div style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", flexShrink: 0 }}>{t("选择", "Pick")}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* My team panel */}
        <div style={{ width: 260, flexShrink: 0, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 18px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{t("我的球队", "My Team")}</span>
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{myPicks.length} / {settings.rounds}</span>
          </div>
          <div style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            {myPicks.length === 0 ? (
              <div style={{ padding: "32px 18px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>{t("等待选秀开始...", "Make your first pick!")}</div>
            ) : (
              myPicks.map((p, i) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 18px", borderBottom: "1px solid #f9fafb" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{p.position} · {p.team}</div>
                  </div>
                </div>
              ))
            )}
            {isDraftComplete && (
              <div style={{ padding: "16px 18px", borderTop: "1px solid #f3f4f6" }}>
                <Link href="/my-team" style={{ display: "block", textAlign: "center", padding: "10px", fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(90deg,#f59e0b,#f97316)", borderRadius: 8, textDecoration: "none" }}>
                  {t("查看球队", "View Team")}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
