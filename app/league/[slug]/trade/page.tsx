"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import { PLAYER_POSITIONS } from "@/lib/player-positions";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueTrades,
  getLeagueRosters,
  fetchTeamRosterFromDB,
  fetchLeagueRostersFromDB,
  proposeTrade,
  respondToTrade,
  cancelTrade,
  League,
  RosterPlayer,
  TradeProposal,
} from "@/lib/store";
import { supabase } from "@/lib/supabase";

type TeamInfo = { id: string; name: string; user_id: string };

type LivePlayerStats = {
  id: number;
  name: string;
  averages: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fg3m: number };
  fptsAvg: number;
};

export default function TradePage() {
  const { t } = useLang();
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [myTeam, setMyTeam] = useState<TeamInfo | null>(null);
  const [allTeams, setAllTeams] = useState<TeamInfo[]>([]);
  const [trades, setTrades] = useState<TradeProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Check URL params for default tab (from email link)
  const defaultTab = searchParams.get("tab") === "pending" ? "pending" : "propose";
  const [tab, setTab] = useState<"propose" | "pending" | "history">(defaultTab as "propose" | "pending" | "history");

  // Propose trade state
  const [targetTeamId, setTargetTeamId] = useState<string | null>(null);
  const [myRoster, setMyRoster] = useState<RosterPlayer[]>([]);
  const [targetRoster, setTargetRoster] = useState<RosterPlayer[]>([]);
  const [offeredIds, setOfferedIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [tradeMessage, setTradeMessage] = useState("");

  // Live stats from BDL API
  const [liveStats, setLiveStats] = useState<Map<string, LivePlayerStats>>(new Map());
  // All league rosters cache (loaded from DB for name lookups)
  const [allRostersCache, setAllRostersCache] = useState<Record<string, RosterPlayer[]>>({});

  // ── Helper functions (declared before hooks that reference them) ──

  function getLivePPG(player: RosterPlayer): string {
    const stats = liveStats.get(player.id) || liveStats.get(player.name);
    if (stats) return stats.averages.pts.toFixed(1);
    return player.ppg.toFixed(1);
  }

  function getLiveFPTS(player: RosterPlayer): string {
    const stats = liveStats.get(player.id) || liveStats.get(player.name);
    if (stats) return stats.fptsAvg.toFixed(1);
    return "-";
  }

  // ── Data loading functions ──

  async function fetchLiveStats() {
    try {
      const res = await fetch("/api/nba-stats");
      const data = await res.json();
      if (data.status === "success" && data.players) {
        const map = new Map<string, LivePlayerStats>();
        for (const p of data.players) {
          map.set(String(p.id), p);
          // Also key by name for fallback matching
          map.set(p.name, p);
        }
        setLiveStats(map);
      }
    } catch (err) {
      console.error("Failed to fetch live stats:", err);
    }
  }

  async function reloadTrades() {
    if (!league) return;
    const tradeData = await getLeagueTrades(league.id);
    setTrades(tradeData);
  }

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (!leagueData) { setLoading(false); return; }
    setLeague(leagueData);

    const { data: teamsData } = await supabase
      .from("fantasy_teams")
      .select("id, name, user_id")
      .eq("league_id", leagueData.id);
    setAllTeams(teamsData || []);

    const currentUser = getSessionUser();
    if (currentUser && teamsData) {
      const myT = teamsData.find((t: TeamInfo) => t.user_id === currentUser.id);
      if (myT) {
        setMyTeam(myT);
        setMyRoster(await fetchTeamRosterFromDB(leagueData.id, myT.id));
      }
    }

    // Load all rosters from DB for player name lookups
    const rostersData = await fetchLeagueRostersFromDB(leagueData.id);
    setAllRostersCache(rostersData);

    const tradeData = await getLeagueTrades(leagueData.id);
    setTrades(tradeData);
    setLoading(false);
  }

  // ── Effects (after function declarations) ──

  const [initialized, setInitialized] = useState(false);
  if (!initialized) {
    setUser(getSessionUser());
    setInitialized(true);
  }

  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    loadData();
    fetchLiveStats();
  }, [slug]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

  useEffect(() => {
    if (!league) return;
    const channel = supabase
      .channel(`trade_page_${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_proposals",
          filter: `league_id=eq.${league.id}`,
        },
        () => {
          reloadTrades();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [league?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function selectTargetTeam(teamId: string) {
    if (!league) return;
    setTargetTeamId(teamId);
    setTargetRoster(await fetchTeamRosterFromDB(league.id, teamId));
    setOfferedIds(new Set());
    setRequestedIds(new Set());
    setTradeMessage("");
  }

  function toggleOffered(playerId: string) {
    const next = new Set(offeredIds);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    setOfferedIds(next);
  }

  function toggleRequested(playerId: string) {
    const next = new Set(requestedIds);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    setRequestedIds(next);
  }

  async function handlePropose() {
    if (!league || !myTeam || !targetTeamId || submitting) return;
    if (offeredIds.size === 0 || requestedIds.size === 0) {
      alert(t("请至少选择一名己方球员和一名对方球员", "Select at least one player from each side"));
      return;
    }
    const targetTeam = allTeams.find(t => t.id === targetTeamId);
    if (!targetTeam) return;

    setSubmitting(true);

    const result = await proposeTrade({
      leagueId: league.id,
      fromTeamId: myTeam.id,
      fromTeamName: myTeam.name,
      toTeamId: targetTeamId,
      toTeamName: targetTeam.name,
      offeredPlayerIds: Array.from(offeredIds),
      requestedPlayerIds: Array.from(requestedIds),
      message: tradeMessage || undefined,
    });

    if (!result.ok) {
      alert(result.error);
      setSubmitting(false);
      return;
    }

    // Send email notification to the target team's owner
    try {
      const { data: targetUser } = await supabase
        .from("users")
        .select("email, name")
        .eq("id", targetTeam.user_id)
        .single();

      if (targetUser?.email) {
        const offeredNames = Array.from(offeredIds).map(id => {
          const p = myRoster.find(r => r.id === id);
          return p ? `${p.name} (${getLivePPG(p)} PPG)` : id;
        });
        const requestedNames = Array.from(requestedIds).map(id => {
          const p = targetRoster.find(r => r.id === id);
          return p ? `${p.name} (${getLivePPG(p)} PPG)` : id;
        });

        fetch("/api/trade-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            toEmail: targetUser.email,
            toName: targetUser.name,
            fromTeamName: myTeam.name,
            toTeamName: targetTeam.name,
            leagueSlug: slug,
            leagueName: league.name,
            offeredPlayers: offeredNames,
            requestedPlayers: requestedNames,
            message: tradeMessage || undefined,
          }),
        }).catch(() => {}); // Fire and forget
      }
    } catch {}

    const tradeData = await getLeagueTrades(league.id);
    setTrades(tradeData);
    setTargetTeamId(null);
    setOfferedIds(new Set());
    setRequestedIds(new Set());
    setTradeMessage("");
    setTab("pending");
    setSubmitting(false);
  }

  async function handleRespond(tradeId: string, accept: boolean) {
    if (!league || submitting) return;
    const action = accept ? t("接受", "accept") : t("拒绝", "reject");
    if (!confirm(t(`确定要${action}这笔交易吗？`, `Are you sure you want to ${action} this trade?`))) return;

    setSubmitting(true);
    const result = await respondToTrade(league.id, tradeId, accept);
    if (!result.ok) {
      alert(result.error);
      setSubmitting(false);
      return;
    }

    // Reload trades and BOTH rosters after acceptance
    const tradeData = await getLeagueTrades(league.id);
    setTrades(tradeData);
    if (myTeam) {
      setMyRoster(await fetchTeamRosterFromDB(league.id, myTeam.id));
    }
    // Also refresh target roster if we're viewing one
    if (targetTeamId) {
      setTargetRoster(await fetchTeamRosterFromDB(league.id, targetTeamId));
    }
    // Refresh all rosters cache for name lookups
    setAllRostersCache(await fetchLeagueRostersFromDB(league.id));
    setSubmitting(false);
  }

  async function handleCancel(tradeId: string) {
    if (!league || submitting) return;
    if (!confirm(t("确定要取消这笔交易吗？", "Cancel this trade?"))) return;

    setSubmitting(true);
    await cancelTrade(league.id, tradeId);
    const tradeData = await getLeagueTrades(league.id);
    setTrades(tradeData);
    setSubmitting(false);
  }

  // BUG FIX: Search ALL rosters in the league for the player name.
  // After a trade is accepted, players move to the other team, so looking
  // only on the original team would fail and show raw IDs.
  function getPlayerName(playerId: string): string {
    if (!league) return playerId;
    for (const roster of Object.values(allRostersCache)) {
      const found = roster.find((p: RosterPlayer) => p.id === playerId);
      if (found) return found.name;
    }
    // Fallback: check live stats by ID
    const stats = liveStats.get(playerId);
    if (stats) return stats.name;
    return playerId;
  }

  function getPlayerPPGById(playerId: string): string {
    // Try live stats first
    const stats = liveStats.get(playerId);
    if (stats) return stats.averages.pts.toFixed(1);
    // Fallback to roster data
    if (!league) return "-";
    for (const roster of Object.values(allRostersCache)) {
      const found = roster.find((p: RosterPlayer) => p.id === playerId);
      if (found) return found.ppg.toFixed(1);
    }
    return "-";
  }

  const isOwner = user && league && league.commissioner_id === user.id;
  const otherTeams = allTeams.filter(t => t.id !== myTeam?.id);
  const pendingTrades = trades.filter(t => t.status === "pending");
  const myPendingReceived = pendingTrades.filter(t => t.toTeamId === myTeam?.id);
  const myPendingSent = pendingTrades.filter(t => t.fromTeamId === myTeam?.id);
  const historyTrades = trades.filter(t => t.status !== "pending");

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="loading-container"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app">
        <Header />
        <div className="error-container"><p>{t("联赛不存在", "League not found")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon">🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>🔄 {t("球员交易", "Trades")}</h1>
            <p>{t("与其他队伍交换球员", "Trade players with other teams")}</p>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === "propose" ? "active" : ""}`} onClick={() => setTab("propose")}>
              {t("发起交易", "Propose")}
            </button>
            <button className={`tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>
              {t("待处理", "Pending")}
              {myPendingReceived.length > 0 && <span className="badge">{myPendingReceived.length}</span>}
            </button>
            <button className={`tab ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
              {t("交易历史", "History")}
            </button>
          </div>

          {/* Propose Trade Tab */}
          {tab === "propose" && (
            <div className="propose-section">
              {!myTeam ? (
                <div className="empty-state">{t("请先加入联赛", "Join the league first")}</div>
              ) : !targetTeamId ? (
                <>
                  <p className="select-label">{t("选择交易对手：", "Select a team to trade with:")}</p>
                  <div className="team-grid">
                    {otherTeams.map(team => {
                      const teamRoster = allRostersCache[team.id] || [];
                      return (
                        <div key={team.id} className="team-card" onClick={() => selectTargetTeam(team.id)}>
                          <div className="team-card-name">{team.name}</div>
                          <div className="team-card-count">{teamRoster.length} {t("名球员", "players")}</div>
                        </div>
                      );
                    })}
                  </div>
                  {otherTeams.length === 0 && (
                    <div className="empty-state">{t("联赛中没有其他队伍", "No other teams in this league")}</div>
                  )}
                </>
              ) : (
                <>
                  <button className="back-btn" onClick={() => setTargetTeamId(null)}>
                    ← {t("选择其他队伍", "Pick different team")}
                  </button>

                  <div className="trade-board">
                    {/* My side */}
                    <div className="trade-side">
                      <div className="side-header">{t("你的球员", "Your Players")} ({myTeam.name})</div>
                      <p className="side-hint">{t("点击选择要送出的球员", "Click to select players to offer")}</p>
                      <div className="player-list">
                        {myRoster.map(p => (
                          <div
                            key={p.id}
                            className={`trade-player ${offeredIds.has(p.id) ? "selected" : ""}`}
                            onClick={() => toggleOffered(p.id)}
                          >
                            <div className="tp-info">
                              <span className="tp-name">{p.name}</span>
                              <span className="tp-meta">{p.team} · {PLAYER_POSITIONS[p.name] || p.position}</span>
                            </div>
                            <div className="tp-stats">
                              <span className="tp-ppg">{getLivePPG(p)} PPG</span>
                              <span className="tp-fpts">{getLiveFPTS(p)} FPTS</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="trade-arrow">⇄</div>

                    {/* Target side */}
                    <div className="trade-side">
                      <div className="side-header">{t("对方球员", "Their Players")} ({allTeams.find(t => t.id === targetTeamId)?.name})</div>
                      <p className="side-hint">{t("点击选择要获取的球员", "Click to select players to request")}</p>
                      <div className="player-list">
                        {targetRoster.map(p => (
                          <div
                            key={p.id}
                            className={`trade-player ${requestedIds.has(p.id) ? "selected" : ""}`}
                            onClick={() => toggleRequested(p.id)}
                          >
                            <div className="tp-info">
                              <span className="tp-name">{p.name}</span>
                              <span className="tp-meta">{p.team} · {PLAYER_POSITIONS[p.name] || p.position}</span>
                            </div>
                            <div className="tp-stats">
                              <span className="tp-ppg">{getLivePPG(p)} PPG</span>
                              <span className="tp-fpts">{getLiveFPTS(p)} FPTS</span>
                            </div>
                          </div>
                        ))}
                        {targetRoster.length === 0 && (
                          <div className="empty-state small">{t("该队伍没有球员", "This team has no players")}</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trade summary */}
                  {(offeredIds.size > 0 || requestedIds.size > 0) && (
                    <div className="trade-summary">
                      <div className="summary-title">{t("交易概要", "Trade Summary")}</div>
                      <div className="summary-content">
                        <div className="summary-side">
                          <div className="summary-label">{t("送出", "You Send")}:</div>
                          {Array.from(offeredIds).map(id => {
                            const p = myRoster.find(r => r.id === id);
                            return p && <div key={id} className="summary-player out">{p.name} ({getLivePPG(p)} PPG)</div>;
                          })}
                          {offeredIds.size === 0 && <div className="summary-empty">{t("未选择", "None")}</div>}
                        </div>
                        <div className="summary-arrow">→</div>
                        <div className="summary-side">
                          <div className="summary-label">{t("获得", "You Get")}:</div>
                          {Array.from(requestedIds).map(id => {
                            const p = targetRoster.find(r => r.id === id);
                            return p && <div key={id} className="summary-player in">{p.name} ({getLivePPG(p)} PPG)</div>;
                          })}
                          {requestedIds.size === 0 && <div className="summary-empty">{t("未选择", "None")}</div>}
                        </div>
                      </div>

                      <textarea
                        className="trade-msg"
                        placeholder={t("添加交易说明（可选）...", "Add a message (optional)...")}
                        value={tradeMessage}
                        onChange={(e) => setTradeMessage(e.target.value)}
                        rows={2}
                      />

                      <button
                        className="propose-btn"
                        onClick={handlePropose}
                        disabled={offeredIds.size === 0 || requestedIds.size === 0 || submitting}
                      >
                        {submitting ? t("发送中...", "Sending...") : t("发送交易提案", "Send Trade Proposal")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Pending Tab */}
          {tab === "pending" && (
            <div className="pending-section">
              {myPendingReceived.length > 0 && (
                <>
                  <div className="pending-label">{t("收到的交易", "Received Proposals")}</div>
                  {myPendingReceived.map(trade => (
                    <div key={trade.id} className="trade-card">
                      <div className="tc-header">
                        <span className="tc-from">{trade.fromTeamName}</span>
                        <span className="tc-arrow">→</span>
                        <span className="tc-to">{trade.toTeamName}</span>
                        <span className="tc-time">{new Date(trade.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="tc-body">
                        <div className="tc-side">
                          <div className="tc-label">{t("对方送出", "They Send")}:</div>
                          {trade.offeredPlayerIds.map(id => (
                            <div key={id} className="tc-player">
                              {getPlayerName(id)}
                              <span className="tc-player-ppg">{getPlayerPPGById(id)} PPG</span>
                            </div>
                          ))}
                        </div>
                        <div className="tc-side">
                          <div className="tc-label">{t("对方想要", "They Want")}:</div>
                          {trade.requestedPlayerIds.map(id => (
                            <div key={id} className="tc-player">
                              {getPlayerName(id)}
                              <span className="tc-player-ppg">{getPlayerPPGById(id)} PPG</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {trade.message && <div className="tc-message">{trade.message}</div>}
                      <div className="tc-actions">
                        <button className="accept-btn" onClick={() => handleRespond(trade.id, true)} disabled={submitting}>
                          {t("接受", "Accept")}
                        </button>
                        <button className="reject-btn" onClick={() => handleRespond(trade.id, false)} disabled={submitting}>
                          {t("拒绝", "Reject")}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {myPendingSent.length > 0 && (
                <>
                  <div className="pending-label">{t("发出的交易", "Sent Proposals")}</div>
                  {myPendingSent.map(trade => (
                    <div key={trade.id} className="trade-card">
                      <div className="tc-header">
                        <span className="tc-from">{trade.fromTeamName}</span>
                        <span className="tc-arrow">→</span>
                        <span className="tc-to">{trade.toTeamName}</span>
                        <span className="tc-time">{new Date(trade.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className="tc-body">
                        <div className="tc-side">
                          <div className="tc-label">{t("送出", "Sending")}:</div>
                          {trade.offeredPlayerIds.map(id => (
                            <div key={id} className="tc-player">
                              {getPlayerName(id)}
                              <span className="tc-player-ppg">{getPlayerPPGById(id)} PPG</span>
                            </div>
                          ))}
                        </div>
                        <div className="tc-side">
                          <div className="tc-label">{t("获得", "Getting")}:</div>
                          {trade.requestedPlayerIds.map(id => (
                            <div key={id} className="tc-player">
                              {getPlayerName(id)}
                              <span className="tc-player-ppg">{getPlayerPPGById(id)} PPG</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="tc-actions">
                        <span className="pending-badge">{t("等待对方回复", "Waiting for response")}</span>
                        <button className="cancel-btn" onClick={() => handleCancel(trade.id)} disabled={submitting}>
                          {t("取消", "Cancel")}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {myPendingReceived.length === 0 && myPendingSent.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon">🔄</div>
                  <p>{t("没有待处理的交易", "No pending trades")}</p>
                </div>
              )}
            </div>
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="history-section">
              {historyTrades.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📜</div>
                  <p>{t("还没有交易历史", "No trade history yet")}</p>
                </div>
              ) : (
                historyTrades.map(trade => (
                  <div key={trade.id} className="trade-card">
                    <div className="tc-header">
                      <span className="tc-from">{trade.fromTeamName}</span>
                      <span className="tc-arrow">→</span>
                      <span className="tc-to">{trade.toTeamName}</span>
                      <span className={`status-badge ${trade.status}`}>
                        {trade.status === "accepted" ? t("已完成", "Completed") :
                         trade.status === "rejected" ? t("已拒绝", "Rejected") :
                         t("已取消", "Cancelled")}
                      </span>
                    </div>
                    <div className="tc-body">
                      <div className="tc-side">
                        <div className="tc-label">{t("送出", "Sent")}:</div>
                        {trade.offeredPlayerIds.map(id => (
                          <div key={id} className="tc-player">{getPlayerName(id)}</div>
                        ))}
                      </div>
                      <div className="tc-side">
                        <div className="tc-label">{t("获得", "Got")}:</div>
                        {trade.requestedPlayerIds.map(id => (
                          <div key={id} className="tc-player">{getPlayerName(id)}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: linear-gradient(135deg, #1a237e 0%, #0d1442 100%);
    border-bottom: 1px solid #283593;
  }
  .league-header-inner { max-width: 1200px; margin: 0 auto; padding: 16px; }
  .league-title { display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; font-size: 20px; font-weight: 600; }
  .league-icon { font-size: 28px; }
  .page-content { min-height: calc(100vh - 200px); background: #0a0a0a; padding: 24px 16px; }
  .container { max-width: 1200px; margin: 0 auto; }
  .page-header { margin-bottom: 24px; }
  .page-header h1 { font-size: 24px; font-weight: 700; color: #fff; margin: 0 0 8px 0; }
  .page-header p { font-size: 14px; color: #888; margin: 0; }

  .tabs { display: flex; gap: 4px; margin-bottom: 24px; }
  .tab {
    padding: 10px 20px; background: #1a1a1a; border: 1px solid #333;
    border-radius: 8px; color: #888; font-size: 14px; cursor: pointer;
    display: flex; align-items: center; gap: 8px;
  }
  .tab.active { background: rgba(245, 158, 11, 0.15); border-color: #f59e0b; color: #f59e0b; }
  .badge {
    background: #ef4444; color: #fff; padding: 1px 7px; border-radius: 10px;
    font-size: 11px; font-weight: 700;
  }

  .select-label { color: #888; font-size: 14px; margin: 0 0 16px 0; }
  .team-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
  .team-card {
    background: #111; border: 1px solid #222; border-radius: 12px;
    padding: 20px; cursor: pointer; transition: all 0.15s;
  }
  .team-card:hover { border-color: #f59e0b; background: rgba(245, 158, 11, 0.05); }
  .team-card-name { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 4px; }
  .team-card-count { font-size: 13px; color: #888; }

  .back-btn {
    padding: 8px 16px; background: #1a1a1a; border: 1px solid #333;
    border-radius: 8px; color: #888; font-size: 13px; cursor: pointer; margin-bottom: 20px;
  }
  .back-btn:hover { color: #fff; }

  .trade-board { display: grid; grid-template-columns: 1fr 40px 1fr; gap: 12px; align-items: start; }
  .trade-arrow { text-align: center; font-size: 24px; color: #f59e0b; padding-top: 60px; }
  .trade-side { background: #111; border: 1px solid #222; border-radius: 12px; overflow: hidden; }
  .side-header { padding: 14px 16px; background: #1a1a1a; border-bottom: 1px solid #222; font-weight: 600; color: #fff; font-size: 14px; }
  .side-hint { padding: 8px 16px; margin: 0; font-size: 12px; color: #555; }
  .player-list { max-height: 400px; overflow-y: auto; }
  .trade-player {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 16px; border-bottom: 1px solid #1a1a1a; cursor: pointer;
  }
  .trade-player:hover { background: rgba(245, 158, 11, 0.03); }
  .trade-player.selected { background: rgba(245, 158, 11, 0.1); border-left: 3px solid #f59e0b; }
  .tp-info { display: flex; flex-direction: column; gap: 2px; }
  .tp-name { font-size: 14px; color: #fff; font-weight: 500; }
  .tp-meta { font-size: 12px; color: #888; }
  .tp-stats { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .tp-ppg { font-size: 13px; color: #f59e0b; font-weight: 600; }
  .tp-fpts { font-size: 11px; color: #888; }

  .trade-summary {
    background: #111; border: 1px solid #f59e0b; border-radius: 12px;
    padding: 20px; margin-top: 20px;
  }
  .summary-title { font-size: 16px; font-weight: 600; color: #f59e0b; margin-bottom: 16px; }
  .summary-content { display: flex; gap: 20px; align-items: flex-start; }
  .summary-side { flex: 1; }
  .summary-arrow { font-size: 20px; color: #f59e0b; padding-top: 20px; }
  .summary-label { font-size: 12px; color: #888; text-transform: uppercase; margin-bottom: 8px; }
  .summary-player { padding: 6px 0; font-size: 14px; }
  .summary-player.out { color: #fca5a5; }
  .summary-player.in { color: #6ee7b7; }
  .summary-empty { color: #555; font-size: 13px; }
  .trade-msg {
    width: 100%; margin-top: 16px; padding: 10px 14px;
    background: #0a0a0a; border: 1px solid #333; border-radius: 8px;
    color: #fff; font-size: 14px; resize: none; outline: none; box-sizing: border-box;
  }
  .propose-btn {
    margin-top: 16px; width: 100%; padding: 14px;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000; border: none; border-radius: 8px;
    font-weight: 700; font-size: 15px; cursor: pointer;
  }
  .propose-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .pending-label { font-size: 14px; font-weight: 600; color: #f59e0b; margin: 0 0 12px 0; text-transform: uppercase; }
  .trade-card {
    background: #111; border: 1px solid #222; border-radius: 12px;
    margin-bottom: 16px; overflow: hidden;
  }
  .tc-header {
    padding: 14px 16px; background: #1a1a1a; border-bottom: 1px solid #222;
    display: flex; align-items: center; gap: 8px; font-size: 14px;
  }
  .tc-from { color: #fff; font-weight: 600; }
  .tc-arrow { color: #f59e0b; }
  .tc-to { color: #fff; font-weight: 600; }
  .tc-time { margin-left: auto; color: #555; font-size: 12px; }
  .tc-body { display: flex; gap: 20px; padding: 16px; }
  .tc-side { flex: 1; }
  .tc-label { font-size: 12px; color: #888; margin-bottom: 6px; }
  .tc-player { font-size: 14px; color: #fff; padding: 3px 0; display: flex; justify-content: space-between; align-items: center; }
  .tc-player-ppg { font-size: 12px; color: #f59e0b; font-weight: 600; }
  .tc-message { padding: 0 16px 12px; font-size: 13px; color: #888; font-style: italic; }
  .tc-actions { padding: 12px 16px; border-top: 1px solid #222; display: flex; gap: 8px; align-items: center; }
  .accept-btn {
    padding: 8px 20px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3);
    border-radius: 6px; color: #6ee7b7; font-weight: 600; cursor: pointer;
  }
  .accept-btn:disabled, .reject-btn:disabled, .cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .reject-btn {
    padding: 8px 20px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 6px; color: #fca5a5; font-weight: 600; cursor: pointer;
  }
  .cancel-btn {
    padding: 8px 20px; background: #333; border: none;
    border-radius: 6px; color: #888; cursor: pointer;
  }
  .pending-badge { font-size: 13px; color: #f59e0b; }
  .status-badge {
    margin-left: auto; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600;
  }
  .status-badge.accepted { background: rgba(16, 185, 129, 0.15); color: #6ee7b7; }
  .status-badge.rejected { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
  .status-badge.cancelled { background: rgba(100, 116, 139, 0.15); color: #94a3b8; }

  .empty-state { text-align: center; padding: 60px 20px; color: #888; }
  .empty-state.small { padding: 30px; }
  .empty-icon { font-size: 48px; margin-bottom: 12px; }

  .loading-container, .error-container {
    min-height: 50vh; display: flex; align-items: center; justify-content: center; color: #888;
  }

  @media (max-width: 768px) {
    .trade-board { grid-template-columns: 1fr; }
    .trade-arrow { padding: 0; font-size: 20px; }
    .summary-content { flex-direction: column; }
    .tc-body { flex-direction: column; gap: 12px; }
  }
`;
