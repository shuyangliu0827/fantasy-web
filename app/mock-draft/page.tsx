"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useLang } from "@/lib/lang";
import LightHeader from "@/components/LightHeader";
import { getPlayers, getSessionUser, createDraft, updateDraft, addDraftPick, listDrafts, Player, Draft } from "@/lib/store";


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
  const { t } = useLang();
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [draftStarted, setDraftStarted] = useState(false);
  const [currentDraft, setCurrentDraft] = useState<Draft | null>(null);
  const [myPicks, setMyPicks] = useState<Player[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [currentPick, setCurrentPick] = useState(1);
  const [myDrafts, setMyDrafts] = useState<Draft[]>([]);
  const [settings, setSettings] = useState<{ name: string; teams: number; position: number; rounds: number; type: "snake" | "linear" }>({ name: "Mock Draft", teams: 12, position: 6, rounds: 13, type: "snake" });
  const [searchQuery, setSearchQuery] = useState("");
  const [playerPage, setPlayerPage] = useState(1);
  const playerPageSize = 25;

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
    setPlayerPage(1);
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

  const totalPlayerPages = Math.ceil(filteredPlayers.length / playerPageSize);
  const paginatedPlayers = useMemo(() => filteredPlayers.slice(
    (playerPage - 1) * playerPageSize,
    playerPage * playerPageSize
  ), [filteredPlayers, playerPage]);

  useEffect(() => {
    if (playerPage > totalPlayerPages && totalPlayerPages > 0) setPlayerPage(totalPlayerPages);
  }, [totalPlayerPages, playerPage]);

  // ── Setup screen ──────────────────────────────────────────────────────────
  if (!draftStarted) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/mock-draft" />

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
                  color: "#fff", background: "#1e3a8a",
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
                {isMyPick() ? t(" 轮到你选了！", " Your Pick!") : t("⏳ AI 正在选择...", "⏳ AI Picking...")}
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
              onChange={e => { setSearchQuery(e.target.value); setPlayerPage(1); }}
              style={{ padding: "7px 12px", fontSize: 13, border: "1.5px solid #e5e7eb", borderRadius: 8, outline: "none", width: 180, color: "#111827" }}
            />
          </div>
          <div style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}>
            {paginatedPlayers.map(p => (
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

          {/* Pagination */}
          {totalPlayerPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "10px 16px", borderTop: "1px solid #f3f4f6", fontFamily: FONT }}>
              <button
                onClick={() => setPlayerPage(p => Math.max(1, p - 1))}
                disabled={playerPage === 1}
                style={{ padding: "6px 12px", fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: playerPage === 1 ? "not-allowed" : "pointer", color: playerPage === 1 ? "#d1d5db" : "#374151", fontFamily: FONT }}
              >
                ← {t("上一页", "Prev")}
              </button>
              {(() => {
                const start = Math.max(1, Math.min(playerPage - 2, totalPlayerPages - 4));
                const end = Math.min(totalPlayerPages, start + 4);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setPlayerPage(pageNum)}
                    style={{ width: 32, height: 32, fontSize: 12, fontWeight: pageNum === playerPage ? 700 : 400, background: pageNum === playerPage ? "#1e3a8a" : "#fff", color: pageNum === playerPage ? "#fff" : "#374151", border: pageNum === playerPage ? "none" : "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", fontFamily: FONT }}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPlayerPage(p => Math.min(totalPlayerPages, p + 1))}
                disabled={playerPage === totalPlayerPages}
                style={{ padding: "6px 12px", fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, cursor: playerPage === totalPlayerPages ? "not-allowed" : "pointer", color: playerPage === totalPlayerPages ? "#d1d5db" : "#374151", fontFamily: FONT }}
              >
                {t("下一页", "Next")} →
              </button>
            </div>
          )}
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
