"use client";
// app/contest/my-lineup/page.tsx
//
// "My Results" — shows submitted/locked/scored lineups for the selected
// Daily Fantasy season week, sorted Mon → Sun (oldest first).
// A dropdown week selector at the top lets users navigate between weeks.
// Selected week is persisted in the URL as ?week_start=YYYY-MM-DD.

import { useEffect, useState, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import PlayerAvatar from "@/components/PlayerAvatar";
import ContestNav from "@/components/ContestNav";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/shared/store";
import { getPlayerDisplayName } from "@/lib/players/player-name-zh";
import { contestFetch } from "@/lib/fantasy/daily/fetch";
import {
  getSeasonWeekNumber,
  formatChineseDateShort,
  getCurrentWeekStartStr,
  parseDateStrUtc,
} from "@/lib/fantasy/daily/weeks";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

function fmtMoney(n: number) { return `$${n.toLocaleString()}`; }
function fmtFpts(n: number | null | undefined) { return n != null ? n.toFixed(1) : "—"; }
function fmtInt(n: number | null | undefined) { return n != null ? String(Math.round(n)) : "—"; }

function gameState(status: string | null): "not_started" | "live" | "final" | "no_game" {
  if (!status) return "no_game";
  if (/^final/i.test(status)) return "final";
  if (/\d+:\d+\s*(am|pm)/i.test(status)) return "not_started";
  return "live";
}

type BoxScore = {
  min: number; fgm: number; fga: number; fg3m: number;
  ftm: number; fta: number; reb: number; ast: number;
  stl: number; blk: number; tov: number; pts: number; fpts: number;
};

type Player = {
  slot: number;
  slot_label: string;
  player_id: string;
  name: string;
  position: string;
  team: string;
  salary: number;
  actual_fantasy_points: number | null;
  live_fpts: number | null;
  box_score: BoxScore | null;
  opponent: string | null;
  game_status: string | null;
};

type LineupEntry = {
  lineup_id: string;
  contest_id: string;
  contest_date: string | null;
  contest_status: string | null;
  status: string;
  total_fpts: number | null;
  live_total_fpts: number | null;
  rank: number | null;
  points_awarded: number;
  submitted_at: string | null;
  players: Player[];
};

type WeekItem = {
  weekStart: string;
  weekEnd: string;
  weekNum: number;
  count: number;
  isCurrent: boolean;
};

type SeasonWeeksData = {
  seasonWeek1Start: string;
  currentWeekStart: string;
  weeks: WeekItem[];
};

const BOX_COLS = [
  { key: "opp",  label: "OPP", width: 52 },
  { key: "min",  label: "MIN", width: 38 },
  { key: "fg",   label: "FG",  width: 46 },
  { key: "ft",   label: "FT",  width: 46 },
  { key: "3pm",  label: "3PM", width: 36 },
  { key: "reb",  label: "REB", width: 36 },
  { key: "ast",  label: "AST", width: 36 },
  { key: "stl",  label: "STL", width: 36 },
  { key: "blk",  label: "BLK", width: 36 },
  { key: "to",   label: "TO",  width: 36 },
  { key: "pts",  label: "PTS", width: 40 },
  { key: "fpts", label: "FPTS", width: 46 },
];

// ── Week label helpers ────────────────────────────────────────────────────────

function fmtEnShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function weekButtonLabel(
  week: WeekItem,
  seasonWeek1Start: string,
  lang: string,
): string {
  const s1 = parseDateStrUtc(seasonWeek1Start);
  const ws  = parseDateStrUtc(week.weekStart);
  const num = getSeasonWeekNumber(ws, s1);

  if (lang === "zh") {
    const range = `${formatChineseDateShort(week.weekStart)} - ${formatChineseDateShort(week.weekEnd)}`;
    const cur   = week.isCurrent ? " · 当前周" : "";
    return `Week ${num} · ${range}${cur}`;
  }
  const range = `${fmtEnShort(week.weekStart)} – ${fmtEnShort(week.weekEnd)}`;
  const cur   = week.isCurrent ? " · Current week" : "";
  return `Week ${num} · ${range}${cur}`;
}

function weekDropdownLabel(
  week: WeekItem,
  seasonWeek1Start: string,
  lang: string,
): string {
  const s1 = parseDateStrUtc(seasonWeek1Start);
  const ws  = parseDateStrUtc(week.weekStart);
  const num = getSeasonWeekNumber(ws, s1);
  const countLabel = lang === "zh" ? `${week.count} 场记录` : `${week.count} entries`;

  if (lang === "zh") {
    const range = `${formatChineseDateShort(week.weekStart)} - ${formatChineseDateShort(week.weekEnd)}`;
    const cur   = week.isCurrent ? " · 当前周" : "";
    return `Week ${num} · ${range}${cur} · ${countLabel}`;
  }
  const range = `${fmtEnShort(week.weekStart)} – ${fmtEnShort(week.weekEnd)}`;
  const cur   = week.isCurrent ? " · Current week" : "";
  return `Week ${num} · ${range}${cur} · ${countLabel}`;
}

// ── Week dropdown component ───────────────────────────────────────────────────

function WeekDropdown({
  weeks,
  selectedWeekStart,
  seasonWeek1Start,
  onSelect,
  lang,
}: {
  weeks: WeekItem[];
  selectedWeekStart: string;
  seasonWeek1Start: string;
  onSelect: (ws: string) => void;
  lang: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = weeks.find((w) => w.weekStart === selectedWeekStart) ?? weeks[weeks.length - 1];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const buttonLabel = selected
    ? weekButtonLabel(selected, seasonWeek1Start, lang)
    : (lang === "zh" ? "选择周" : "Select week");

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 14px", borderRadius: 8,
          border: "1px solid #d1d5db", background: "#fff",
          cursor: "pointer", fontSize: 13, fontWeight: 600,
          color: "#1e3a8a", whiteSpace: "nowrap",
          boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <span>{buttonLabel}</span>
        <span style={{
          fontSize: 11, color: "#9ca3af",
          transform: open ? "rotate(180deg)" : "none",
          transition: "transform 0.15s", display: "inline-block",
        }}>▼</span>
      </button>

      {/* Dropdown list */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: "#fff", border: "1px solid #e5e7eb",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          zIndex: 100, minWidth: 280, maxHeight: 320, overflowY: "auto",
          padding: "4px 0",
        }}>
          {[...weeks].reverse().map((week) => {
            const isSelected = week.weekStart === selectedWeekStart;
            const label = weekDropdownLabel(week, seasonWeek1Start, lang);
            return (
              <button
                key={week.weekStart}
                onClick={() => { onSelect(week.weekStart); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  width: "100%", padding: "9px 14px", border: "none",
                  background: isSelected ? "#eff6ff" : "transparent",
                  color: isSelected ? "#1e3a8a" : "#374151",
                  cursor: "pointer", fontSize: 12, fontWeight: isSelected ? 700 : 500,
                  textAlign: "left", lineHeight: 1.4,
                  borderLeft: isSelected ? "3px solid #1e3a8a" : "3px solid transparent",
                }}
              >
                <span style={{ flex: 1 }}>{label}</span>
                {week.isCurrent && (
                  <span style={{
                    marginLeft: 8, fontSize: 10, fontWeight: 700,
                    background: "#dbeafe", color: "#1e40af",
                    padding: "2px 6px", borderRadius: 99, whiteSpace: "nowrap",
                  }}>
                    {lang === "zh" ? "当前周" : "Current"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page component ───────────────────────────────────────────────────────

function MyLineupContent() {
  const { t, lang } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user] = useState(() => getSessionUser());

  // ── Week state ──────────────────────────────────────────────────
  const currentWeekStart = getCurrentWeekStartStr();
  const weekStartFromUrl = searchParams.get("week_start") ?? currentWeekStart;
  const [selectedWeekStart, setSelectedWeekStart] = useState(weekStartFromUrl);

  const [weeksData, setWeeksData]   = useState<SeasonWeeksData | null>(null);
  const [weeksLoading, setWeeksLoading] = useState(true);

  // ── Lineup state ────────────────────────────────────────────────
  const [lineups,  setLineups]  = useState<LineupEntry[]>([]);
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Load season weeks once
  useEffect(() => {
    if (!user) { setWeeksLoading(false); return; }
    loadWeeks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadWeeks() {
    setWeeksLoading(true);
    const res = await contestFetch("/api/contests/season-weeks");
    if (res.ok) {
      const json: SeasonWeeksData = await res.json();
      setWeeksData(json);
      // If no week_start in URL, default to current week
      if (!searchParams.get("week_start")) {
        setSelectedWeekStart(json.currentWeekStart);
      }
    }
    setWeeksLoading(false);
  }

  // Load lineups whenever selectedWeekStart changes
  useEffect(() => {
    if (!user) { setLoading(false); return; }
    loadLineups(selectedWeekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedWeekStart]);

  async function loadLineups(ws: string) {
    setLoading(true);
    setError(null);
    const res = await contestFetch(`/api/contests/my-lineups?week_start=${ws}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? `HTTP ${res.status}`);
      setLoading(false);
      return;
    }
    const json = await res.json();
    const entries: LineupEntry[] = json.lineups ?? [];
    setLineups(entries);
    setExpanded(new Set<string>(entries.map((e) => e.lineup_id)));
    setLoading(false);
  }

  function selectWeek(ws: string) {
    setSelectedWeekStart(ws);
    // Update URL without full navigation
    const params = new URLSearchParams(searchParams.toString());
    params.set("week_start", ws);
    router.replace(`/contest/my-lineup?${params.toString()}`, { scroll: false });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const statusBadge = (status: string) => {
    const styles: Record<string, { bg: string; color: string; border: string }> = {
      submitted: { bg: "#fef3c7", color: "#92400e", border: "#fcd34d" },
      locked:    { bg: "#dbeafe", color: "#1e40af", border: "#93c5fd" },
      scored:    { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
    };
    const s = styles[status] ?? { bg: "#f3f4f6", color: "#374151", border: "#e5e7eb" };
    const label: Record<string, string> = {
      submitted: t("已提交", "Submitted"),
      locked:    t("锁定中", "Locked"),
      scored:    t("已结算", "Scored"),
    };
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 99,
        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
        whiteSpace: "nowrap",
      }}>
        {label[status] ?? status}
      </span>
    );
  };

  const contestStatusLabel = (s: string | null) => {
    switch (s) {
      case "pending": return t("尚未开放", "Pending");
      case "open":    return t("开放中", "Open");
      case "locked":  return t("已锁定", "Locked");
      case "scored":  return t("已结算", "Scored");
      default:        return s ?? "";
    }
  };

  function formatDate(dateStr: string | null) {
    if (!dateStr) return "—";
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(
      lang === "zh" ? "zh-CN" : "en-US",
      { month: "short", day: "numeric", weekday: "short" },
    );
  }

  function cellValue(p: Player, col: string): { text: string; color?: string } {
    const bs = p.box_score;
    if (col === "opp") return { text: p.opponent ?? "—", color: "#6b7280" };
    if (!bs) return { text: "—", color: "#9ca3af" };
    switch (col) {
      case "min":  return { text: fmtInt(bs.min) };
      case "fg":   return { text: `${bs.fgm}/${bs.fga}` };
      case "ft":   return { text: `${bs.ftm}/${bs.fta}` };
      case "3pm":  return { text: String(bs.fg3m) };
      case "reb":  return { text: String(bs.reb) };
      case "ast":  return { text: String(bs.ast) };
      case "stl":  return { text: String(bs.stl) };
      case "blk":  return { text: String(bs.blk) };
      case "to":   return { text: String(bs.tov), color: bs.tov > 0 ? "#dc2626" : undefined };
      case "pts":  return { text: String(bs.pts), color: "#111827" };
      default:     return { text: "—" };
    }
  }

  function fptsCellValue(p: Player, isScored: boolean): { text: string; color: string } {
    if (isScored) {
      const v = p.actual_fantasy_points;
      return { text: fmtFpts(v), color: v != null && v > 30 ? "#059669" : "#1e3a8a" };
    }
    const v = p.live_fpts ?? p.box_score?.fpts;
    if (v != null) return { text: fmtFpts(v), color: "#d97706" };
    const gs = gameState(p.game_status);
    switch (gs) {
      case "final":       return { text: t("DNP", "DNP"),       color: "#9ca3af" };
      case "live":        return { text: "0",                    color: "#d97706" };
      case "not_started": return { text: "—",                    color: "#9ca3af" };
      default:            return { text: t("无比赛", "No Game"), color: "#9ca3af" };
    }
  }

  return (
    <div style={{ fontFamily: FONT, background: "#f9fafb", minHeight: "100vh" }}>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={null} />

      <main style={{ maxWidth: 700, margin: "0 auto", padding: "20px 16px" }}>
        {/* Header row: title + week dropdown */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", margin: 0 }}>
            {t("我的成绩", "My Results")}
          </h2>

          {user && !weeksLoading && weeksData && weeksData.weeks.length > 0 && (
            <WeekDropdown
              weeks={weeksData.weeks}
              selectedWeekStart={selectedWeekStart}
              seasonWeek1Start={weeksData.seasonWeek1Start}
              onSelect={selectWeek}
              lang={lang}
            />
          )}
        </div>

        {!user && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("请先登录查看成绩。", "Please log in to view your results.")}
          </div>
        )}

        {user && (loading || weeksLoading) && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#6b7280", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {user && !loading && !weeksLoading && error && (
          <div style={{ color: "#dc2626", fontSize: 14, padding: "20px 0" }}>{error}</div>
        )}

        {user && !loading && !weeksLoading && !error && lineups.length === 0 && (
          <div style={{
            background: "#fff", borderRadius: 12, padding: 32,
            border: "1px solid #e5e7eb", textAlign: "center",
          }}>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>
              {t("这一周还没有 Daily Fantasy 成绩。", "No Daily Fantasy results for this week.")}
            </div>
            <button
              onClick={() => router.push("/contest")}
              style={{
                padding: "10px 24px", borderRadius: 8, border: "none",
                background: "#1e3a8a", color: "#fff", cursor: "pointer",
                fontSize: 14, fontWeight: 600,
              }}
            >
              {t("去选阵容", "Build Lineup")}
            </button>
          </div>
        )}

        {user && !loading && !weeksLoading && !error && lineups.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {lineups.map((entry) => {
              const isExpanded  = expanded.has(entry.lineup_id);
              const totalSalary = entry.players.reduce((s, p) => s + p.salary, 0);
              const isScored    = entry.status === "scored";
              const completedCount = !isScored
                ? entry.players.filter(p => gameState(p.game_status) === "final").length
                : 0;
              const hasLive = !isScored && completedCount > 0;

              return (
                <div key={entry.lineup_id} style={{
                  background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
                  overflow: "hidden",
                }}>
                  {/* Card header */}
                  <div
                    onClick={() => toggleExpand(entry.lineup_id)}
                    style={{
                      padding: "14px 16px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 10,
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {formatDate(entry.contest_date)}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>
                        {contestStatusLabel(entry.contest_status)}
                      </div>
                    </div>

                    {isScored ? (
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {fmtFpts(entry.total_fpts)}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("总分", "Fpts")}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                            {entry.rank != null ? `#${entry.rank}` : "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("排名", "Rank")}</div>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}>
                            +{entry.points_awarded}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>{t("积分", "Pts")}</div>
                        </div>
                      </div>
                    ) : hasLive ? (
                      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#d97706" }}>
                            {fmtFpts(entry.live_total_fpts)}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>
                            {completedCount}/5 {t("场次", "done")}
                          </div>
                        </div>
                        {statusBadge(entry.status)}
                      </div>
                    ) : (
                      statusBadge(entry.status)
                    )}

                    <span style={{
                      fontSize: 12, color: "#9ca3af", marginLeft: 4,
                      transform: isExpanded ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s",
                      display: "inline-block",
                    }}>▼</span>
                  </div>

                  {/* Expandable section */}
                  {isExpanded && (
                    <>
                      <div style={{ borderTop: "1px solid #f3f4f6", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                        <table style={{
                          width: "100%", borderCollapse: "collapse",
                          fontSize: 12, minWidth: 580,
                        }}>
                          <thead>
                            <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                              <th style={{ padding: "6px 8px 6px 16px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap", width: 34 }}>
                                {t("位置", "POS")}
                              </th>
                              <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 600, color: "#6b7280", whiteSpace: "nowrap" }}>
                                {t("球员", "PLAYER")}
                              </th>
                              {BOX_COLS.map((col) => (
                                <th key={col.key} style={{
                                  padding: "6px 4px", textAlign: "center",
                                  fontWeight: 600, color: col.key === "fpts" ? "#1e3a8a" : "#6b7280",
                                  whiteSpace: "nowrap", width: col.width,
                                }}>
                                  {col.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {entry.players.map((p, i) => {
                              const fptsCell = fptsCellValue(p, isScored);
                              return (
                                <tr key={p.player_id} style={{
                                  borderBottom: i < entry.players.length - 1 ? "1px solid #f3f4f6" : "none",
                                }}>
                                  <td style={{ padding: "8px 6px 8px 16px", verticalAlign: "middle" }}>
                                    <span style={{
                                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                                      width: 28, height: 20, borderRadius: 4,
                                      background: "#1e3a8a", color: "#fff",
                                      fontSize: 9, fontWeight: 700, whiteSpace: "nowrap",
                                    }}>
                                      {p.slot_label}
                                    </span>
                                  </td>
                                  <td style={{ padding: "8px 8px 8px 0", verticalAlign: "middle" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                      <PlayerAvatar name={p.name} size={22} />
                                      <div style={{ minWidth: 0 }}>
                                        <div style={{
                                          fontSize: 12, fontWeight: 600, color: "#111827",
                                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                                          maxWidth: 110,
                                        }}>
                                          {getPlayerDisplayName({ name: p.name || p.player_id }, lang) || p.player_id}
                                        </div>
                                        <div style={{ fontSize: 10, color: "#9ca3af" }}>
                                          {p.position}{p.team ? ` · ${p.team}` : ""}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  {BOX_COLS.map((col) => {
                                    if (col.key === "fpts") {
                                      return (
                                        <td key="fpts" style={{
                                          padding: "8px 4px", textAlign: "center", verticalAlign: "middle",
                                          fontWeight: 700, color: fptsCell.color,
                                          whiteSpace: "nowrap",
                                        }}>
                                          {fptsCell.text}
                                        </td>
                                      );
                                    }
                                    const { text, color } = cellValue(p, col.key);
                                    return (
                                      <td key={col.key} style={{
                                        padding: "8px 4px", textAlign: "center", verticalAlign: "middle",
                                        color: color ?? "#374151", whiteSpace: "nowrap",
                                        fontSize: col.key === "opp" ? 11 : 12,
                                      }}>
                                        {text}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Footer */}
                      <div style={{ borderTop: "1px solid #f3f4f6", padding: "12px 16px" }}>
                        {isScored ? (
                          <div style={{
                            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 8, marginBottom: 10,
                          }}>
                            {[
                              { label: t("总分", "Total Fpts"), value: fmtFpts(entry.total_fpts) },
                              { label: t("排名", "Rank"),        value: entry.rank != null ? `#${entry.rank}` : "—" },
                              { label: t("获得积分", "Points"),  value: `+${entry.points_awarded}` },
                            ].map(({ label, value }) => (
                              <div key={label} style={{
                                background: "#f9fafb", borderRadius: 8, padding: "8px 6px",
                                textAlign: "center", border: "1px solid #f3f4f6",
                              }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{value}</div>
                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>{label}</div>
                              </div>
                            ))}
                          </div>
                        ) : hasLive ? (
                          <div style={{ marginBottom: 10 }}>
                            <div style={{
                              display: "grid", gridTemplateColumns: "1fr 1fr",
                              gap: 8, marginBottom: 8,
                            }}>
                              <div style={{
                                background: "#fffbeb", borderRadius: 8, padding: "8px 6px",
                                textAlign: "center", border: "1px solid #fcd34d",
                              }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#d97706" }}>
                                  {fmtFpts(entry.live_total_fpts)}
                                </div>
                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                                  {t("实时总分", "Live Fpts")}
                                </div>
                              </div>
                              <div style={{
                                background: "#f9fafb", borderRadius: 8, padding: "8px 6px",
                                textAlign: "center", border: "1px solid #f3f4f6",
                              }}>
                                <div style={{ fontSize: 16, fontWeight: 800, color: "#374151" }}>
                                  {completedCount}/5
                                </div>
                                <div style={{ fontSize: 10, color: "#6b7280", marginTop: 2 }}>
                                  {t("场次完成", "Games done")}
                                </div>
                              </div>
                            </div>
                            <div style={{
                              fontSize: 12, color: "#92400e", background: "#fef3c7",
                              border: "1px solid #fcd34d", borderRadius: 6,
                              padding: "6px 10px", fontWeight: 500,
                            }}>
                              {t("比赛结束后系统将自动结算排名和积分。", "Official rank and points will be assigned after settlement.")}
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            fontSize: 12, color: "#92400e", background: "#fef3c7",
                            border: "1px solid #fcd34d", borderRadius: 6,
                            padding: "6px 10px", marginBottom: 10, fontWeight: 500,
                          }}>
                            {t("等待结算，比赛结束后自动更新排名和积分。", "Awaiting settlement — rank and points will update after games complete.")}
                          </div>
                        )}

                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>
                            {t("总工资", "Total Salary")}
                            <span style={{ fontWeight: 600, color: "#374151", marginLeft: 6 }}>
                              {fmtMoney(totalSalary)}
                            </span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/contest/leaderboard?id=${entry.contest_id}`);
                            }}
                            style={{
                              padding: "5px 12px", borderRadius: 6, border: "1px solid #e5e7eb",
                              background: "#fff", color: "#374151", cursor: "pointer",
                              fontSize: 12, fontWeight: 600,
                            }}
                          >
                            {t("查看排行榜", "Leaderboard")}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function MyLineupPage() {
  return (
    <Suspense>
      <MyLineupContent />
    </Suspense>
  );
}
