"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  getTeamRoster,
  fetchTeamRosterFromDB,
  fetchTeamLineupFromDB,
  fetchLineupHistoryFromDB,
  getLineupForWeek,
  supabase,
  League,
  LeagueMember,
  RosterPlayer,
  LineupMap,
  LineupHistory,
} from "@/lib/store";
import {
  getWeekDateStrings,
  getWeekStatus,
  getTodayStr,
} from "@/lib/week-utils";

// ── Types ─────────────────────────────────────────────────────────────────────

type CachedPlayerStats = {
  id: number;
  name: string;
  team: string;
  averages: Record<string, number>;
  fptsAvg: number;
  injury?: string;
};

type PlayerGameStats = {
  min: number; fgm: number; fga: number; fg3m: number;
  ftm: number; fta: number; reb: number; ast: number;
  stl: number; blk: number; tov: number; pts: number;
  fpts: number;
};

type DateStatsMap = Record<string, PlayerGameStats>;

const STARTER_SLOTS = new Set(["PG", "SG", "SF", "PF", "C", "G", "F", "UTIL1", "UTIL2", "UTIL3"]);

function getWeekdayScoringDates(dateStrings: string[]): string[] {
  return dateStrings.filter((dateStr) => {
    const day = new Date(`${dateStr}T00:00:00`).getDay();
    return day >= 1 && day <= 5; // Monday–Friday
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ScoreboardPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedWeek, setSelectedWeek] = useState(1);

  // Real data state
  const [teamRosters, setTeamRosters] = useState<Record<string, RosterPlayer[]>>({});
  const [teamLineups, setTeamLineups] = useState<Record<string, LineupMap>>({});
  const [teamLineupHistories, setTeamLineupHistories] = useState<Record<string, LineupHistory>>({});
  const [playerStatsCache, setPlayerStatsCache] = useState<Map<string, CachedPlayerStats>>(new Map());
  const [weekDayStats, setWeekDayStats] = useState<Record<string, DateStatsMap>>({});
  const [scoresLoading, setScoresLoading] = useState(false);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      const membersData = await getLeagueMembers(leagueData.id);
      setMembers(membersData);

      // Fetch all fantasy team rosters
      const { data: teamsData } = await supabase
        .from("fantasy_teams")
        .select("id, user_id, name, roster_data, wins, losses")
        .eq("league_id", leagueData.id);

      if (teamsData) {
        const rosters: Record<string, RosterPlayer[]> = {};
        const lineups: Record<string, LineupMap> = {};
        const histories: Record<string, LineupHistory> = {};
        for (const team of teamsData) {
          if (team.roster_data && Array.isArray(team.roster_data)) {
            rosters[team.user_id] = team.roster_data as RosterPlayer[];
          } else {
            rosters[team.user_id] = getTeamRoster(leagueData.id, team.id);
          }
          lineups[team.user_id] = await fetchTeamLineupFromDB(leagueData.id, team.id);
          histories[team.user_id] = await fetchLineupHistoryFromDB(leagueData.id, team.id);
        }
        setTeamRosters(rosters);
        setTeamLineups(lineups);
        setTeamLineupHistories(histories);
      }

      // Fetch player stats cache for name -> BDL ID mapping
      try {
        const res = await fetch("/api/nba-stats");
        const data = await res.json();
        if (data.status === "success" && data.players) {
          const map = new Map<string, CachedPlayerStats>();
          for (const p of data.players) {
            map.set(String(p.id), p);
          }
          setPlayerStatsCache(map);
        }
      } catch (err) {
        console.error("Failed to fetch player stats:", err);
      }
    }
    setLoading(false);
  }

  // Fetch week stats when selectedWeek changes
  const fetchWeekStats = useCallback(async (week: number) => {
    setScoresLoading(true);
    const dateStrings = getWeekDateStrings(week);
    const todayStr = getTodayStr();
    const pastOrTodayDates = dateStrings.filter(d => d <= todayStr);

    if (pastOrTodayDates.length === 0) {
      setWeekDayStats({});
      setScoresLoading(false);
      return;
    }

    try {
      const dayStatsResults = await Promise.all(
        pastOrTodayDates.map(date =>
          fetch(`/api/nba-game-stats?date=${date}`)
            .then(r => r.json())
            .then(data => ({
              date,
              stats: data.status === "success" ? (data.stats as DateStatsMap) : {},
            }))
            .catch(() => ({ date, stats: {} as DateStatsMap }))
        )
      );

      const allDayStats: Record<string, DateStatsMap> = {};
      for (const { date, stats } of dayStatsResults) {
        allDayStats[date] = stats;
      }
      setWeekDayStats(allDayStats);
    } catch (err) {
      console.error("Failed to fetch week stats:", err);
    } finally {
      setScoresLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && league) {
      fetchWeekStats(selectedWeek);
    }
  }, [selectedWeek, loading, league, fetchWeekStats]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const isOwner = user && league && league.commissioner_id === user.id;

  const getMemberName = (member: LeagueMember) => {
    return member.user?.username || member.user?.name || "Anonymous";
  };

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

  function getStatsForPlayer(player: RosterPlayer): CachedPlayerStats | null {
    const byId = playerStatsCache.get(player.id);
    if (byId) return byId;
    for (const s of playerStatsCache.values()) {
      if (s.name === player.name) return s;
    }
    return null;
  }

  function getPlayerDayStats(player: RosterPlayer, dateStr: string): PlayerGameStats | null {
    const todayStr = getTodayStr();
    if (dateStr > todayStr) return null;
    const dayMap = weekDayStats[dateStr];
    if (!dayMap) return null;
    if (dayMap[player.id]) return dayMap[player.id];
    const cached = getStatsForPlayer(player);
    if (cached && dayMap[String(cached.id)]) return dayMap[String(cached.id)];
    return null;
  }

  function getStartersFromLineup(roster: RosterPlayer[], lineup: LineupMap): RosterPlayer[] {
    const playerMap = new Map(roster.map((p) => [p.id, p]));
    const starters: RosterPlayer[] = [];
    for (const slot of Object.keys(lineup)) {
      if (!STARTER_SLOTS.has(slot)) continue;
      const player = playerMap.get(lineup[slot]);
      if (player) starters.push(player);
    }
    return starters;
  }

  function calcWeekTotalForRoster(roster: RosterPlayer[], lineup: LineupMap): number {
    const scoringDates = getWeekdayScoringDates(getWeekDateStrings(selectedWeek));
    const starters = getStartersFromLineup(roster, lineup);
    return scoringDates.reduce((total, dateStr) => {
      return total + starters.reduce((sum, p) => {
        const stats = getPlayerDayStats(p, dateStr);
        return sum + (stats?.fpts || 0);
      }, 0);
    }, 0);
  }

  const generateMatchupsForWeek = (week: number) => {
    const n = members.length;
    if (n < 2 || n % 2 !== 0) return [];

    const sorted = [...members].sort((a, b) => a.user_id.localeCompare(b.user_id));
    const seed = (league?.id || "").split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    const shuffled = seededShuffle(sorted, seed);

    const fixed = shuffled[0];
    const rotating = shuffled.slice(1);
    const numRounds = n - 1;
    const round = (week - 1) % numRounds;
    const half = (n - 2) / 2;

    const result = [];
    let id = 0;

    const homeRoster = teamRosters[fixed.user_id] || [];
    const awayRoster = teamRosters[rotating[round].user_id] || [];
    const homeLineup = getLineupForWeek(teamLineupHistories[fixed.user_id] || {}, teamLineups[fixed.user_id] || {}, week);
    const awayLineup = getLineupForWeek(teamLineupHistories[rotating[round].user_id] || {}, teamLineups[rotating[round].user_id] || {}, week);

    result.push({
      id: id++,
      home: fixed,
      away: rotating[round],
      homeScore: calcWeekTotalForRoster(homeRoster, homeLineup),
      awayScore: calcWeekTotalForRoster(awayRoster, awayLineup),
    });

    for (let i = 1; i <= half; i++) {
      const hm = rotating[(round + i) % (n - 1)];
      const aw = rotating[(round + n - 1 - i) % (n - 1)];
      const hRoster = teamRosters[hm.user_id] || [];
      const aRoster = teamRosters[aw.user_id] || [];
      const hLineup = getLineupForWeek(teamLineupHistories[hm.user_id] || {}, teamLineups[hm.user_id] || {}, week);
      const aLineup = getLineupForWeek(teamLineupHistories[aw.user_id] || {}, teamLineups[aw.user_id] || {}, week);
      result.push({
        id: id++,
        home: hm,
        away: aw,
        homeScore: calcWeekTotalForRoster(hRoster, hLineup),
        awayScore: calcWeekTotalForRoster(aRoster, aLineup),
      });
    }

    return result;
  };

  const matchups = generateMatchupsForWeek(selectedWeek);
  const weeks = Array.from({ length: 20 }, (_, i) => i + 1);
  const weekStatus = getWeekStatus(selectedWeek);

  function getStatusLabel() {
    if (weekStatus === "past") return t("已结束", "Final");
    if (weekStatus === "current") return t("进行中", "In Progress");
    return t("已安排", "Scheduled");
  }

  function getStatusClass() {
    if (weekStatus === "past") return "status-final";
    if (weekStatus === "current") return "status-live";
    return "status-scheduled";
  }

  if (loading) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="loading-container">
          <p>{t("加载中...", "Loading...")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <p>{t("联赛不存在", "League not found")}</p>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <LightHeader activeHref="/league" />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            <span className="league-icon"></span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <div className="page-header">
            <h1>{t("记分板", "Scoreboard")}</h1>
            <div className="week-selector">
              <button
                className="week-nav"
                onClick={() => setSelectedWeek(Math.max(1, selectedWeek - 1))}
                disabled={selectedWeek === 1}
              >
                ←
              </button>
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="week-dropdown"
              >
                {weeks.map((week) => (
                  <option key={week} value={week}>
                    {t(`第 ${week} 周`, `Week ${week}`)}
                  </option>
                ))}
              </select>
              <button
                className="week-nav"
                onClick={() => setSelectedWeek(Math.min(20, selectedWeek + 1))}
                disabled={selectedWeek === 20}
              >
                →
              </button>
            </div>
          </div>

          <div className="matchups-grid">
            {matchups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"></div>
                <h3>{t("还没有对阵", "No matchups yet")}</h3>
                <p>{t("联赛需要至少2支队伍才能生成对阵", "League needs at least 2 teams to generate matchups")}</p>
              </div>
            ) : (
              matchups.map((matchup) => (
                <div key={matchup.id} className="matchup-card">
                  <div className="matchup-header">
                    <span className={`matchup-status ${getStatusClass()}`}>{getStatusLabel()}</span>
                    <span className="matchup-week">{t(`第 ${selectedWeek} 周`, `Week ${selectedWeek}`)}</span>
                  </div>

                  <div className="matchup-teams">
                    <div className="team home">
                      <div className="team-avatar">{getMemberName(matchup.home)[0]?.toUpperCase()}</div>
                      <div className="team-info">
                        <span className="team-name">{getMemberName(matchup.home)}</span>
                      </div>
                      <span className="team-score">
                        {scoresLoading ? "..." : Math.round(matchup.homeScore * 10) / 10}
                      </span>
                    </div>

                    <div className="vs">VS</div>

                    <div className="team away">
                      <span className="team-score">
                        {scoresLoading ? "..." : Math.round(matchup.awayScore * 10) / 10}
                      </span>
                      <div className="team-info">
                        <span className="team-name">{getMemberName(matchup.away)}</span>
                      </div>
                      <div className="team-avatar">{getMemberName(matchup.away)[0]?.toUpperCase()}</div>
                    </div>
                  </div>

                  <div className="matchup-footer">
                    <Link href={`/league/${slug}/matchup/${selectedWeek}-${matchup.id}`} className="view-matchup">
                      {t("查看详情", "View Matchup")} →
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: #1e3a8a;
    border-bottom: none;
  }

  .league-header-inner {
    max-width: 1200px;
    margin: 0 auto;
    padding: 16px;
  }

  .league-title {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
    text-decoration: none;
    font-size: 20px;
    font-weight: 600;
  }

  .league-icon {
    font-size: 28px;
  }

  .page-content {
    min-height: calc(100vh - 200px);
    background: #f9fafb;
    padding: 24px 16px;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    flex-wrap: wrap;
    gap: 16px;
  }

  .page-header h1 {
    font-size: 24px;
    font-weight: 700;
    color: #111827;
    margin: 0;
  }

  .week-selector {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .week-nav {
    width: 36px;
    height: 36px;
    border: 1px solid #e5e7eb;
    background: #fff;
    color: #111827;
    border-radius: 8px;
    cursor: pointer;
    font-size: 16px;
  }

  .week-nav:hover:not(:disabled) {
    border-color: #1e3a8a;
    color: #1e3a8a;
  }

  .week-nav:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .week-dropdown {
    padding: 8px 16px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    color: #111827;
    font-size: 14px;
    cursor: pointer;
  }

  .matchups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 16px;
  }

  .matchup-card {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    overflow: hidden;
  }

  .matchup-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .matchup-status {
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 12px;
  }

  .status-scheduled {
    background: #dbeafe;
    color: #1e3a8a;
  }

  .status-live {
    background: rgba(74, 222, 128, 0.2);
    color: #4ade80;
  }

  .status-final {
    background: rgba(148, 163, 184, 0.2);
    color: #94a3b8;
  }

  .matchup-week {
    font-size: 13px;
    color: #6b7280;
  }

  .matchup-teams {
    padding: 20px 16px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .team {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
  }

  .team.away {
    flex-direction: row-reverse;
    text-align: right;
  }

  .team-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #1e3a8a;
    color: #fff;
    font-size: 18px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .team-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .team-name {
    font-size: 15px;
    font-weight: 600;
    color: #111827;
  }

  .team-score {
    font-size: 28px;
    font-weight: 700;
    color: #111827;
    min-width: 40px;
    text-align: center;
  }

  .vs {
    font-size: 14px;
    font-weight: 600;
    color: #9ca3af;
    padding: 0 8px;
  }

  .matchup-footer {
    padding: 12px 16px;
    border-top: 1px solid #e5e7eb;
    text-align: center;
  }

  .view-matchup {
    font-size: 13px;
    color: #1e3a8a;
    text-decoration: none;
  }

  .view-matchup:hover {
    text-decoration: underline;
  }

  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px 20px;
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 18px;
    color: #111827;
    margin: 0 0 8px 0;
  }

  .empty-state p {
    font-size: 14px;
    color: #6b7280;
    margin: 0;
  }

  .loading-container, .error-container {
    min-height: 50vh;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #6b7280;
  }

  @media (max-width: 500px) {
    .matchups-grid {
      grid-template-columns: 1fr;
    }
  }
`;
