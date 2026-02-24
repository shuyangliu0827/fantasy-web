"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getPlayers, Player } from "@/lib/store";

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

type DraftState = {
  currentRound: number;
  currentPickInRound: number;
  overallPick: number;
  draftedPlayerIds: Set<string>;
  picks: DraftPick[];
  draftComplete: boolean;
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
  if (round % 2 === 1) {
    return pickInRound;
  }
  return numTeams - pickInRound + 1;
}

function getDraftingTeam(teams: Team[], numTeams: number, round: number, pickInRound: number): Team | undefined {
  const draftPos = getSnakeDraftOrder(round, numTeams, pickInRound);
  return teams.find(t => t.draft_position === draftPos);
}

export default function DraftRoom({ league, teams, myTeam, onDraftComplete }: Props) {
  const [allPlayers] = useState<Player[]>(() => getPlayers());
  const [draftState, setDraftState] = useState<DraftState>({
    currentRound: 1,
    currentPickInRound: 1,
    overallPick: 1,
    draftedPlayerIds: new Set(),
    picks: [],
    draftComplete: false,
  });
  const [timer, setTimer] = useState(90);
  const [searchQuery, setSearchQuery] = useState("");
  const [posFilter, setPosFilter] = useState("ALL");
  const [showPickBanner, setShowPickBanner] = useState<DraftPick | null>(null);

  const numTeams = teams.length;

  // Refs for accessing latest state inside effects/callbacks without re-triggering
  const draftStateRef = useRef(draftState);
  const allPlayersRef = useRef(allPlayers);

  // Sync refs via effect (React 19 disallows ref writes during render)
  useEffect(() => {
    draftStateRef.current = draftState;
  }, [draftState]);

  useEffect(() => {
    allPlayersRef.current = allPlayers;
  }, [allPlayers]);

  const currentTeam = getDraftingTeam(teams, numTeams, draftState.currentRound, draftState.currentPickInRound);
  const isMyTurn = currentTeam?.id === myTeam.id && !draftState.draftComplete;

  const myPicks = draftState.picks.filter(p => p.teamId === myTeam.id);

  const availablePlayers = allPlayers.filter(p => {
    if (draftState.draftedPlayerIds.has(p.id)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.team.toLowerCase().includes(q)) return false;
    }
    if (posFilter !== "ALL" && !p.position.includes(posFilter)) return false;
    return true;
  });

  // Process a pick and advance draft state
  const processPick = useCallback((team: Team, player: Player) => {
    setDraftState(prev => {
      if (prev.draftComplete) return prev;

      const pick: DraftPick = {
        round: prev.currentRound,
        pickInRound: prev.currentPickInRound,
        overallPick: prev.overallPick,
        teamId: team.id,
        teamName: team.name,
        player,
        timestamp: Date.now(),
      };

      const newDraftedIds = new Set(prev.draftedPlayerIds);
      newDraftedIds.add(player.id);
      const newPicks = [...prev.picks, pick];

      // Advance
      let nextRound = prev.currentRound;
      let nextPickInRound = prev.currentPickInRound + 1;
      let complete = false;

      if (nextPickInRound > numTeams) {
        nextPickInRound = 1;
        nextRound = prev.currentRound + 1;
        if (nextRound > TOTAL_ROUNDS) {
          complete = true;
        }
      }

      setShowPickBanner(pick);
      setTimeout(() => setShowPickBanner(null), 2000);

      return {
        currentRound: complete ? prev.currentRound : nextRound,
        currentPickInRound: complete ? prev.currentPickInRound : nextPickInRound,
        overallPick: prev.overallPick + 1,
        draftedPlayerIds: newDraftedIds,
        picks: newPicks,
        draftComplete: complete,
      };
    });
    setTimer(90);
  }, [numTeams]);

  // Timer countdown
  useEffect(() => {
    if (draftState.draftComplete) return;
    const interval = setInterval(() => {
      setTimer(prev => (prev <= 1 ? 90 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [draftState.draftComplete]);

  // Simulate other teams' picks
  useEffect(() => {
    const state = draftStateRef.current;
    if (state.draftComplete) return;

    const team = getDraftingTeam(teams, numTeams, state.currentRound, state.currentPickInRound);
    if (!team || team.id === myTeam.id) return;

    const delay = 1200 + Math.random() * 800;
    const timeout = setTimeout(() => {
      const currentState = draftStateRef.current;
      const available = allPlayersRef.current.filter(p => !currentState.draftedPlayerIds.has(p.id));
      if (available.length === 0) return;

      const topN = Math.min(5, available.length);
      const randomIdx = Math.floor(Math.random() * topN);
      const selectedPlayer = available[randomIdx];

      const pickTeam = getDraftingTeam(teams, numTeams, currentState.currentRound, currentState.currentPickInRound);
      if (pickTeam && pickTeam.id !== myTeam.id) {
        processPick(pickTeam, selectedPlayer);
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [draftState.currentRound, draftState.currentPickInRound, draftState.draftComplete, teams, numTeams, myTeam.id, processPick]);

  const handlePlayerPick = useCallback((player: Player) => {
    processPick(myTeam, player);
  }, [processPick, myTeam]);

  const timerColor = timer <= 10 ? "#ef4444" : timer <= 30 ? "#f59e0b" : "#10b981";

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

        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          flexWrap: "wrap",
        }}>
          {!draftState.draftComplete && (
            <div style={{ display: "flex", gap: "12px" }}>
              <div style={{
                background: "#1e293b",
                padding: "6px 14px",
                borderRadius: "8px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>轮次</div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: "#f59e0b" }}>{draftState.currentRound}/{TOTAL_ROUNDS}</div>
              </div>
              <div style={{
                background: "#1e293b",
                padding: "6px 14px",
                borderRadius: "8px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>顺位</div>
                <div style={{ fontWeight: 700, fontSize: "18px", color: "#f59e0b" }}>#{draftState.overallPick}</div>
              </div>
            </div>
          )}

          {!draftState.draftComplete && (
            <div style={{
              background: "#1e293b",
              padding: "6px 14px",
              borderRadius: "8px",
              textAlign: "center",
              minWidth: "70px",
            }}>
              <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>倒计时</div>
              <div style={{
                fontWeight: 700,
                fontSize: "18px",
                color: timerColor,
                fontVariantNumeric: "tabular-nums",
              }}>
                {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
              </div>
            </div>
          )}

          {!draftState.draftComplete && currentTeam && (
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

          {draftState.draftComplete && (
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
      <div style={{
        flex: 1,
        display: "flex",
        gap: "0",
        overflow: "hidden",
      }}>
        {/* Left: Available Players */}
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid #222",
          minWidth: 0,
        }}>
          {/* Search & Filter */}
          <div style={{
            padding: "12px 16px",
            background: "#111",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}>
            <input
              type="text"
              placeholder="搜索球员..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                minWidth: "120px",
                padding: "8px 12px",
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e5e5e5",
                fontSize: "13px",
                outline: "none",
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
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {pos}
              </button>
            ))}
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {availablePlayers.length} 人可选
            </span>
          </div>

          {/* Player list header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr 60px 50px 50px 50px 50px 50px 80px",
            padding: "6px 16px",
            background: "#0f172a",
            fontSize: "10px",
            color: "#64748b",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}>
            <span>排名</span>
            <span>球员</span>
            <span>位置</span>
            <span>PPG</span>
            <span>RPG</span>
            <span>APG</span>
            <span>SPG</span>
            <span>BPG</span>
            <span style={{ textAlign: "center" }}>{isMyTurn ? "选择" : ""}</span>
          </div>

          {/* Player list */}
          <div style={{
            flex: 1,
            overflowY: "auto",
          }}>
            {availablePlayers.slice(0, 100).map((player, idx) => (
              <div
                key={player.id}
                onClick={() => isMyTurn && handlePlayerPick(player)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "40px 1fr 60px 50px 50px 50px 50px 50px 80px",
                  padding: "8px 16px",
                  background: idx % 2 === 0 ? "#0a0a0a" : "#111",
                  cursor: isMyTurn ? "pointer" : "default",
                  borderBottom: "1px solid #1a1a1a",
                  transition: "background 0.15s",
                  alignItems: "center",
                }}
                onMouseEnter={e => {
                  if (isMyTurn) (e.currentTarget as HTMLElement).style.background = "#1e293b";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#0a0a0a" : "#111";
                }}
              >
                <span style={{ color: "#64748b", fontWeight: 600, fontSize: "12px" }}>#{player.rank}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "13px", color: "#e5e5e5" }}>
                    {player.name}
                    {player.injury && (
                      <span style={{
                        marginLeft: "6px",
                        padding: "1px 5px",
                        background: player.injury === "Out" ? "#7f1d1d" : "#78350f",
                        color: player.injury === "Out" ? "#fca5a5" : "#fde68a",
                        borderRadius: "3px",
                        fontSize: "9px",
                        fontWeight: 700,
                      }}>
                        {player.injury}
                      </span>
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
                      style={{
                        padding: "4px 12px",
                        background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      选择
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{
          width: "320px",
          display: "flex",
          flexDirection: "column",
          background: "#111",
          flexShrink: 0,
        }}>
          {/* My Team Roster */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            borderBottom: "1px solid #222",
          }}>
            <div style={{
              padding: "12px 16px",
              background: "#0f172a",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", color: "#f59e0b" }}>
                  {myTeam.name}
                </div>
                <div style={{ fontSize: "11px", color: "#64748b" }}>
                  选秀位: #{myTeam.draft_position}
                </div>
              </div>
              <div style={{
                padding: "4px 10px",
                background: "#1e293b",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: 600,
                color: "#94a3b8",
              }}>
                {myPicks.length}/{TOTAL_ROUNDS}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {myPicks.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "30px 16px",
                  color: "#475569",
                  fontSize: "13px",
                }}>
                  等待选秀开始...
                </div>
              ) : (
                myPicks.map((pick, i) => (
                  <div key={pick.player.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "8px 10px",
                    background: i % 2 === 0 ? "#1a1a2e" : "transparent",
                    borderRadius: "6px",
                    marginBottom: "2px",
                  }}>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: "#f59e0b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#000",
                      flexShrink: 0,
                    }}>
                      R{pick.round}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600,
                        fontSize: "12px",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}>
                        {pick.player.name}
                      </div>
                      <div style={{ fontSize: "10px", color: "#64748b" }}>
                        {pick.player.team} · {pick.player.position}
                      </div>
                    </div>
                    <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>
                      {pick.player.ppg}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Picks / Draft Log */}
          <div style={{
            height: "240px",
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{
              padding: "10px 16px",
              background: "#0f172a",
              fontWeight: 700,
              fontSize: "13px",
              color: "#94a3b8",
            }}>
              选秀记录 ({draftState.picks.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
              {draftState.picks.length === 0 ? (
                <div style={{
                  textAlign: "center",
                  padding: "20px",
                  color: "#475569",
                  fontSize: "12px",
                }}>
                  暂无记录
                </div>
              ) : (
                [...draftState.picks].reverse().map((pick) => (
                  <div key={pick.overallPick} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "5px 8px",
                    borderBottom: "1px solid #1a1a1a",
                    fontSize: "11px",
                  }}>
                    <span style={{
                      color: "#64748b",
                      fontWeight: 600,
                      width: "24px",
                      flexShrink: 0,
                    }}>
                      #{pick.overallPick}
                    </span>
                    <span style={{
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      color: pick.teamId === myTeam.id ? "#f59e0b" : "#94a3b8",
                      fontWeight: pick.teamId === myTeam.id ? 600 : 400,
                    }}>
                      {pick.player.name}
                    </span>
                    <span style={{
                      color: "#475569",
                      fontSize: "10px",
                      flexShrink: 0,
                    }}>
                      {pick.teamName}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Draft complete overlay */}
      {draftState.draftComplete && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0,0,0,0.7)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 100,
        }}>
          <div style={{
            background: "#1a1a2e",
            borderRadius: "16px",
            padding: "32px 40px",
            textAlign: "center",
            maxWidth: "500px",
            width: "90%",
            border: "2px solid #f59e0b",
          }}>
            <div style={{ fontSize: "48px", marginBottom: "12px" }}>🏆</div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: "24px", color: "#f59e0b" }}>选秀完成!</h2>
            <p style={{ color: "#94a3b8", marginBottom: "20px", fontSize: "14px" }}>
              恭喜! 你的队伍 &ldquo;{myTeam.name}&rdquo; 已选择 {myPicks.length} 名球员
            </p>

            <div style={{
              background: "#0f172a",
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "20px",
              textAlign: "left",
              maxHeight: "300px",
              overflowY: "auto",
            }}>
              <div style={{ fontWeight: 700, marginBottom: "10px", color: "#f59e0b", fontSize: "13px" }}>你的阵容:</div>
              {myPicks.map((pick, i) => (
                <div key={pick.player.id} style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "4px 0",
                  borderBottom: i < myPicks.length - 1 ? "1px solid #1e293b" : "none",
                  fontSize: "12px",
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
                color: "#000",
                border: "none",
                borderRadius: "8px",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
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
