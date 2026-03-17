"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { getSessionUser, getMyTeams, createMyTeam, getPlayers, addPlayerToTeam, removePlayerFromTeam, getPlayerById, MyTeam, Player } from "@/lib/store";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const POS_CONFIG: Record<string, { labelZh: string; labelEn: string; textColor: string; bgColor: string }> = {
  G: { labelZh: "G  后卫", labelEn: "G  Guard", textColor: "#1e3a8a", bgColor: "#dbeafe" },
  F: { labelZh: "F  前锋", labelEn: "F  Forward", textColor: "#c2410c", bgColor: "#fff7ed" },
  C: { labelZh: "C  中锋", labelEn: "C  Center", textColor: "#7c3aed", bgColor: "#ede9fe" },
};

const WEEK_BARS = [42, 55, 38, 61, 52, 48, 70, 65, 58, 44, 63, 55];
const WEEK_LABELS = ["W1","W2","W3","W4","W5","W6","W7","W8","W9","W10","W11","W12"];

const WAIVER = [
  { nameZh: "达里斯·加兰", nameEn: "Darius Garland", team: "CLE", ppg: 21.4, pos: "G" },
  { nameZh: "斯科蒂·巴恩斯", nameEn: "Scottie Barnes", team: "TOR", ppg: 19.8, pos: "F" },
  { nameZh: "祖巴茨", nameEn: "Ivica Zubac", team: "LAC", ppg: 13.2, pos: "C" },
];

const STANDINGS = [
  { rank: 1, nameZh: "张三队", nameEn: "Team Zhang", pts: 412 },
  { rank: 2, nameZh: "李四联队", nameEn: "Team Li", pts: 398 },
  { rank: 3, nameZh: "湾区猛虎", nameEn: "Bay Area Tigers", pts: 387, isMe: true },
  { rank: 4, nameZh: "东区霸主", nameEn: "East Dominator", pts: 371 },
  { rank: 5, nameZh: "金州勇士迷", nameEn: "GSW Fan", pts: 356 },
];

const TRENDS = [
  { zh: "▲ 热手", en: "▲ Hot", color: "#15803d", bg: "#dcfce7" },
  { zh: "▼ 疲软", en: "▼ Slump", color: "#dc2626", bg: "#fee2e2" },
  { zh: "▲ 正常", en: "▲ Normal", color: "#1d4ed8", bg: "#dbeafe" },
  { zh: "▲ 三双", en: "▲ Triple-Dbl", color: "#7c3aed", bg: "#ede9fe" },
];

function mockFPTS(rank: number): number {
  return Math.max(8, Math.round(55 - (rank || 50) * 0.4 + Math.random() * 10));
}

export default function MyTeamPage() {
  const { t } = useLang();
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [teams, setTeams] = useState<MyTeam[]>([]);
  const [activeTeam, setActiveTeam] = useState<MyTeam | null>(null);
  const [teamPlayers, setTeamPlayers] = useState<Player[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [showAddPlayer, setShowAddPlayer] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    setUser(u);
    if (u) {
      const myTeams = getMyTeams();
      setTeams(myTeams);
      if (myTeams.length > 0) { setActiveTeam(myTeams[0]); loadTeamPlayers(myTeams[0]); }
    }
    setAllPlayers(getPlayers());
  }, []);

  const loadTeamPlayers = (team: MyTeam) => {
    const players = team.players.map(id => getPlayerById(id)).filter(Boolean) as Player[];
    setTeamPlayers(players);
  };

  const handleCreateTeam = () => {
    if (!newTeamName.trim()) return;
    const result = createMyTeam("default", newTeamName);
    if (result.ok) {
      setTeams([...teams, result.team]);
      setActiveTeam(result.team);
      setTeamPlayers([]);
      setNewTeamName("");
      setShowCreateTeam(false);
    }
  };

  const handleAddPlayer = (player: Player) => {
    if (!activeTeam) return;
    addPlayerToTeam(activeTeam.id, player.id);
    const updated = { ...activeTeam, players: [...activeTeam.players, player.id] };
    setActiveTeam(updated);
    setTeamPlayers([...teamPlayers, player]);
    setTeams(teams.map(tm => tm.id === updated.id ? updated : tm));
    setShowAddPlayer(false);
  };

  const handleRemovePlayer = (playerId: string) => {
    if (!activeTeam) return;
    removePlayerFromTeam(activeTeam.id, playerId);
    const updated = { ...activeTeam, players: activeTeam.players.filter(id => id !== playerId) };
    setActiveTeam(updated);
    setTeamPlayers(teamPlayers.filter(p => p.id !== playerId));
    setTeams(teams.map(tm => tm.id === updated.id ? updated : tm));
  };

  const availablePlayers = allPlayers.filter(
    p => !activeTeam?.players.includes(p.id) && p.name.toLowerCase().includes(playerSearch.toLowerCase())
  );

  const playersByPos: Record<string, Player[]> = { G: [], F: [], C: [] };
  teamPlayers.forEach(p => {
    const pos = p.position as string;
    if (pos === "G") playersByPos.G.push(p);
    else if (pos === "F") playersByPos.F.push(p);
    else playersByPos.C.push(p);
  });

  const maxBar = Math.max(...WEEK_BARS);
  const totalFPTS = teamPlayers.reduce((sum, p, i) => sum + mockFPTS(p.rank || i + 10), 0);

  const CreateTeamModal = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowCreateTeam(false)}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "32px", width: 360, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 20px 0" }}>{t("创建新球队", "Create New Team")}</h3>
        <input
          placeholder={t("球队名称", "Team name")}
          value={newTeamName}
          onChange={e => setNewTeamName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleCreateTeam()}
          style={{ width: "100%", padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", marginBottom: 20, boxSizing: "border-box", fontFamily: FONT }}
        />
        <div style={{ display: "flex", gap: 12 }}>
          <button onClick={() => setShowCreateTeam(false)} style={{ flex: 1, padding: "10px", fontSize: 14, fontWeight: 600, color: "#374151", background: "#fff", border: "1.5px solid #d1d5db", borderRadius: 10, cursor: "pointer" }}>
            {t("取消", "Cancel")}
          </button>
          <button onClick={handleCreateTeam} style={{ flex: 1, padding: "10px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", border: "none", borderRadius: 10, cursor: "pointer" }}>
            {t("创建", "Create")}
          </button>
        </div>
      </div>
    </div>
  );

  const AddPlayerModal = () => (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }} onClick={() => setShowAddPlayer(false)}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "28px", width: 480, maxHeight: "70vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: "0 0 16px 0" }}>{t("添加球员", "Add Player")}</h3>
        <input
          placeholder={t("搜索球员...", "Search players...")}
          value={playerSearch}
          onChange={e => setPlayerSearch(e.target.value)}
          style={{ padding: "10px 14px", border: "1.5px solid #e5e7eb", borderRadius: 10, fontSize: 14, outline: "none", marginBottom: 14, fontFamily: FONT }}
        />
        <div style={{ overflowY: "auto", flex: 1 }}>
          {availablePlayers.slice(0, 20).map((p, i) => (
            <div key={p.id} onClick={() => handleAddPlayer(p)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏀</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{p.name}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>{p.team} · {p.position} · {p.ppg} PPG</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1d4ed8", background: "#dbeafe", padding: "3px 10px", borderRadius: 20 }}>
                #{p.rank || i + 1}
              </div>
            </div>
          ))}
          {availablePlayers.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px", color: "#9ca3af", fontSize: 14 }}>{t("没有找到球员", "No players found")}</div>
          )}
        </div>
      </div>
    </div>
  );

  // Not logged in
  if (!user) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/my-team" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏀</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 12px 0" }}>{t("请先登录", "Please Log In")}</h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 28px 0" }}>{t("登录后可以管理你的 Fantasy 球队", "Log in to manage your Fantasy team")}</p>
          <Link href="/auth/login" style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, textDecoration: "none" }}>
            {t("登录", "Log In")}
          </Link>
        </div>
      </div>
    );
  }

  // No team yet
  if (teams.length === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
        <LightHeader activeHref="/my-team" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "40px 24px" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>🏆</div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 12px 0" }}>{t("还没有球队", "No Team Yet")}</h1>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 28px 0" }}>{t("创建你的第一支幻想篮球队开始比赛！", "Create your first Fantasy basketball team to get started!")}</p>
          <button onClick={() => setShowCreateTeam(true)} style={{ padding: "12px 28px", fontSize: 15, fontWeight: 700, color: "#fff", background: "linear-gradient(90deg, #f59e0b, #f97316)", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FONT }}>
            {t("创建球队", "Create Team")}
          </button>
        </div>
        {showCreateTeam && <CreateTeamModal />}
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: FONT }}>
      <LightHeader activeHref="/my-team" />

      {/* Team header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #f3f4f6", padding: "32px 32px 28px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
            <div>
              {/* Team selector tabs */}
              {teams.length > 1 && (
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  {teams.map(tm => (
                    <button key={tm.id} onClick={() => { setActiveTeam(tm); loadTeamPlayers(tm); }} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, borderRadius: 20, border: "1.5px solid", borderColor: activeTeam?.id === tm.id ? "#1e3a8a" : "#e5e7eb", color: activeTeam?.id === tm.id ? "#1e3a8a" : "#6b7280", background: activeTeam?.id === tm.id ? "#eff6ff" : "#fff", cursor: "pointer", fontFamily: FONT }}>
                      {tm.name}
                    </button>
                  ))}
                  <button onClick={() => setShowCreateTeam(true)} style={{ padding: "6px 14px", fontSize: 13, fontWeight: 600, borderRadius: 20, border: "1.5px dashed #d1d5db", color: "#9ca3af", background: "#fff", cursor: "pointer", fontFamily: FONT }}>
                    + {t("新建", "New")}
                  </button>
                </div>
              )}
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#111827", margin: "0 0 6px 0" }}>
                {activeTeam?.name || t("我的球队", "My Team")} 🐯
              </h1>
              <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>
                {t("公开联赛 S4 · 第3名（6胜2负）· 第12周", "Open League S4 · #3 (6W-2L) · Week 12")}
              </p>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}>
              {/* FPTS card */}
              <div style={{ background: "#1e3a8a", borderRadius: 14, padding: "16px 24px", textAlign: "center", minWidth: 140 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.6)", letterSpacing: "0.5px", marginBottom: 6 }}>
                  {t("本周幻想总分", "THIS WEEK FPTS")}
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
                  {teamPlayers.length > 0 ? totalFPTS.toFixed(1) : "387.4"}
                </div>
              </div>
              <button onClick={() => setShowAddPlayer(true)} style={{ padding: "12px 20px", fontSize: 14, fontWeight: 700, color: "#fff", background: "linear-gradient(90deg, #f59e0b, #f97316)", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FONT }}>
                + {t("添加球员", "Add Player")}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 32px", display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* Left: roster */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {teamPlayers.length === 0 ? (
            <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "56px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏀</div>
              <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 20px 0" }}>{t("还没有球员，点击添加吧", "No players yet — add some!")}</p>
              <button onClick={() => setShowAddPlayer(true)} style={{ padding: "11px 24px", fontSize: 14, fontWeight: 700, color: "#fff", background: "#1e3a8a", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: FONT }}>
                + {t("添加球员", "Add Player")}
              </button>
            </div>
          ) : (
            <>
              {Object.entries(POS_CONFIG).map(([pos, cfg]) => {
                const group = playersByPos[pos] || [];
                if (group.length === 0) return null;
                return (
                  <div key={pos} style={{ marginBottom: 16 }}>
                    {/* Position header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: cfg.textColor, background: cfg.bgColor, padding: "3px 12px", borderRadius: 20 }}>
                        {t(cfg.labelZh, cfg.labelEn)}
                      </span>
                      <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
                    </div>

                    {/* Player rows */}
                    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
                      {group.map((player, idx) => {
                        const trend = TRENDS[(player.rank || idx + 1) % TRENDS.length];
                        const fpts = mockFPTS(player.rank || idx + 10);
                        return (
                          <div key={player.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: idx < group.length - 1 ? "1px solid #f9fafb" : "none" }}>
                            {/* Icon */}
                            <div style={{ width: 38, height: 38, borderRadius: "50%", background: cfg.bgColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                              🏀
                            </div>
                            {/* Name + info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                                {player.name.split(" ").map(w => w[0]).join(".")}. {player.name.split(" ").slice(-1)[0]}
                              </div>
                              <div style={{ fontSize: 12, color: "#9ca3af" }}>
                                {player.team} · {t("今日出赛", "Playing Today")}
                              </div>
                            </div>
                            {/* Trend */}
                            <span style={{ fontSize: 11, fontWeight: 600, color: trend.color, background: trend.bg, padding: "3px 10px", borderRadius: 20, whiteSpace: "nowrap" }}>
                              {t(trend.zh, trend.en)}
                            </span>
                            {/* FPTS */}
                            <div style={{ textAlign: "right", minWidth: 56, flexShrink: 0 }}>
                              <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{fpts}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>FPTS</div>
                            </div>
                            {/* Remove */}
                            <button onClick={() => handleRemovePlayer(player.id)} style={{ padding: "5px 10px", fontSize: 12, fontWeight: 600, color: "#9ca3af", background: "transparent", border: "1px solid #e5e7eb", borderRadius: 8, cursor: "pointer", flexShrink: 0, fontFamily: FONT }}>
                              {t("移除", "Drop")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Add player dashed button */}
              <button onClick={() => setShowAddPlayer(true)} style={{ width: "100%", padding: "14px", fontSize: 14, fontWeight: 600, color: "#9ca3af", background: "transparent", border: "1.5px dashed #d1d5db", borderRadius: 12, cursor: "pointer", marginTop: 8, fontFamily: FONT }}>
                + {t("添加球员 (BN)", "Add Player (BN)")}
              </button>
            </>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ width: 272, flexShrink: 0, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Weekly score chart */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 16 }}>
              {t("本周得分走势", "Weekly Score Trend")}
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 72 }}>
              {WEEK_BARS.map((val, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ width: "100%", background: i === WEEK_BARS.length - 1 ? "#1e3a8a" : "#dbeafe", borderRadius: "4px 4px 0 0", height: `${(val / maxBar) * 64}px`, transition: "height 0.3s" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {WEEK_LABELS.map((l, i) => (
                <div key={i} style={{ flex: 1, fontSize: 9, textAlign: "center", fontWeight: i === WEEK_BARS.length - 1 ? 700 : 400, color: i === WEEK_BARS.length - 1 ? "#1e3a8a" : "#d1d5db" }}>
                  {l}
                </div>
              ))}
            </div>
          </div>

          {/* Waiver wire */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#f59e0b", letterSpacing: "0.8px", marginBottom: 14 }}>
              WAIVER WIRE {t("推荐", "PICKS")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {WAIVER.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 34, height: 34, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>🏀</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{t(w.nameZh, w.nameEn)}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{w.team} · {w.pos} · {w.ppg} PPG</div>
                  </div>
                  <button onClick={() => {
                    const p = allPlayers.find(ap => ap.team === w.team);
                    if (p) handleAddPlayer(p);
                  }} style={{ padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "#1e3a8a", background: "#eff6ff", border: "none", borderRadius: 8, cursor: "pointer", flexShrink: 0, fontFamily: FONT }}>
                    + {t("添加", "Add")}
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* League standings */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "20px 18px" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 14 }}>
              {t("联赛排名", "League Standings")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {STANDINGS.map((s) => (
                <div key={s.rank} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 10, background: s.isMe ? "#eff6ff" : "transparent" }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: s.rank === 1 ? "#f59e0b" : s.isMe ? "#1e3a8a" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: s.rank === 1 || s.isMe ? "#fff" : "#6b7280", flexShrink: 0 }}>
                    {s.rank}
                  </div>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: s.isMe ? 700 : 400, color: s.isMe ? "#1e3a8a" : "#374151" }}>
                    {t(s.nameZh, s.nameEn)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>{s.pts}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, padding: "10px", background: "#f9fafb", borderRadius: 10, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
              {t("距第1名差25.4分", "25.4 pts behind #1")}
            </div>
          </div>

        </div>
      </div>

      {showCreateTeam && <CreateTeamModal />}
      {showAddPlayer && <AddPlayerModal />}
    </div>
  );
}
