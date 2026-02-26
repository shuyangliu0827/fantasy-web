"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getPlayers, Player, getSessionUser } from "@/lib/store";
import { supabase } from "@/lib/supabase";

type Team = {
  id: string;
  name: string;
  user_id: string;
  draft_position: number;
};

type DraftPick = {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  teamName: string;
  player: Player;
  timestamp: number;
};

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  league: any;
  teams: Team[];
  myTeam: Team;
  onDraftComplete: () => void;
};

const TOTAL_ROUNDS = 13;

function getSnakeDraftOrder(round: number, numTeams: number, pickInRound: number): number {
  if (round % 2 === 1) return pickInRound;
  return numTeams - pickInRound + 1;
}

function getDraftingTeam(teams: Team[], numTeams: number, round: number, pickInRound: number): Team | undefined {
  const draftPos = getSnakeDraftOrder(round, numTeams, pickInRound);
  return teams.find(t => t.draft_position === draftPos);
}

// Compute round and pick from total number of picks
function computeRoundAndPick(totalPicks: number, numTeams: number): { round: number; pickInRound: number } {
  const round = Math.floor(totalPicks / numTeams) + 1;
  const pickInRound = (totalPicks % numTeams) + 1;
  return { round, pickInRound };
}

export default function DraftRoom({ league, teams, myTeam, onDraftComplete }: Props) {
  const [allPlayers] = useState<Player[]>(() => getPlayers());
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [draftedPlayerIds, setDraftedPlayerIds] = useState<Set<string>>(new Set());
  const [draftComplete, setDraftComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [timer, setTimer] = useState(90);
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [showPickBanner, setShowPickBanner] = useState<DraftPick | null>(null);

  const numTeams = teams.length;
  const totalPicksNeeded = numTeams * TOTAL_ROUNDS;

  // Current state derived from picks
  const { round: currentRound, pickInRound: currentPickInRound } = computeRoundAndPick(picks.length, numTeams);
  const overallPick = picks.length + 1;
  const currentTeam = draftComplete ? undefined : getDraftingTeam(teams, numTeams, currentRound, currentPickInRound);
  const currentUser = getSessionUser();
  const isMyTurn = !!currentTeam && currentTeam.user_id === currentUser?.id && !draftComplete;

  const myPicks = picks.filter(p => p.teamId === myTeam.id);

  const availablePlayers = allPlayers.filter(p => {
    if (draftedPlayerIds.has(p.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
    }
    if (posFilter !== "ALL" && !p.position.includes(posFilter)) return false;
    return true;
  });

  const picksRef = useRef(picks);
  useEffect(() => { picksRef.current = picks; }, [picks]);

  // Build DraftPick from Supabase row
  const buildPick = useCallback((row: any): DraftPick | null => {
    const player = allPlayers.find(p => p.id === row.player_id);
    if (!player) return null;
    const team = teams.find(t => t.id === row.team_id);
    return {
      round: row.round,
      pickInRound: row.pick_number,
      overallPick: row.overall_pick,
      teamId: row.team_id,
      teamName: team?.name || row.team_name || "Unknown",
      player,
      timestamp: new Date(row.picked_at || row.created_at || Date.now()).getTime(),
    };
  }, [allPlayers, teams]);

  // Apply a list of picks to state
  const applyPicks = useCallback((picksList: DraftPick[]) => {
    setPicks(picksList);
    setDraftedPlayerIds(new Set(picksList.map(p => p.player.id)));
    const complete = picksList.length >= totalPicksNeeded;
    setDraftComplete(complete);
  }, [totalPicksNeeded]);

  // Load existing picks from Supabase on mount
  useEffect(() => {
    async function loadPicks() {
      try {
        const { data, error } = await supabase
          .from("draft_picks")
          .select("*")
          .eq("league_id", league.id)
          .order("overall_pick", { ascending: true });

        if (error) {
          console.error("Failed to load draft picks:", error.message);
          setLoading(false);
          return;
        }

        if (data && data.length > 0) {
          const loaded: DraftPick[] = [];
          for (const row of data) {
            const pick = buildPick(row);
            if (pick) loaded.push(pick);
          }
          applyPicks(loaded);
        }
      } catch (err) {
        console.error("Error loading picks:", err);
      }
      setLoading(false);
    }

    loadPicks();
  }, [league.id, buildPick, applyPicks]);

  // Subscribe to Supabase Realtime for new picks
  useEffect(() => {
    const channel = supabase
      .channel(`draft-${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "draft_picks",
          filter: `league_id=eq.${league.id}`,
        },
        (payload) => {
          const newPick = buildPick(payload.new);
          if (!newPick) return;

          // Skip if we already have this pick
          const existing = picksRef.current;
          if (existing.some(p => p.overallPick === newPick.overallPick)) return;

          const updated = [...existing, newPick].sort((a, b) => a.overallPick - b.overallPick);
          applyPicks(updated);
          setTimer(90);

          setShowPickBanner(newPick);
          setTimeout(() => setShowPickBanner(null), 2500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league.id, buildPick, applyPicks]);

  // Also poll every 3s as a fallback (in case Realtime misses something)
  useEffect(() => {
    if (draftComplete) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await supabase
          .from("draft_picks")
          .select("*")
          .eq("league_id", league.id)
          .order("overall_pick", { ascending: true });

        if (data && data.length > picksRef.current.length) {
          const loaded: DraftPick[] = [];
          for (const row of data) {
            const pick = buildPick(row);
            if (pick) loaded.push(pick);
          }
          applyPicks(loaded);
        }
      } catch {
        // Silent fail for polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [league.id, draftComplete, buildPick, applyPicks]);

  // Timer countdown
  useEffect(() => {
    if (draftComplete) return;
    const interval = setInterval(() => {
      setTimer(prev => (prev <= 1 ? 90 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [draftComplete]);

  // Save rosters to localStorage when draft completes
  useEffect(() => {
    if (!draftComplete || picks.length === 0) return;
    try {
      const rostersByTeam: Record<string, { id: string; name: string; team: string; position: string; ppg: number; rpg: number; apg: number; spg: number; bpg: number; fg: number; ft: number; tov: number; round: number }[]> = {};
      for (const pick of picks) {
        if (!rostersByTeam[pick.teamId]) rostersByTeam[pick.teamId] = [];
        rostersByTeam[pick.teamId].push({
          id: pick.player.id, name: pick.player.name, team: pick.player.team,
          position: pick.player.position, ppg: pick.player.ppg, rpg: pick.player.rpg,
          apg: pick.player.apg, spg: pick.player.spg, bpg: pick.player.bpg,
          fg: pick.player.fg, ft: pick.player.ft, tov: pick.player.tov, round: pick.round,
        });
      }
      localStorage.setItem(`bp_league_rosters_${league.id}`, JSON.stringify(rostersByTeam));
    } catch (e) {
      console.error("Failed to save draft results:", e);
    }
  }, [draftComplete, picks, league.id]);

  // Handle player pick
  const handlePlayerPick = useCallback(async (player: Player) => {
    if (!isMyTurn || picking || draftComplete) return;

    const team = currentTeam!;
    setPicking(true);

    try {
      const pickRound = currentRound;
      const pickInRound = currentPickInRound;
      const pickOverall = overallPick;

      const { error } = await supabase.from("draft_picks").insert({
        league_id: league.id,
        team_id: team.id,
        team_name: team.name,
        player_id: player.id,
        player_name: player.name,
        player_team: player.team,
        player_position: player.position,
        round: pickRound,
        pick_number: pickInRound,
        overall_pick: pickOverall,
      });

      if (error) {
        console.error("Pick failed:", error.message);
        alert("选择失败: " + error.message);
        setPicking(false);
        return;
      }

      // Optimistic local update (Realtime will also fire)
      const newPick: DraftPick = {
        round: pickRound,
        pickInRound,
        overallPick: pickOverall,
        teamId: team.id,
        teamName: team.name,
        player,
        timestamp: Date.now(),
      };

      const updated = [...picks, newPick];
      applyPicks(updated);
      setTimer(90);

      setShowPickBanner(newPick);
      setTimeout(() => setShowPickBanner(null), 2500);

      // If draft complete, update league status
      if (updated.length >= totalPicksNeeded) {
        await supabase.from("leagues").update({ status: "active" }).eq("id", league.id);
      }
    } catch (err: any) {
      console.error("Pick error:", err);
      alert("选择失败");
    }
    setPicking(false);
  }, [isMyTurn, picking, draftComplete, currentTeam, currentRound, currentPickInRound, overallPick, league.id, picks, applyPicks, totalPicksNeeded]);

  const timerColor = timer <= 10 ? "#ef4444" : timer <= 30 ? "#f59e0b" : "#10b981";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", color: "#e5e5e5" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: "48px", marginBottom: "16px" }}>🏀</div>
          <p>加载选秀数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0a",
      color: "#e5e5e5",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Top Bar */}
      <div style={{
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
        padding: "12px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #333",
        flexWrap: "wrap",
        gap: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "24px" }}>🏀</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: "16px" }}>{league.name}</div>
            <div style={{ fontSize: "12px", color: "#94a3b8" }}>
              {league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"} · {numTeams} 支队伍 · {TOTAL_ROUNDS} 轮
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
          {!draftComplete && (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>轮次</div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: "#f59e0b" }}>{currentRound}/{TOTAL_ROUNDS}</div>
              </div>
              <div style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "8px", textAlign: "center" }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>顺位</div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: "#f59e0b" }}>#{overallPick}</div>
              </div>
            </div>
          )}

          {!draftComplete && (
            <div style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "8px", textAlign: "center", minWidth: "70px" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>倒计时</div>
              <div style={{ fontWeight: 700, fontSize: "18px", color: timerColor, fontVariantNumeric: "tabular-nums" }}>
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
              </div>
            </div>
          )}

          {!draftComplete && currentTeam && (
            <div style={{
              background: isMyTurn ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "#1e293b",
              padding: "8px 16px",
              borderRadius: "8px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "10px", color: isMyTurn ? "rgba(255,255,255,0.8)" : "#94a3b8", textTransform: "uppercase" }}>
                {isMyTurn ? "轮到你了!" : "正在选秀"}
              </div>
              <div style={{ fontWeight: 700, fontSize: "14px", color: isMyTurn ? "white" : "#e5e5e5" }}>
                {currentTeam.name}
              </div>
            </div>
          )}

          {draftComplete && (
            <div style={{
              background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
              padding: "8px 20px",
              borderRadius: "8px",
              fontWeight: 700,
              color: "#1a1a2e",
            }}>
              🏆 选秀完成!
            </div>
          )}
        </div>
      </div>

      {/* Pick announcement banner */}
      {showPickBanner && (
        <div style={{
          background: showPickBanner.teamId === myTeam.id
            ? "linear-gradient(135deg, #10b981 0%, #059669 100%)"
            : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
          padding: "10px 20px",
          textAlign: "center",
          fontWeight: 600,
          fontSize: "14px",
          color: "white",
        }}>
          第{showPickBanner.round}轮 #{showPickBanner.overallPick} — {showPickBanner.teamName} 选择了 {showPickBanner.player.name} ({showPickBanner.player.team} · {showPickBanner.player.position})
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", gap: "0", overflow: "hidden" }}>
        {/* Left: Available Players */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: "1px solid #222", minWidth: 0 }}>
          {/* Search & Filter */}
          <div style={{ padding: "12px 16px", background: "#111", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="搜索球员..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1, minWidth: "120px", padding: "8px 12px",
                background: "#1e293b", border: "1px solid #334155", borderRadius: "6px",
                color: "#e5e5e5", fontSize: "13px", outline: "none",
              }}
            />
            {["ALL", "PG", "SG", "SF", "PF", "C"].map(pos => (
              <button
                key={pos}
                onClick={() => setPosFilter(pos)}
                style={{
                  padding: "6px 10px",
                  background: posFilter === pos ? "#f59e0b" : "#1e293b",
                  color: posFilter === pos ? "#000" : "#94a3b8",
                  border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                }}
              >
                {pos}
              </button>
            ))}
            <span style={{ fontSize: "12px", color: "#64748b" }}>{availablePlayers.length} 人可选</span>
          </div>

          {/* Player list header */}
          <div style={{
            display: "grid", gridTemplateColumns: "40px 1fr 60px 50px 50px 50px 50px 50px 80px",
            padding: "6px 16px", background: "#0f172a", fontSize: "10px", color: "#64748b",
            fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px",
          }}>
            <span>排名</span><span>球员</span><span>位置</span>
            <span>PPG</span><span>RPG</span><span>APG</span><span>SPG</span><span>BPG</span>
            <span style={{ textAlign: "center" }}>{isMyTurn ? "选择" : ""}</span>
          </div>

          {/* Player list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {availablePlayers.slice(0, 100).map((player, idx) => (
              <div
                key={player.id}
                onClick={() => isMyTurn && !picking && handlePlayerPick(player)}
                style={{
                  display: "grid", gridTemplateColumns: "40px 1fr 60px 50px 50px 50px 50px 50px 80px",
                  padding: "8px 16px", background: idx % 2 === 0 ? "#0a0a0a" : "#111",
                  cursor: isMyTurn ? "pointer" : "default", borderBottom: "1px solid #1a1a1a",
                  transition: "background 0.15s", alignItems: "center",
                  opacity: picking ? 0.6 : 1,
                }}
                onMouseEnter={e => { if (isMyTurn) (e.currentTarget as HTMLElement).style.background = "#1e293b"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#0a0a0a" : "#111"; }}
              >
                <span style={{ color: "#64748b", fontWeight: 600, fontSize: "12px" }}>#{player.rank}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#e5e5e5" }}>
                    {player.name}
                    {player.injury && (
                      <span style={{
                        marginLeft: "6px", padding: "1px 5px",
                        background: player.injury === "Out" ? "#7f1d1d" : "#78350f",
                        color: player.injury === "Out" ? "#fca5a5" : "#fde68a",
                        borderRadius: "3px", fontSize: "9px", fontWeight: 700,
                      }}>{player.injury}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b" }}>{player.team}</div>
                </div>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{player.position}</span>
                <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 600 }}>{player.ppg}</span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{player.rpg}</span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{player.apg}</span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{player.spg}</span>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>{player.bpg}</span>
                <div style={{ textAlign: "center" }}>
                  {isMyTurn && (
                    <button
                      onClick={e => { e.stopPropagation(); handlePlayerPick(player); }}
                      disabled={picking}
                      style={{
                        padding: "4px 12px",
                        background: picking ? "#334155" : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "white", border: "none", borderRadius: "4px",
                        fontSize: "11px", fontWeight: 600,
                        cursor: picking ? "not-allowed" : "pointer",
                      }}
                    >
                      {picking ? "..." : "选择"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ width: "320px", display: "flex", flexDirection: "column", background: "#111", flexShrink: 0 }}>
          {/* My Team Roster */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderBottom: "1px solid #222" }}>
            <div style={{ padding: "12px 16px", background: "#0f172a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#f59e0b" }}>{myTeam.name}</div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>选秀位: #{myTeam.draft_position}</div>
              </div>
              <div style={{ padding: "4px 10px", background: "#1e293b", borderRadius: "12px", fontSize: "12px", fontWeight: 600, color: "#94a3b8" }}>
                {myPicks.length}/{TOTAL_ROUNDS}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {myPicks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 16px", color: "#475569", fontSize: "13px" }}>
                  {isMyTurn ? "轮到你了，请选择球员!" : "等待其他队伍选秀..."}
                </div>
              ) : (
                myPicks.map((pick, i) => (
                  <div key={pick.player.id} style={{
                    display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px",
                    background: i % 2 === 0 ? "#1a1a2e" : "transparent", borderRadius: "6px", marginBottom: "2px",
                  }}>
                    <div style={{
                      width: "28px", height: "28px", borderRadius: "50%", background: "#f59e0b",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "11px", fontWeight: 700, color: "#000", flexShrink: 0,
                    }}>R{pick.round}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {pick.player.name}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>{pick.player.team} · {pick.player.position}</div>
                    </div>
                    <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>{pick.player.ppg}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Picks / Draft Log */}
          <div style={{ height: "240px", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "10px 16px", background: "#0f172a", fontWeight: 700, fontSize: "13px", color: "#94a3b8" }}>
              选秀记录 ({picks.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
              {picks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#475569", fontSize: "12px" }}>暂无记录</div>
              ) : (
                [...picks].reverse().map((pick) => (
                  <div key={pick.overallPick} style={{
                    display: "flex", alignItems: "center", gap: "8px", padding: "5px 8px",
                    borderBottom: "1px solid #1a1a1a", fontSize: "11px",
                  }}>
                    <span style={{ color: "#64748b", fontWeight: 600, width: "24px", flexShrink: 0 }}>#{pick.overallPick}</span>
                    <span style={{
                      flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      color: pick.teamId === myTeam.id ? "#f59e0b" : "#94a3b8",
                      fontWeight: pick.teamId === myTeam.id ? 600 : 400,
                    }}>{pick.player.name}</span>
                    <span style={{ color: "#475569", fontSize: "10px", flexShrink: 0 }}>{pick.teamName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Draft complete overlay */}
      {draftComplete && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{
            background: "#1a1a2e", borderRadius: "16px", padding: "32px 40px",
            textAlign: "center", maxWidth: "500px", width: "90%", border: "2px solid #f59e0b",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏆</div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#f59e0b" }}>选秀完成!</h2>
            <p style={{ color: "#94a3b8", marginBottom: "20px", fontSize: "14px" }}>
              恭喜! 你的队伍 &ldquo;{myTeam.name}&rdquo; 已选择 {myPicks.length} 名球员
            </p>
            <div style={{
              background: "#0f172a", borderRadius: "10px", padding: "16px", marginBottom: "20px",
              textAlign: "left", maxHeight: "300px", overflowY: "auto",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "10px", color: "#f59e0b", fontSize: "13px" }}>你的阵容:</div>
              {myPicks.map((pick, i) => (
                <div key={pick.player.id} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                  borderBottom: i < myPicks.length - 1 ? "1px solid #1e293b" : "none", fontSize: "12px",
                }}>
                  <span style={{ color: "#64748b" }}>R{pick.round}</span>
                  <span style={{ flex: 1, marginLeft: "10px", fontWeight: 500 }}>{pick.player.name}</span>
                  <span style={{ color: "#64748b" }}>{pick.player.position}</span>
                  <span style={{ color: "#f59e0b", marginLeft: "10px", fontWeight: 600 }}>{pick.player.ppg} PPG</span>
                </div>
              ))}
            </div>
            <button
              onClick={onDraftComplete}
              style={{
                padding: "12px 32px",
                background: "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                color: "#000", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "15px", cursor: "pointer",
              }}
            >
              返回联赛
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
