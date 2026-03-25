"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getPlayers, Player, getSessionUser } from "@/lib/store";
import PlayerAvatar from "@/components/PlayerAvatar";
import { supabase } from "@/lib/supabase";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

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

// Serializable version for localStorage / broadcast
type SerializedPick = {
  round: number;
  pickInRound: number;
  overallPick: number;
  teamId: string;
  teamName: string;
  playerId: string;
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

function computeRoundAndPick(totalPicks: number, numTeams: number): { round: number; pickInRound: number } {
  const round = Math.floor(totalPicks / numTeams) + 1;
  const pickInRound = (totalPicks % numTeams) + 1;
  return { round, pickInRound };
}

function draftStorageKey(leagueId: string) {
  return `bp_draft_picks_${leagueId}`;
}

function savePicks(leagueId: string, picks: DraftPick[]) {
  try {
    const serialized: SerializedPick[] = picks.map(p => ({
      round: p.round, pickInRound: p.pickInRound, overallPick: p.overallPick,
      teamId: p.teamId, teamName: p.teamName, playerId: p.player.id, timestamp: p.timestamp,
    }));
    localStorage.setItem(draftStorageKey(leagueId), JSON.stringify(serialized));
  } catch (e) {
    console.error("Failed to save draft picks:", e);
  }
}

function loadStoredPicks(leagueId: string, allPlayers: Player[]): DraftPick[] {
  try {
    const raw = localStorage.getItem(draftStorageKey(leagueId));
    if (!raw) return [];
    const serialized: SerializedPick[] = JSON.parse(raw);
    const picks: DraftPick[] = [];
    for (const s of serialized) {
      const player = allPlayers.find(p => p.id === s.playerId);
      if (!player) continue;
      picks.push({ round: s.round, pickInRound: s.pickInRound, overallPick: s.overallPick, teamId: s.teamId, teamName: s.teamName, player, timestamp: s.timestamp });
    }
    return picks.sort((a, b) => a.overallPick - b.overallPick);
  } catch {
    return [];
  }
}

type LiveStats = {
  gamesPlayed: number;
  min: number; fgm: number; fga: number;
  fg3m: number; ftm: number; fta: number;
  reb: number; ast: number; stl: number;
  blk: number; tov: number; pts: number;
  fpts: number; fptsAvg: number;
};

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
  const [playerPage, setPlayerPage] = useState(1);
  const playerPageSize = 25;
  const [showPickBanner, setShowPickBanner] = useState<DraftPick | null>(null);
  const [statsMap, setStatsMap] = useState<Record<string, LiveStats>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [showRightPanel, setShowRightPanel] = useState(false);

  const numTeams = teams.length;
  const totalPicksNeeded = numTeams * TOTAL_ROUNDS;

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

  const totalPlayerPages = Math.ceil(availablePlayers.length / playerPageSize);
  const paginatedPlayers = useMemo(() => availablePlayers.slice(
    (playerPage - 1) * playerPageSize,
    playerPage * playerPageSize
  ), [availablePlayers, playerPage]);

  useEffect(() => {
    if (playerPage > totalPlayerPages && totalPlayerPages > 0) setPlayerPage(totalPlayerPages);
  }, [totalPlayerPages, playerPage]);

  const picksRef = useRef(picks);
  useEffect(() => { picksRef.current = picks; }, [picks]);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const applyPicks = useCallback((picksList: DraftPick[]) => {
    setPicks(picksList);
    setDraftedPlayerIds(new Set(picksList.map(p => p.player.id)));
    const complete = picksList.length >= totalPicksNeeded;
    setDraftComplete(complete);
    savePicks(league.id, picksList);
  }, [totalPicksNeeded, league.id]);

  const mergePicks = useCallback((incoming: SerializedPick[]) => {
    const current = picksRef.current;
    const existingOveralls = new Set(current.map(p => p.overallPick));
    let hasNew = false;
    const newPicks: DraftPick[] = [...current];

    for (const s of incoming) {
      if (existingOveralls.has(s.overallPick)) continue;
      const player = allPlayers.find(p => p.id === s.playerId);
      if (!player) continue;
      newPicks.push({ round: s.round, pickInRound: s.pickInRound, overallPick: s.overallPick, teamId: s.teamId, teamName: s.teamName, player, timestamp: s.timestamp });
      hasNew = true;
    }

    if (hasNew) {
      newPicks.sort((a, b) => a.overallPick - b.overallPick);
      applyPicks(newPicks);
    }
  }, [allPlayers, applyPicks]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const stored = loadStoredPicks(league.id, allPlayers);
    if (stored.length > 0) applyPicks(stored);
    setLoading(false);

    const channel = supabase.channel(`draft-room-${league.id}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "pick" }, (payload) => {
        const pick = payload.payload as SerializedPick;
        if (pick) {
          mergePicks([pick]);
          const player = allPlayers.find(p => p.id === pick.playerId);
          if (player) {
            const dp: DraftPick = { round: pick.round, pickInRound: pick.pickInRound, overallPick: pick.overallPick, teamId: pick.teamId, teamName: pick.teamName, player, timestamp: pick.timestamp };
            setShowPickBanner(dp);
            setTimeout(() => setShowPickBanner(null), 2500);
            setTimer(90);
          }
        }
      })
      .on("broadcast", { event: "sync_request" }, () => {
        const current = picksRef.current;
        if (current.length > 0) {
          const serialized: SerializedPick[] = current.map(p => ({ round: p.round, pickInRound: p.pickInRound, overallPick: p.overallPick, teamId: p.teamId, teamName: p.teamName, playerId: p.player.id, timestamp: p.timestamp }));
          channel.send({ type: "broadcast", event: "sync_response", payload: { picks: serialized } });
        }
      })
      .on("broadcast", { event: "sync_response" }, (payload) => {
        const data = payload.payload as { picks: SerializedPick[] };
        if (data?.picks?.length) mergePicks(data.picks);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.send({ type: "broadcast", event: "sync_request", payload: {} });
        }
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [league.id]);

  useEffect(() => {
    fetch("/api/nba-stats")
      .then(r => r.json())
      .then(data => {
        if (data.players) {
          const map: Record<string, LiveStats> = {};
          for (const p of data.players) {
            map[p.name] = { gamesPlayed: p.gamesPlayed, min: p.averages.min, fgm: p.averages.fgm, fga: p.averages.fga, fg3m: p.averages.fg3m, ftm: p.averages.ftm, fta: p.averages.fta, reb: p.averages.reb, ast: p.averages.ast, stl: p.averages.stl, blk: p.averages.blk, tov: p.averages.tov, pts: p.averages.pts, fpts: p.fpts, fptsAvg: p.fptsAvg };
          }
          setStatsMap(map);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (draftComplete) return;
    const interval = setInterval(() => { setTimer(prev => (prev <= 1 ? 90 : prev - 1)); }, 1000);
    return () => clearInterval(interval);
  }, [draftComplete]);

  useEffect(() => {
    if (!draftComplete || picks.length === 0) return;
    try {
      const rostersByTeam: Record<string, { id: string; name: string; team: string; position: string; ppg: number; rpg: number; apg: number; spg: number; bpg: number; fg: number; ft: number; tov: number; round: number }[]> = {};
      for (const pick of picks) {
        if (!rostersByTeam[pick.teamId]) rostersByTeam[pick.teamId] = [];
        rostersByTeam[pick.teamId].push({ id: pick.player.id, name: pick.player.name, team: pick.player.team, position: pick.player.position, ppg: pick.player.ppg, rpg: pick.player.rpg, apg: pick.player.apg, spg: pick.player.spg, bpg: pick.player.bpg, fg: pick.player.fg, ft: pick.player.ft, tov: pick.player.tov, round: pick.round });
      }
      localStorage.setItem(`bp_league_rosters_${league.id}`, JSON.stringify(rostersByTeam));
      for (const [teamId, roster] of Object.entries(rostersByTeam)) {
        supabase.from("fantasy_teams").update({ roster_data: roster }).eq("id", teamId).then(() => {});
      }
      supabase.from("leagues").update({ status: "active" }).eq("id", league.id).then(() => {});
    } catch (e) {
      console.error("Failed to save draft results:", e);
    }
  }, [draftComplete, picks, league.id]);

  const handlePlayerPick = useCallback(async (player: Player) => {
    if (!isMyTurn || picking || draftComplete) return;

    const team = currentTeam!;
    setPicking(true);

    try {
      const newPick: DraftPick = {
        round: currentRound, pickInRound: currentPickInRound, overallPick,
        teamId: team.id, teamName: team.name, player, timestamp: Date.now(),
      };
      const updated = [...picks, newPick];
      applyPicks(updated);
      setTimer(90);
      setShowPickBanner(newPick);
      setTimeout(() => setShowPickBanner(null), 2500);

      const serialized: SerializedPick = {
        round: currentRound, pickInRound: currentPickInRound, overallPick,
        teamId: team.id, teamName: team.name, playerId: player.id, timestamp: newPick.timestamp,
      };
      if (channelRef.current) {
        channelRef.current.send({ type: "broadcast", event: "pick", payload: serialized });
      }
    } catch (err) {
      console.error("Pick error:", err);
      alert("选择失败");
    }
    setPicking(false);
  }, [isMyTurn, picking, draftComplete, currentTeam, currentRound, currentPickInRound, overallPick, picks, applyPicks]);

  const timerColor = timer <= 10 ? "#dc2626" : timer <= 30 ? "#f59e0b" : "#15803d";

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏀</div>
          <p style={{ color: "#6b7280", fontSize: 15 }}>加载选秀数据...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", fontFamily: FONT }}>

      {/* Top Bar */}
      <div style={{ background: "#1e3a8a", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 22 }}>🏀</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{league.name}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              {league.draft_type === "snake" ? "蛇形选秀" : "线性选秀"} · {numTeams} 支队伍 · {TOTAL_ROUNDS} 轮
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {!draftComplete && (
            <>
              <div style={{ background: "rgba(255,255,255,0.12)", padding: "5px 14px", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>轮次</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#f59e0b" }}>{currentRound}/{TOTAL_ROUNDS}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", padding: "5px 14px", borderRadius: 8, textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>顺位</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: "#f59e0b" }}>#{overallPick}</div>
              </div>
              <div style={{ background: "rgba(255,255,255,0.12)", padding: "5px 14px", borderRadius: 8, textAlign: "center", minWidth: 64 }}>
                <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.5px" }}>倒计时</div>
                <div style={{ fontWeight: 800, fontSize: 17, color: timerColor, fontVariantNumeric: "tabular-nums" }}>
                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, "0")}
                </div>
              </div>
            </>
          )}

          {!draftComplete && currentTeam && (
            <div style={{ background: isMyTurn ? "#15803d" : "rgba(255,255,255,0.12)", padding: "7px 16px", borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {isMyTurn ? "轮到你了!" : "正在选秀"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 13, color: "#fff" }}>{currentTeam.name}</div>
            </div>
          )}

          {draftComplete && (
            <div style={{ background: "#1e3a8a", padding: "8px 20px", borderRadius: 8, fontWeight: 700, color: "#fff", fontSize: 14 }}>
              🏆 选秀完成!
            </div>
          )}
        </div>
      </div>

      {/* Pick announcement banner */}
      {showPickBanner && (
        <div style={{
          background: showPickBanner.teamId === myTeam.id ? "#15803d" : "#1e3a8a",
          padding: "9px 20px", textAlign: "center", fontWeight: 600, fontSize: 13, color: "#fff",
        }}>
          第{showPickBanner.round}轮 #{showPickBanner.overallPick} — {showPickBanner.teamName} 选择了 {showPickBanner.player.name} ({showPickBanner.player.team} · {showPickBanner.player.position})
        </div>
      )}

      {/* Mobile: My Team toggle */}
      {isMobile && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 14px", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={() => setShowRightPanel(o => !o)} style={{ padding: "6px 14px", background: showRightPanel ? "#eff6ff" : "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 700, color: showRightPanel ? "#1e3a8a" : "#374151", cursor: "pointer" }}>
            {showRightPanel ? "▲ 收起阵容" : `▼ 我的阵容 (${myPicks.length})`}
          </button>
        </div>
      )}

      {/* Mobile: collapsible roster panel */}
      {isMobile && showRightPanel && (
        <div style={{ background: "#fff", borderBottom: "2px solid #e5e7eb", maxHeight: 260, overflowY: "auto", padding: "6px 8px" }}>
          {myPicks.length === 0 ? (
            <div style={{ textAlign: "center", padding: "20px 16px", color: "#9ca3af", fontSize: 13 }}>
              {isMyTurn ? "轮到你了，请选择球员!" : "等待其他队伍选秀..."}
            </div>
          ) : (
            myPicks.map((pick, i) => (
              <div key={pick.player.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: i % 2 === 0 ? "#f9fafb" : "#fff", borderRadius: 8, marginBottom: 2 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1e3a8a", flexShrink: 0 }}>R{pick.round}</div>
                <PlayerAvatar name={pick.player.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.player.name}</div>
                  <div style={{ fontSize: 10, color: "#9ca3af" }}>{pick.player.team} · {pick.player.position}</div>
                </div>
                <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>{pick.player.ppg}</div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Left: Available Players */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", borderRight: isMobile ? "none" : "1px solid #e5e7eb", minWidth: 0 }}>

          {/* Search & Filter */}
          <div style={{ padding: "10px 14px", background: "#fff", borderBottom: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="搜索球员..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setPlayerPage(1); }}
              style={{ flex: 1, minWidth: 120, padding: "7px 12px", background: "#f9fafb", border: "1.5px solid #e5e7eb", borderRadius: 8, color: "#111827", fontSize: 13, outline: "none", fontFamily: FONT }}
            />
            {["ALL", "PG", "SG", "SF", "PF", "C"].map(pos => (
              <button key={pos} onClick={() => { setPosFilter(pos); setPlayerPage(1); }} style={{ padding: "5px 10px", background: posFilter === pos ? "#1e3a8a" : "#f3f4f6", color: posFilter === pos ? "#fff" : "#6b7280", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: FONT }}>
                {pos}
              </button>
            ))}
            <span style={{ fontSize: 12, color: "#9ca3af" }}>{availablePlayers.length} 人可选</span>
          </div>

          {/* Player list header */}
          <div style={{ display: "grid", gridTemplateColumns: "36px 180px 52px 36px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 60px 70px", padding: "5px 12px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", fontSize: 10, color: "#6b7280", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", minWidth: "max-content" }}>
            <span>#</span><span>球员</span><span>位置</span>
            <span>GP</span><span>MIN</span><span>FGM</span><span>FGA</span>
            <span>FTM</span><span>FTA</span><span>3PM</span>
            <span>REB</span><span>AST</span><span>STL</span><span>BLK</span><span>TO</span><span>PTS</span>
            <span style={{ color: "#1e3a8a" }}>FPTS</span>
            <span style={{ textAlign: "center" }}>{isMyTurn ? "选择" : ""}</span>
          </div>

          {/* Player list */}
          <div style={{ flex: 1, overflowY: "auto", overflowX: "auto", background: "#fff" }}>
            {paginatedPlayers.map((player, idx) => {
              const s = statsMap[player.name];
              const fmt = (v?: number) => v != null ? v.toFixed(1) : "—";
              return (
                <div
                  key={player.id}
                  onClick={() => isMyTurn && !picking && handlePlayerPick(player)}
                  style={{ display: "grid", gridTemplateColumns: "36px 180px 52px 36px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 44px 60px 70px", padding: "7px 12px", background: idx % 2 === 0 ? "#fff" : "#f9fafb", cursor: isMyTurn ? "pointer" : "default", borderBottom: "1px solid #f3f4f6", transition: "background 0.12s", alignItems: "center", opacity: picking ? 0.6 : 1, minWidth: "max-content" }}
                  onMouseEnter={e => { if (isMyTurn) (e.currentTarget as HTMLElement).style.background = "#eff6ff"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? "#fff" : "#f9fafb"; }}
                >
                  <span style={{ color: "#9ca3af", fontWeight: 600, fontSize: 11 }}>#{player.rank}</span>
                  <PlayerAvatar name={player.name} size={28} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 12, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {player.name}
                      {player.injury && (
                        <span style={{ marginLeft: 5, padding: "1px 5px", background: player.injury === "Out" ? "#fee2e2" : "#fef3c7", color: player.injury === "Out" ? "#dc2626" : "#92400e", borderRadius: 4, fontSize: 9, fontWeight: 700 }}>
                          {player.injury}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 10, color: "#9ca3af" }}>{player.team}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#6b7280" }}>{player.position}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{s?.gamesPlayed ?? "—"}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.min)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.fgm)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.fga)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.ftm)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.fta)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.fg3m)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.reb)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.ast)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.stl)}</span>
                  <span style={{ fontSize: 11, color: "#374151" }}>{fmt(s?.blk)}</span>
                  <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>{fmt(s?.tov)}</span>
                  <span style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700 }}>{fmt(s?.pts)}</span>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", lineHeight: 1.2 }}>
                    <span style={{ fontSize: 10, color: "#9ca3af" }}>{s ? s.fpts : "—"}</span>
                    <span style={{ fontSize: 12, color: "#1e3a8a", fontWeight: 700 }}>{s ? s.fptsAvg : "—"}</span>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    {isMyTurn && (
                      <button
                        onClick={e => { e.stopPropagation(); handlePlayerPick(player); }}
                        disabled={picking}
                        style={{ padding: "4px 10px", background: picking ? "#e5e7eb" : "#1e3a8a", color: picking ? "#9ca3af" : "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: picking ? "not-allowed" : "pointer", fontFamily: FONT }}
                      >
                        {picking ? "..." : "选择"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPlayerPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, padding: "8px 12px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", fontFamily: FONT }}>
              <button
                onClick={() => setPlayerPage(p => Math.max(1, p - 1))}
                disabled={playerPage === 1}
                style={{ padding: "5px 12px", fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, cursor: playerPage === 1 ? "not-allowed" : "pointer", color: playerPage === 1 ? "#d1d5db" : "#374151", fontFamily: FONT }}
              >
                ← 上一页
              </button>
              {(() => {
                const start = Math.max(1, Math.min(playerPage - 2, totalPlayerPages - 4));
                const end = Math.min(totalPlayerPages, start + 4);
                return Array.from({ length: end - start + 1 }, (_, i) => start + i).map(pageNum => (
                  <button
                    key={pageNum}
                    onClick={() => setPlayerPage(pageNum)}
                    style={{ width: 30, height: 30, fontSize: 12, fontWeight: pageNum === playerPage ? 700 : 400, background: pageNum === playerPage ? "#1e3a8a" : "#fff", color: pageNum === playerPage ? "#fff" : "#374151", border: pageNum === playerPage ? "none" : "1px solid #e5e7eb", borderRadius: 6, cursor: "pointer", fontFamily: FONT }}
                  >
                    {pageNum}
                  </button>
                ));
              })()}
              <button
                onClick={() => setPlayerPage(p => Math.min(totalPlayerPages, p + 1))}
                disabled={playerPage === totalPlayerPages}
                style={{ padding: "5px 12px", fontSize: 12, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 6, cursor: playerPage === totalPlayerPages ? "not-allowed" : "pointer", color: playerPage === totalPlayerPages ? "#d1d5db" : "#374151", fontFamily: FONT }}
              >
                下一页 →
              </button>
            </div>
          )}
        </div>

        {/* Right panel — hidden on mobile (shown as collapsible above) */}
        <div style={{ width: 300, display: isMobile ? "none" : "flex", flexDirection: "column", background: "#fff", flexShrink: 0, borderLeft: "1px solid #e5e7eb" }}>

          {/* My Team Roster */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ padding: "11px 16px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>{myTeam.name}</div>
                <div style={{ fontSize: 11, color: "#6b7280" }}>选秀位: #{myTeam.draft_position}</div>
              </div>
              <div style={{ padding: "3px 10px", background: "#dbeafe", borderRadius: 20, fontSize: 12, fontWeight: 700, color: "#1e3a8a" }}>
                {myPicks.length}/{TOTAL_ROUNDS}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
              {myPicks.length === 0 ? (
                <div style={{ textAlign: "center", padding: "28px 16px", color: "#9ca3af", fontSize: 13 }}>
                  {isMyTurn ? "轮到你了，请选择球员!" : "等待其他队伍选秀..."}
                </div>
              ) : (
                myPicks.map((pick, i) => (
                  <div key={pick.player.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: i % 2 === 0 ? "#f9fafb" : "#fff", borderRadius: 8, marginBottom: 2 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#dbeafe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#1e3a8a", flexShrink: 0 }}>
                      R{pick.round}
                    </div>
                    <PlayerAvatar name={pick.player.name} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 12, color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pick.player.name}</div>
                      <div style={{ fontSize: 10, color: "#9ca3af" }}>{pick.player.team} · {pick.player.position}</div>
                    </div>
                    <div style={{ fontSize: 11, color: "#f59e0b", fontWeight: 700, flexShrink: 0 }}>{pick.player.ppg}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Draft log */}
          <div style={{ height: 220, display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "9px 16px", background: "#f3f4f6", borderBottom: "1px solid #e5e7eb", fontWeight: 700, fontSize: 12, color: "#374151" }}>
              选秀记录 ({picks.length})
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "4px 8px" }}>
              {picks.length === 0 ? (
                <div style={{ textAlign: "center", padding: 20, color: "#9ca3af", fontSize: 12 }}>暂无记录</div>
              ) : (
                [...picks].reverse().map((pick) => (
                  <div key={pick.overallPick} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderBottom: "1px solid #f9fafb", fontSize: 11 }}>
                    <span style={{ color: "#9ca3af", fontWeight: 600, width: 24, flexShrink: 0 }}>#{pick.overallPick}</span>
                    <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: pick.teamId === myTeam.id ? "#1e3a8a" : "#374151", fontWeight: pick.teamId === myTeam.id ? 700 : 400 }}>
                      {pick.player.name}
                    </span>
                    <span style={{ color: "#9ca3af", fontSize: 10, flexShrink: 0 }}>{pick.teamName}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Draft complete overlay */}
      {draftComplete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "36px 40px", textAlign: "center", maxWidth: 500, width: "90%", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏆</div>
            <h2 style={{ margin: "0 0 8px 0", fontSize: 24, fontWeight: 800, color: "#111827" }}>选秀完成!</h2>
            <p style={{ color: "#6b7280", marginBottom: 20, fontSize: 14 }}>
              恭喜! 你的队伍 &ldquo;{myTeam.name}&rdquo; 已选择 {myPicks.length} 名球员
            </p>
            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20, textAlign: "left", maxHeight: 280, overflowY: "auto" }}>
              <div style={{ fontWeight: 700, marginBottom: 10, color: "#374151", fontSize: 12 }}>你的阵容:</div>
              {myPicks.map((pick, i) => (
                <div key={pick.player.id} style={{ display: "flex", alignItems: "center", padding: "5px 0", borderBottom: i < myPicks.length - 1 ? "1px solid #f3f4f6" : "none", fontSize: 12 }}>
                  <span style={{ color: "#9ca3af", width: 24 }}>R{pick.round}</span>
                  <PlayerAvatar name={pick.player.name} size={24} style={{ marginLeft: 6 }} />
                  <span style={{ flex: 1, marginLeft: 8, fontWeight: 600, color: "#111827" }}>{pick.player.name}</span>
                  <span style={{ color: "#6b7280" }}>{pick.player.position}</span>
                  <span style={{ color: "#1e3a8a", marginLeft: 10, fontWeight: 700 }}>{pick.player.ppg} PPG</span>
                </div>
              ))}
            </div>
            <button onClick={onDraftComplete} style={{ padding: "12px 32px", background: "#1e3a8a", color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer", fontFamily: FONT }}>
              返回联赛
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
