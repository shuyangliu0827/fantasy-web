"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  getTeamRoster,
  supabase,
  League,
  LeagueMember,
  RosterPlayer,
} from "@/lib/store";

// ── Helpers ───────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// NBA season starts ~Oct 21, 2025
function getWeekDayLabels(week: number): string[] {
  const start = new Date("2025-10-21");
  start.setDate(start.getDate() + (week - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
}

function playerFptsAvg(p: RosterPlayer): number {
  return Math.max(0, p.ppg + p.rpg + p.apg + p.spg * 2 + p.bpg * 2 - (p.tov || 0));
}

type DayStats = {
  min: number; fgm: number; fga: number; ftm: number; fta: number;
  fg3m: number; reb: number; ast: number; stl: number; blk: number;
  tov: number; pts: number; fpts: number;
};

// Returns full stat line for that day, or null if player had no game
function simulateDayStats(p: RosterPlayer, week: number, day: number): DayStats | null {
  const fptsAvg = playerFptsAvg(p);
  if (!fptsAvg) return null;
  let h = p.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  h = ((h * 31 + week * 97 + day * 13) * 1103515245 + 12345) & 0x7fffffff;
  if (h % 100 > 50) return null; // no game
  h = (h * 1103515245 + 12345) & 0x7fffffff;
  const v = 0.6 + (h % 70) / 100;
  const pts  = Math.round(p.ppg * v);
  const reb  = Math.round(p.rpg * v);
  const ast  = Math.round(p.apg * v);
  const stl  = Math.round(p.spg * v * 10) / 10;
  const blk  = Math.round(p.bpg * v * 10) / 10;
  const tov  = Math.round((p.tov || 0) * v);
  const fga  = Math.round((pts / 2) / Math.max(0.01, (p.fg || 45) / 100));
  const fgm  = Math.round(fga * (p.fg || 45) / 100);
  const fta  = Math.round(pts * 0.2);
  const ftm  = Math.round(fta * (p.ft || 75) / 100);
  const fg3m = Math.max(0, Math.round((pts - fgm * 2 - ftm) / 3));
  const min  = Math.round(32 * v);
  const fpts = pts + reb + ast + Math.round(stl) * 2 + Math.round(blk) * 2 + fg3m - tov;
  return { min, fgm, fga, ftm, fta, fg3m, reb, ast, stl, blk, tov, pts, fpts };
}

// Which day index (0-6) within the matchup week is today?
function getTodayDayIndex(week: number): number {
  const start = new Date("2025-10-21");
  start.setDate(start.getDate() + (week - 1) * 7);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(6, Math.max(0, diff));
}

// Daily score used for the banner totals (accumulated across all days)
function playerDayScore(playerId: string, week: number, day: number, fptsAvg: number): number {
  if (!fptsAvg) return 0;
  let h = playerId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  h = ((h * 31 + week * 97 + day * 13) * 1103515245 + 12345) & 0x7fffffff;
  if (h % 100 > 50) return 0;
  h = (h * 1103515245 + 12345) & 0x7fffffff;
  const variance = 0.6 + (h % 70) / 100;
  return Math.round(fptsAvg * variance);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MatchupDetailPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;
  const matchupId = params.matchupId as string; // "week-index"

  const parts = matchupId.split("-").map(Number);
  const week = parts[0] || 1;
  const matchupIdx = parts[1] ?? 0;

  const [league, setLeague] = useState<League | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [homeTeam, setHomeTeam] = useState<{ member: LeagueMember; fantasy: any } | null>(null);
  const [awayTeam, setAwayTeam] = useState<{ member: LeagueMember; fantasy: any } | null>(null);
  const [homeRoster, setHomeRoster] = useState<RosterPlayer[]>([]);
  const [awayRoster, setAwayRoster] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, matchupId]);

  async function loadData() {
    try {
      const leagueData = await getLeagueBySlug(slug);
      if (!leagueData) return;
      setLeague(leagueData);

      const [membersData, { data: teamsData }] = await Promise.all([
        getLeagueMembers(leagueData.id),
        supabase
          .from("fantasy_teams")
          .select("*")
          .eq("league_id", leagueData.id)
          .order("draft_position", { ascending: true }),
      ]);

      const n = membersData.length;
      if (n >= 2 && n % 2 === 0) {
        const sorted = [...membersData].sort((a, b) => a.user_id.localeCompare(b.user_id));
        const seed = leagueData.id
          .split("")
          .reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0);
        const shuffled = seededShuffle(sorted, seed);
        const fixed = shuffled[0];
        const rotating = shuffled.slice(1);
        const numRounds = n - 1;
        const round = (week - 1) % numRounds;
        const half = (n - 2) / 2;

        const matchups: { home: LeagueMember; away: LeagueMember }[] = [];
        matchups.push({ home: fixed, away: rotating[round] });
        for (let i = 1; i <= half; i++) {
          matchups.push({
            home: rotating[(round + i) % (n - 1)],
            away: rotating[(round + n - 1 - i) % (n - 1)],
          });
        }

        const matchup = matchups[matchupIdx];
        if (matchup) {
          const homeFT = (teamsData || []).find((t: any) => t.user_id === matchup.home.user_id);
          const awayFT = (teamsData || []).find((t: any) => t.user_id === matchup.away.user_id);
          setHomeTeam({ member: matchup.home, fantasy: homeFT });
          setAwayTeam({ member: matchup.away, fantasy: awayFT });
          if (homeFT) setHomeRoster(getTeamRoster(leagueData.id, homeFT.id));
          if (awayFT) setAwayRoster(getTeamRoster(leagueData.id, awayFT.id));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // ── Score helpers ─────────────────────────────────────────────────────────

  const getMemberName = (m: LeagueMember) =>
    m.user?.username || m.user?.name || "Anonymous";

  const calcDailyTeamScore = (roster: RosterPlayer[], day: number) =>
    roster.reduce((sum, p) => sum + playerDayScore(p.id, week, day, playerFptsAvg(p)), 0);

  const calcWeekTotal = (roster: RosterPlayer[]) => {
    let total = 0;
    for (let d = 0; d < 7; d++) total += calcDailyTeamScore(roster, d);
    return total;
  };

  const calcPlayerWeekFpts = (p: RosterPlayer) => {
    let total = 0;
    for (let d = 0; d < 7; d++) total += playerDayScore(p.id, week, d, playerFptsAvg(p));
    return total;
  };

  // ── Box score renderer ────────────────────────────────────────────────────

  const renderBoxScore = (roster: RosterPlayer[], teamName: string) => {
    const todayDay = getTodayDayIndex(week);
    const rows = roster.map((p) => ({
      p,
      stats: simulateDayStats(p, week, todayDay),
    }));

    const totals = rows.reduce(
      (acc, { stats }) => ({
        min:  acc.min  + (stats?.min  ?? 0),
        fgm:  acc.fgm  + (stats?.fgm  ?? 0),
        fga:  acc.fga  + (stats?.fga  ?? 0),
        ftm:  acc.ftm  + (stats?.ftm  ?? 0),
        fta:  acc.fta  + (stats?.fta  ?? 0),
        fg3m: acc.fg3m + (stats?.fg3m ?? 0),
        reb:  acc.reb  + (stats?.reb  ?? 0),
        ast:  acc.ast  + (stats?.ast  ?? 0),
        stl:  acc.stl  + (stats?.stl  ?? 0),
        blk:  acc.blk  + (stats?.blk  ?? 0),
        tov:  acc.tov  + (stats?.tov  ?? 0),
        pts:  acc.pts  + (stats?.pts  ?? 0),
        fpts: acc.fpts + (stats?.fpts ?? 0),
      }),
      { min:0, fgm:0, fga:0, ftm:0, fta:0, fg3m:0, reb:0, ast:0, stl:0, blk:0, tov:0, pts:0, fpts:0 }
    );

    const D = "--";

    return (
      <div className="box-score-section">
        <div className="box-score-title">
          <div className="bs-avatar">{teamName[0]?.toUpperCase()}</div>
          <h3>{teamName} {t("阵容统计", "Box Score")}</h3>
        </div>
        <div className="table-scroll">
          <table className="stats-table">
            <thead>
              <tr>
                <th className="col-player">{t("球员", "PLAYER")}</th>
                <th>POS</th>
                <th>MIN</th>
                <th>FGM</th>
                <th>FGA</th>
                <th>FTM</th>
                <th>FTA</th>
                <th>3PM</th>
                <th>REB</th>
                <th>AST</th>
                <th>STL</th>
                <th>BLK</th>
                <th>TO</th>
                <th>PTS</th>
                <th className="col-fpts">FPTS</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={15} className="empty-row">
                    {t("还未选秀 — 暂无球员数据", "No players drafted yet")}
                  </td>
                </tr>
              ) : (
                rows.map(({ p, stats }) => (
                  <tr key={p.id} className={stats ? "row-played" : "row-no-game"}>
                    <td className="col-player">
                      <div className="player-cell">
                        <span className="player-name">{p.name}</span>
                        <span className="player-team-label">{p.team}</span>
                      </div>
                    </td>
                    <td>{p.position}</td>
                    <td>{stats ? stats.min  : D}</td>
                    <td>{stats ? stats.fgm  : D}</td>
                    <td>{stats ? stats.fga  : D}</td>
                    <td>{stats ? stats.ftm  : D}</td>
                    <td>{stats ? stats.fta  : D}</td>
                    <td>{stats ? stats.fg3m : D}</td>
                    <td>{stats ? stats.reb  : D}</td>
                    <td>{stats ? stats.ast  : D}</td>
                    <td>{stats ? stats.stl  : D}</td>
                    <td>{stats ? stats.blk  : D}</td>
                    <td>{stats ? stats.tov  : D}</td>
                    <td>{stats ? stats.pts  : D}</td>
                    <td className="col-fpts">{stats ? stats.fpts : 0}</td>
                  </tr>
                ))
              )}
              {rows.length > 0 && (
                <tr className="totals-row">
                  <td colSpan={2}><strong>TOTALS</strong></td>
                  <td>{totals.min}</td>
                  <td>{totals.fgm}</td>
                  <td>{totals.fga}</td>
                  <td>{totals.ftm}</td>
                  <td>{totals.fta}</td>
                  <td>{totals.fg3m}</td>
                  <td>{totals.reb}</td>
                  <td>{totals.ast}</td>
                  <td>{totals.stl.toFixed(1)}</td>
                  <td>{totals.blk.toFixed(1)}</td>
                  <td>{totals.tov}</td>
                  <td>{totals.pts}</td>
                  <td className="col-fpts"><strong>{totals.fpts}</strong></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // ── Early returns ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app">
        <Header />
        <div className="center-msg"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league || !homeTeam || !awayTeam) {
    return (
      <div className="app">
        <Header />
        <div className="center-msg"><p>{t("对阵未找到", "Matchup not found")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  const homeScore  = calcWeekTotal(homeRoster);
  const awayScore  = calcWeekTotal(awayRoster);
  const dayLabels  = getWeekDayLabels(week);
  const homeName   = homeTeam.fantasy?.name || getMemberName(homeTeam.member);
  const awayName   = awayTeam.fantasy?.name || getMemberName(awayTeam.member);
  const homeOwner  = getMemberName(homeTeam.member);
  const awayOwner  = getMemberName(awayTeam.member);
  const homeRecord = `${homeTeam.fantasy?.wins || 0}-${homeTeam.fantasy?.losses || 0}`;
  const awayRecord = `${awayTeam.fantasy?.wins || 0}-${awayTeam.fantasy?.losses || 0}`;
  const isOwner    = user && league.commissioner_id === user.id;

  return (
    <div className="app">
      <Header />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span>🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">

          <Link href={`/league/${slug}/scoreboard`} className="back-link">
            ← {t("返回记分板", "Back to Scoreboard")}
          </Link>

          {/* ── Matchup banner ── */}
          <div className="banner-card">
            <div className="banner-row">
              {/* Home */}
              <div className="banner-team">
                <div className="banner-avatar">{homeName[0]?.toUpperCase()}</div>
                <div className="banner-text">
                  <div className="banner-team-name">{homeName}</div>
                  <div className="banner-owner">{homeOwner}</div>
                  <div className="banner-record">{homeRecord}</div>
                </div>
              </div>

              {/* Scores */}
              <div className="banner-center">
                <div className="scores-row">
                  <span className={`big-score ${homeScore >= awayScore ? "score-winning" : "score-losing"}`}>
                    {homeScore}
                  </span>
                  <span className="score-divider">-</span>
                  <span className={`big-score ${awayScore >= homeScore ? "score-winning" : "score-losing"}`}>
                    {awayScore}
                  </span>
                </div>
                <div className="week-label">{t(`第 ${week} 周`, `Week ${week}`)}</div>
              </div>

              {/* Away */}
              <div className="banner-team banner-team-right">
                <div className="banner-text banner-text-right">
                  <div className="banner-team-name">{awayName}</div>
                  <div className="banner-owner">{awayOwner}</div>
                  <div className="banner-record">{awayRecord}</div>
                </div>
                <div className="banner-avatar">{awayName[0]?.toUpperCase()}</div>
              </div>
            </div>

            {/* ── Daily breakdown ── */}
            <div className="daily-section">
              <div className="table-scroll">
                <table className="daily-table">
                  <thead>
                    <tr>
                      <th className="col-team-name">TEAM</th>
                      {dayLabels.map((d) => <th key={d}>{d}</th>)}
                      <th className="col-total">SCORE</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="col-team-name">{homeName}</td>
                      {Array.from({ length: 7 }, (_, d) => {
                        const v = calcDailyTeamScore(homeRoster, d);
                        return <td key={d}>{v > 0 ? v : <span className="zero">-</span>}</td>;
                      })}
                      <td className="col-total"><strong>{homeScore}</strong></td>
                    </tr>
                    <tr>
                      <td className="col-team-name">{awayName}</td>
                      {Array.from({ length: 7 }, (_, d) => {
                        const v = calcDailyTeamScore(awayRoster, d);
                        return <td key={d}>{v > 0 ? v : <span className="zero">-</span>}</td>;
                      })}
                      <td className="col-total"><strong>{awayScore}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Box scores ── */}
          {renderBoxScore(homeRoster, homeName)}
          {renderBoxScore(awayRoster, awayName)}

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
  .league-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
  }
  .league-title {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #0a0a0a;
    padding: 24px 16px;
  }
  .container {
    max-width: 1100px;
    margin: 0 auto;
  }

  .back-link {
    display: inline-block;
    color: #f59e0b;
    text-decoration: none;
    font-size: 14px;
    margin-bottom: 20px;
  }
  .back-link:hover { text-decoration: underline; }

  /* ── Banner ── */
  .banner-card {
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 24px;
  }
  .banner-row {
    display: flex;
    align-items: center;
    padding: 28px 24px;
    gap: 16px;
  }
  .banner-team {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .banner-team-right {
    flex-direction: row-reverse;
  }
  .banner-avatar {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    font-size: 22px;
    font-weight: 700;
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .banner-text { display: flex; flex-direction: column; gap: 3px; }
  .banner-text-right { text-align: right; }
  .banner-team-name { font-size: 18px; font-weight: 700; color: #fff; }
  .banner-owner { font-size: 13px; color: #aaa; }
  .banner-record { font-size: 13px; color: #888; }

  .banner-center { text-align: center; flex-shrink: 0; }
  .scores-row {
    display: flex;
    align-items: center;
    gap: 12px;
    justify-content: center;
  }
  .big-score {
    font-size: 40px;
    font-weight: 800;
    min-width: 64px;
    text-align: center;
  }
  .score-winning { color: #fff; }
  .score-losing  { color: #555; }
  .score-divider { font-size: 24px; color: #444; }
  .week-label    { font-size: 13px; color: #888; margin-top: 6px; }

  /* ── Daily breakdown ── */
  .daily-section {
    border-top: 1px solid #1e1e1e;
    padding: 0 24px 20px;
  }
  .table-scroll { overflow-x: auto; }
  .daily-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #ccc;
    min-width: 580px;
  }
  .daily-table th {
    padding: 10px 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    border-bottom: 1px solid #1e1e1e;
    white-space: nowrap;
  }
  .daily-table td {
    padding: 10px 8px;
    text-align: center;
    border-bottom: 1px solid #1a1a1a;
  }
  .col-team-name {
    text-align: left !important;
    font-weight: 600;
    color: #fff;
    white-space: nowrap;
    padding-right: 16px !important;
  }
  .col-total { font-weight: 700; color: #f59e0b !important; }
  .zero { color: #444; }

  /* ── Box score ── */
  .box-score-section {
    background: #111;
    border: 1px solid #222;
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 20px;
  }
  .box-score-title {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px 20px;
    background: #161616;
    border-bottom: 1px solid #222;
  }
  .bs-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, #f59e0b, #d97706);
    color: #000;
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .box-score-title h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: #fff;
  }
  .stats-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
    color: #ccc;
    min-width: 700px;
  }
  .stats-table th {
    padding: 10px 8px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #666;
    background: #141414;
    border-bottom: 1px solid #1e1e1e;
    white-space: nowrap;
  }
  .stats-table td {
    padding: 10px 8px;
    text-align: center;
    border-bottom: 1px solid #1a1a1a;
  }
  .stats-table tr:last-child td { border-bottom: none; }
  .stats-table tr:hover td { background: #161616; }

  .col-player { text-align: left !important; min-width: 160px; }
  .col-fpts   { color: #f59e0b !important; font-weight: 600; }

  .player-cell { display: flex; flex-direction: column; gap: 2px; padding: 2px 0; }
  .player-name { font-size: 14px; font-weight: 600; color: #fff; }
  .player-team-label { font-size: 11px; color: #666; }

  .row-played td { color: #4ade80; }
  .row-played .player-name { color: #fff; }
  .row-played .player-team-label { color: #888; }
  .row-no-game td { color: #444; }
  .row-no-game .player-name { color: #888; }

  .totals-row td {
    background: #161616;
    font-weight: 600;
    color: #fff;
    border-top: 1px solid #2a2a2a;
  }
  .empty-row {
    color: #555;
    padding: 32px !important;
    font-size: 14px;
    text-align: center;
  }
  .center-msg {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
  }

  @media (max-width: 640px) {
    .banner-row { flex-direction: column; text-align: center; }
    .banner-team { justify-content: center; }
    .banner-team-right { flex-direction: column; }
    .banner-text-right { text-align: center; }
  }
`;
