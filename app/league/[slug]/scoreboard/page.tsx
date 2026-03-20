"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  League,
  LeagueMember,
  getLeagueBySlug,
  getLeagueMembers,
  getSessionUser,
  saveWeeklyMatchupResult,
} from "@/lib/store";
import { loadCanonicalWeekSnapshot } from "@/lib/canonical-weekly-results-service";
import {
  CANONICAL_TIMEZONE,
  formatDateStr,
  getCurrentWeek,
  getOfficialLeagueStartDate,
  getScoringWeekRange,
  getWeekStatus,
} from "@/lib/week-utils";

const MAX_WEEKS = 20;

export default function ScoreboardPage() {
  const { t } = useLang();
  const { slug } = useParams<{ slug: string }>();

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [loading, setLoading] = useState(true);
  const [scoresLoading, setScoresLoading] = useState(false);
  const [matchupCards, setMatchupCards] = useState<Array<{
    id: number;
    home: LeagueMember;
    away: LeagueMember;
    homeName: string;
    awayName: string;
    homeScore: number;
    awayScore: number;
    status: "pending" | "live" | "final";
  }>>([]);
  const leagueStart = useMemo(() => getOfficialLeagueStartDate(league?.draft_completed_at ?? null), [league?.draft_completed_at]);
  const weekRange = useMemo(() => getScoringWeekRange(selectedWeek, leagueStart), [selectedWeek, leagueStart]);
  const weekStatus = useMemo(() => getWeekStatus(selectedWeek, leagueStart), [selectedWeek, leagueStart]);
  const isOwner = Boolean(user && league && league.commissioner_id === user.id);

  useEffect(() => {
    setUser(getSessionUser());
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      const leagueData = await getLeagueBySlug(slug);
      if (!leagueData || cancelled) {
        setLeague(null);
        setLoading(false);
        return;
      }

      setLeague(leagueData);
      const officialStart = getOfficialLeagueStartDate(leagueData.draft_completed_at);
      setSelectedWeek(getCurrentWeek(officialStart));

      const membersData = await getLeagueMembers(leagueData.id);

      if (cancelled) return;
      setMembers(membersData);

      setLoading(false);
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function loadCanonicalScores() {
      if (!league || !weekRange) {
        setMatchupCards([]);
        return;
      }

      setScoresLoading(true);
      try {
        const snapshot = await loadCanonicalWeekSnapshot(league, members, selectedWeek);
        if (cancelled) return;
        setMatchupCards(
          snapshot.results.map((result) => ({
              id: result.matchupIndex,
              home: result.homeMember,
              away: result.awayMember,
              homeName: result.homeMember.user?.username || result.homeMember.user?.name || "Anonymous",
              awayName: result.awayMember.user?.username || result.awayMember.user?.name || "Anonymous",
              homeScore: result.homeScore,
              awayScore: result.awayScore,
              status: result.status,
            })),
        );

        if (snapshot.weekStatus === "past" && snapshot.weekRange) {
          await Promise.all(
            snapshot.results.map((result) =>
              saveWeeklyMatchupResult({
                leagueId: league.id,
                week: selectedWeek,
                homeTeamId: result.homeTeamId,
                awayTeamId: result.awayTeamId,
                homeScore: result.homeScore,
                awayScore: result.awayScore,
                startDate: snapshot.weekRange!.startDate,
                endDate: snapshot.weekRange!.endDate,
              }),
            ),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load canonical weekly scoreboard", error);
          setMatchupCards([]);
        }
      } finally {
        if (!cancelled) setScoresLoading(false);
      }
    }

    loadCanonicalScores();
    return () => {
      cancelled = true;
    };
  }, [league, members, selectedWeek, weekRange]);

  function getStatusMeta() {
    if (weekStatus === "past") return { label: t("已结束", "Final"), className: "status-final" };
    if (weekStatus === "current") return { label: t("进行中", "Live"), className: "status-live" };
    if (weekStatus === "future") return { label: t("已安排", "Scheduled"), className: "status-scheduled" };
    return { label: t("待启用", "Pending start"), className: "status-pending" };
  }

  const statusMeta = getStatusMeta();
  const weekOptions = Array.from({ length: MAX_WEEKS }, (_, index) => index + 1);
  const rangeLabel = weekRange
    ? `${weekRange.startDate} → ${weekRange.endDate}`
    : t("选秀完成后的首个周一开始", "Starts on the first Monday after the draft completes");

  if (loading) {
    return (
      <div className="page-shell">
        <LightHeader activeHref="/league" />
        <div className="state-card">{t("加载中...", "Loading...")}</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league) {
    return (
      <div className="page-shell">
        <LightHeader activeHref="/league" />
        <div className="state-card">{t("联赛不存在", "League not found")}</div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <LightHeader activeHref="/league" />

      <div className="league-bar">
        <div className="container league-bar-inner">
          <Link href={`/league/${slug}`} className="league-link">
            <span className="league-dot" />
            <span>{league.name}</span>
          </Link>
          <span className="timezone-pill">{t("官方时区", "Official timezone")}: {CANONICAL_TIMEZONE}</span>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container layout-stack">
          <section className="hero-card">
            <div>
              <p className="eyebrow">{t("对阵记分板", "Matchup scoreboard")}</p>
              <h1>{t("周度比分总览", "Weekly scoring overview")}</h1>
              <p className="subcopy">
                {t(
                  "所有比分均基于每日保存的首发阵容快照，并按周一到周日累计。",
                  "All scores come from saved daily starter snapshots and roll up Monday through Sunday.",
                )}
              </p>
            </div>
            <div className="hero-meta-grid">
              <div className="meta-card">
                <span>{t("当前周", "Selected week")}</span>
                <strong>{t(`第 ${selectedWeek} 周`, `Week ${selectedWeek}`)}</strong>
                <small>{rangeLabel}</small>
              </div>
              <div className="meta-card">
                <span>{t("计分状态", "Scoring status")}</span>
                <strong>{statusMeta.label}</strong>
                <small>
                  {leagueStart
                    ? t(`Week 1 从 ${formatDateStr(leagueStart)} 开始`, `Week 1 starts on ${formatDateStr(leagueStart)}`)
                    : t("需先完成选秀", "Draft completion is required before scoring starts")}
                </small>
              </div>
            </div>
          </section>

          <section className="toolbar-card">
            <div>
              <p className="toolbar-label">{t("周选择", "Week selector")}</p>
              <div className="toolbar-title-row">
                <h2>{t(`第 ${selectedWeek} 周`, `Week ${selectedWeek}`)}</h2>
                <span className={`status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
              </div>
            </div>
            <div className="week-controls">
              <button className="nav-btn" onClick={() => setSelectedWeek((prev) => Math.max(1, prev - 1))} disabled={selectedWeek === 1}>←</button>
              <select className="week-select" value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))}>
                {weekOptions.map((week) => (
                  <option key={week} value={week}>{t(`第 ${week} 周`, `Week ${week}`)}</option>
                ))}
              </select>
              <button className="nav-btn" onClick={() => setSelectedWeek((prev) => Math.min(MAX_WEEKS, prev + 1))} disabled={selectedWeek === MAX_WEEKS}>→</button>
            </div>
          </section>

          {!leagueStart && (
            <section className="notice-card pending">
              <strong>{t("官方计分尚未开始", "Official scoring has not started")}</strong>
              <p>
                {t(
                  "按照产品规则，Week 1 会在选秀完成后的首个周一启动，期间不会生成或累计任何官方比分。",
                  "Per product rules, Week 1 begins on the first Monday after the draft completes, and no official scores accumulate before then.",
                )}
              </p>
            </section>
          )}

          <section className="matchups-grid">
            {matchupCards.length === 0 ? (
              <div className="notice-card">
                <strong>{t("暂无可展示对阵", "No matchups to display")}</strong>
                <p>{t("联赛至少需要 2 支且为偶数支队伍才会生成对阵。", "The league needs an even number of teams to generate matchups.")}</p>
              </div>
            ) : (
              matchupCards.map((matchup) => {
                const homeLeading = matchup.homeScore >= matchup.awayScore;
                const awayLeading = matchup.awayScore >= matchup.homeScore;
                return (
                  <article className="matchup-card" key={matchup.id}>
                    <div className="card-top">
                      <span className={`status-chip ${statusMeta.className}`}>{statusMeta.label}</span>
                      <span className="date-range">{rangeLabel}</span>
                    </div>
                    <div className="team-stack">
                      <div className={`team-row ${homeLeading ? "leader" : ""}`}>
                        <div className="identity-block">
                          <div className="avatar">{matchup.homeName[0]?.toUpperCase()}</div>
                          <div>
                            <div className="team-name">{matchup.homeName}</div>
                            <div className="team-sub">{t("保存首发累计分", "Saved starter total")}</div>
                          </div>
                        </div>
                        <div className="score-block">
                          {scoresLoading ? "..." : matchup.homeScore.toFixed(1)}
                        </div>
                      </div>
                      <div className="versus-line">VS</div>
                      <div className={`team-row ${awayLeading ? "leader" : ""}`}>
                        <div className="identity-block">
                          <div className="avatar away">{matchup.awayName[0]?.toUpperCase()}</div>
                          <div>
                            <div className="team-name">{matchup.awayName}</div>
                            <div className="team-sub">{t("保存首发累计分", "Saved starter total")}</div>
                          </div>
                        </div>
                        <div className="score-block">
                          {scoresLoading ? "..." : matchup.awayScore.toFixed(1)}
                        </div>
                      </div>
                    </div>
                    <div className="card-footer">
                      <span className="footer-copy">{t("比分与详情页使用同一周度汇总逻辑", "Scoreboard and detail share one scoring pipeline")}</span>
                      <Link href={`/league/${slug}/matchup/${selectedWeek}-${matchup.id}`} className="detail-link">
                        {t("查看详情", "View details")} →
                      </Link>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </div>
      </main>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .page-shell {
    min-height: 100vh;
    background: linear-gradient(180deg, #f8fbff 0%, #f3f6fb 100%);
  }
  .container {
    max-width: 1180px;
    margin: 0 auto;
    padding: 0 20px;
  }
  .league-bar {
    background: rgba(255, 255, 255, 0.88);
    border-bottom: 1px solid #e2e8f0;
    backdrop-filter: blur(12px);
  }
  .league-bar-inner {
    min-height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .league-link {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    color: #0f172a;
    text-decoration: none;
    font-size: 18px;
    font-weight: 700;
  }
  .league-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: #f59e0b;
    box-shadow: 0 0 0 6px #fff7ed;
  }
  .timezone-pill {
    display: inline-flex;
    align-items: center;
    border: 1px solid #dbeafe;
    background: #eff6ff;
    color: #1d4ed8;
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: 600;
  }
  .page-content {
    padding: 28px 0 56px;
  }
  .layout-stack {
    display: grid;
    gap: 20px;
  }
  .hero-card,
  .toolbar-card,
  .matchup-card,
  .notice-card,
  .meta-card {
    background: rgba(255, 255, 255, 0.96);
    border: 1px solid rgba(226, 232, 240, 0.95);
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.06);
  }
  .hero-card {
    border-radius: 24px;
    padding: 28px;
    display: flex;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .eyebrow, .toolbar-label {
    margin: 0 0 8px;
    color: #2563eb;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .hero-card h1, .toolbar-card h2 {
    margin: 0;
    color: #0f172a;
  }
  .hero-card h1 {
    font-size: 32px;
    letter-spacing: -0.02em;
  }
  .subcopy {
    margin: 12px 0 0;
    max-width: 620px;
    color: #475569;
    line-height: 1.6;
    font-size: 15px;
  }
  .hero-meta-grid {
    display: grid;
    gap: 12px;
    min-width: min(100%, 320px);
    flex: 1;
  }
  .meta-card {
    border-radius: 18px;
    padding: 18px;
  }
  .meta-card span,
  .meta-card small {
    display: block;
  }
  .meta-card span {
    color: #64748b;
    font-size: 12px;
    margin-bottom: 10px;
  }
  .meta-card strong {
    color: #0f172a;
    font-size: 22px;
    line-height: 1.2;
  }
  .meta-card small {
    margin-top: 8px;
    color: #475569;
    line-height: 1.5;
  }
  .toolbar-card {
    border-radius: 20px;
    padding: 20px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .toolbar-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .week-controls {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .nav-btn,
  .week-select {
    border: 1px solid #dbe3ef;
    background: #fff;
    border-radius: 12px;
    color: #0f172a;
    font-size: 14px;
    font-weight: 600;
  }
  .nav-btn {
    width: 42px;
    height: 42px;
    cursor: pointer;
  }
  .nav-btn:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .week-select {
    min-width: 148px;
    padding: 11px 14px;
  }
  .status-chip {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 700;
  }
  .status-live { background: #dbeafe; color: #1d4ed8; }
  .status-final { background: #e2e8f0; color: #475569; }
  .status-scheduled { background: #ecfdf5; color: #047857; }
  .status-pending { background: #fff7ed; color: #c2410c; }
  .notice-card {
    border-radius: 18px;
    padding: 18px 20px;
  }
  .notice-card strong {
    display: block;
    color: #0f172a;
    margin-bottom: 6px;
  }
  .notice-card p {
    margin: 0;
    color: #475569;
    line-height: 1.6;
  }
  .notice-card.pending {
    border-color: #fed7aa;
    background: #fffaf5;
  }
  .matchups-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 18px;
  }
  .matchup-card {
    border-radius: 22px;
    padding: 20px;
    display: grid;
    gap: 18px;
  }
  .card-top,
  .card-footer,
  .team-row,
  .identity-block {
    display: flex;
    align-items: center;
  }
  .card-top,
  .card-footer {
    justify-content: space-between;
    gap: 12px;
  }
  .date-range,
  .team-sub,
  .footer-copy,
  .versus-line {
    color: #64748b;
    font-size: 12px;
  }
  .team-stack {
    display: grid;
    gap: 14px;
  }
  .team-row {
    justify-content: space-between;
    gap: 12px;
    border-radius: 18px;
    padding: 14px 16px;
    background: #f8fafc;
    border: 1px solid transparent;
  }
  .team-row.leader {
    border-color: #bfdbfe;
    background: linear-gradient(180deg, #eff6ff 0%, #f8fbff 100%);
  }
  .identity-block {
    gap: 12px;
    min-width: 0;
  }
  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #1e3a8a;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 16px;
    flex-shrink: 0;
  }
  .avatar.away { background: #2563eb; }
  .team-name {
    color: #0f172a;
    font-size: 16px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .score-block {
    color: #0f172a;
    font-size: 34px;
    font-weight: 800;
    letter-spacing: -0.04em;
  }
  .versus-line {
    text-align: center;
    font-weight: 700;
    letter-spacing: 0.18em;
  }
  .detail-link {
    color: #1d4ed8;
    font-weight: 700;
    text-decoration: none;
  }
  .state-card {
    margin: 48px auto;
    max-width: 420px;
    padding: 24px;
    border-radius: 18px;
    background: #fff;
    color: #475569;
    text-align: center;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  }
  @media (max-width: 720px) {
    .container { padding: 0 14px; }
    .league-bar-inner { align-items: flex-start; padding-top: 14px; padding-bottom: 14px; flex-direction: column; }
    .hero-card { padding: 22px; }
    .hero-card h1 { font-size: 28px; }
    .toolbar-card { padding: 18px; }
    .score-block { font-size: 28px; }
  }
`;
