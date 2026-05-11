"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang } from "@/lib/lang";
import { track } from "@/lib/shared/analytics";

type Contest = {
  id: string;
  date: string;
  status: "pending" | "open" | "locked" | "scored";
  lineup_lock_at: string | null;
};

type Props = {
  contestHref: string;
  dailyBoardHref: string;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ready"; contest: Contest }
  | { kind: "fallback" };

function formatDate(iso: string, lang: "zh" | "en"): string {
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return iso;
  if (lang === "zh") {
    return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  }
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatLockTime(iso: string | null, lang: "zh" | "en"): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(lang === "zh" ? "zh-CN" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: lang === "en",
  });
}

export default function TodayChallengePreview({ contestHref, dailyBoardHref }: Props) {
  const { t, lang } = useLang();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/contests/today", { signal: ctrl.signal });
        if (!res.ok) {
          setState({ kind: "fallback" });
          return;
        }
        const data = (await res.json()) as Contest;
        if (!data || !data.date) {
          setState({ kind: "fallback" });
          return;
        }
        setState({ kind: "ready", contest: data });
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setState({ kind: "fallback" });
      }
    })();
    return () => ctrl.abort();
  }, []);

  const handleBuild = () => {
    track("challenge_start_picking_click", { location: "today_preview" });
  };
  const handleBoard = () => {
    track("challenge_daily_board_click", { location: "today_preview" });
  };
  const handleDiscoverFromFallback = () => {
    track("challenge_discover_click", { location: "today_preview_fallback" });
  };

  return (
    <section
      style={{
        background: "#f8fafc",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            {t("转化模块", "Conversion Module")}
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: 900,
              color: "#0f172a",
              margin: 0,
            }}
          >
            {t("今日挑战", "Today's Challenge")}
          </h2>
        </div>

        {state.kind === "loading" && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 24,
              padding: 32,
              minHeight: 220,
              color: "#94a3b8",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {t("加载中…", "Loading…")}
          </div>
        )}

        {state.kind === "ready" && (
          <ReadyCard
            contest={state.contest}
            t={t}
            lang={lang}
            contestHref={contestHref}
            dailyBoardHref={dailyBoardHref}
            onBuild={handleBuild}
            onBoard={handleBoard}
          />
        )}

        {state.kind === "fallback" && (
          <FallbackCard
            t={t}
            contestHref={contestHref}
            onDiscover={handleDiscoverFromFallback}
            onBuild={handleBuild}
          />
        )}
      </div>
    </section>
  );
}

function StatusBadge({ status, t }: { status: Contest["status"]; t: (zh: string, en: string) => string }) {
  const map: Record<Contest["status"], { bg: string; fg: string; zh: string; en: string }> = {
    pending: { bg: "#fef3c7", fg: "#92400e", zh: "即将开放", en: "Soon" },
    open: { bg: "#dcfce7", fg: "#166534", zh: "开放中", en: "Open" },
    locked: { bg: "#e0e7ff", fg: "#3730a3", zh: "已锁定", en: "Locked" },
    scored: { bg: "#f1f5f9", fg: "#475569", zh: "已结算", en: "Final" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.fg,
        borderRadius: 999,
        padding: "8px 14px",
        fontSize: 12,
        fontWeight: 900,
        letterSpacing: "0.05em",
        whiteSpace: "nowrap",
      }}
    >
      {t(cfg.zh, cfg.en)}
    </span>
  );
}

function ReadyCard({
  contest,
  t,
  lang,
  contestHref,
  dailyBoardHref,
  onBuild,
  onBoard,
}: {
  contest: Contest;
  t: (zh: string, en: string) => string;
  lang: "zh" | "en";
  contestHref: string;
  dailyBoardHref: string;
  onBuild: () => void;
  onBoard: () => void;
}) {
  const lockTime = formatLockTime(contest.lineup_lock_at, lang);
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 10px 40px rgba(15,23,42,0.06)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "26px 28px",
          borderBottom: "1px solid #f1f5f9",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
            }}
          >
            {t("每日竞赛", "Daily Contest")}
          </div>
          <h3
            style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.02em",
              color: "#0f172a",
              margin: "6px 0 0",
            }}
          >
            {formatDate(contest.date, lang)}
          </h3>
        </div>
        <StatusBadge status={contest.status} t={t} />
      </div>

      <div className="challenge-stats-row">
        <Stat label={t("阵容", "Lineup")} value="5" />
        <Stat label={t("计分", "Scoring")} value="FPTS" />
        <Stat label={t("奖励", "Reward")} value={t("排名", "Rank")} />
        <Stat
          label={t("锁定时间", "Locks at")}
          value={lockTime ?? t("赛前", "Tipoff")}
        />
      </div>

      <div
        style={{
          padding: "24px 28px",
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <Link
          href={contestHref}
          onClick={onBuild}
          style={primaryBtnStyle()}
        >
          {t("创建我的阵容", "Build My Lineup")} →
        </Link>
        <Link
          href={dailyBoardHref}
          onClick={onBoard}
          style={secondaryBtnStyle()}
        >
          {t("查看每日榜", "View Daily Board")}
        </Link>
      </div>

      <style>{`
        .challenge-stats-row {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        .challenge-stats-row > div { border-right: 1px solid #f1f5f9; }
        .challenge-stats-row > div:last-child { border-right: none; }
        @media (max-width: 720px) {
          .challenge-stats-row { grid-template-columns: repeat(2, 1fr); }
          .challenge-stats-row > div:nth-child(2) { border-right: none; }
          .challenge-stats-row > div:nth-child(-n+2) { border-bottom: 1px solid #f1f5f9; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: "22px 24px" }}>
      <small
        style={{
          display: "block",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </small>
      <strong
        style={{
          display: "block",
          marginTop: 8,
          fontSize: 24,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </strong>
    </div>
  );
}

function FallbackCard({
  t,
  contestHref,
  onDiscover,
  onBuild,
}: {
  t: (zh: string, en: string) => string;
  contestHref: string;
  onDiscover: () => void;
  onBuild: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 28,
        padding: "36px 28px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 40, marginBottom: 10 }} aria-hidden>
        🏀
      </div>
      <p
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: "#0f172a",
          margin: "0 0 22px",
          maxWidth: 540,
          marginLeft: "auto",
          marginRight: "auto",
          lineHeight: 1.5,
        }}
      >
        {t(
          "今天暂无 NBA 比赛，挑战开放时再来。",
          "Today's NBA challenge opens when games are available.",
        )}
      </p>
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <Link href={contestHref} onClick={onBuild} style={primaryBtnStyle()}>
          {t("进入每日竞赛", "Go to Daily Fantasy")}
        </Link>
        <Link href="/discover" onClick={onDiscover} style={secondaryBtnStyle()}>
          {t("探索蓝本", "Explore Blueprint")}
        </Link>
      </div>
    </div>
  );
}

function primaryBtnStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    padding: "0 22px",
    borderRadius: 12,
    background: "#1e3a8a",
    color: "#fff",
    fontSize: 15,
    fontWeight: 800,
    textDecoration: "none",
    boxShadow: "0 10px 24px rgba(30,58,138,0.24)",
  };
}

function secondaryBtnStyle(): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    minHeight: 48,
    padding: "0 22px",
    borderRadius: 12,
    background: "#fff",
    border: "1px solid #e2e8f0",
    color: "#0f172a",
    fontSize: 15,
    fontWeight: 700,
    textDecoration: "none",
  };
}
