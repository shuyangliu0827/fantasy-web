"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import { basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: "pending" | "approved" | "rejected" | "archived";
  visibility: "public" | "invite_only" | "private";
  is_contest_enabled: boolean;
};

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; league: League }
  | { kind: "not_found" }
  | { kind: "not_enabled"; league: League };

export default function LeagueContestPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);

  // 'nba' is canonical for the existing NBA daily contest experience —
  // route it to the original /contest builder.
  if (leagueSlug === "nba") {
    redirect("/contest");
  }

  return <LeagueContestInner leagueSlug={leagueSlug} />;
}

function LeagueContestInner({ leagueSlug }: { leagueSlug: string }) {
  const { t } = useLang();
  const [state, setState] = useState<LoadState>({ kind: "loading" });

  const load = useCallback(async () => {
    const res = await basketballJson<{ league: League }>(
      `/api/basketball-leagues/by-slug/${leagueSlug}`,
    );
    if (res.status === 404 || !res.data) {
      setState({ kind: "not_found" });
      return;
    }
    const league = res.data.league;
    // Contest gameplay requires: approved + public + opt-in.
    const ok =
      league.status === "approved" &&
      league.visibility === "public" &&
      league.is_contest_enabled === true;
    if (!ok) {
      setState({ kind: "not_enabled", league });
      return;
    }
    setState({ kind: "ok", league });
  }, [leagueSlug]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <LightHeader activeHref="/contest" />
      <ContestNav contestId={null} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 80px" }}>
        {state.kind === "loading" && (
          <div style={{ color: "#94a3b8", fontSize: 14, padding: "40px 0", textAlign: "center" }}>
            {t("加载中…", "Loading…")}
          </div>
        )}

        {state.kind === "not_found" && (
          <EmptyState
            icon="🏀"
            title={t("找不到该联赛", "League not found")}
            body={t(
              "该联赛暂未开放每日竞赛。",
              "This league is not available for fantasy contest yet.",
            )}
            primaryHref="/contest/other-leagues"
            primaryLabel={t("返回其他联赛", "Back to Other Leagues")}
          />
        )}

        {state.kind === "not_enabled" && (
          <EmptyState
            icon="🚧"
            title={state.league.name}
            body={t(
              "该联赛暂未开放每日竞赛。",
              "This league is not available for fantasy contest yet.",
            )}
            primaryHref={`/basketball-leagues/${state.league.slug}`}
            primaryLabel={t("查看联赛详情 →", "View League Details →")}
            secondaryHref="/contest/other-leagues"
            secondaryLabel={t("返回其他联赛", "Back to Other Leagues")}
          />
        )}

        {state.kind === "ok" && <ContestEnabledPlaceholder league={state.league} />}
      </main>
    </>
  );
}

function ContestEnabledPlaceholder({ league }: { league: League }) {
  const { t } = useLang();
  return (
    <>
      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <h1
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            margin: 0,
          }}
        >
          {league.name}
        </h1>
        <LeagueVisibilityBadge visibility={league.visibility} />
        <span
          style={{
            padding: "4px 10px",
            background: "#dcfce7",
            color: "#166534",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}
        >
          {t("竞赛已开放", "Contest enabled")}
        </span>
      </div>

      {league.description && (
        <p style={{ color: "#475569", fontSize: 15, lineHeight: 1.6, marginBottom: 24 }}>
          {league.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 32 }}>
        <Link
          href={`/basketball-leagues/${league.slug}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 18px",
            background: "#fff",
            border: "1px solid #cbd5e1",
            borderRadius: 10,
            color: "#0f172a",
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          {t("查看联赛详情 →", "View League Details →")}
        </Link>
      </div>

      <div
        style={{
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 18,
          padding: "48px 28px",
          textAlign: "center",
          maxWidth: 720,
          margin: "0 auto",
        }}
      >
        <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden>
          🚧
        </div>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            margin: "0 0 10px",
          }}
        >
          {t("每日竞赛即将上线", "Daily fantasy contest coming soon")}
        </h2>
        <p
          style={{
            color: "#475569",
            fontSize: 14,
            lineHeight: 1.6,
            maxWidth: 520,
            margin: "0 auto 18px",
          }}
        >
          {t(
            "该联赛已开放每日竞赛，但比赛工程正在搭建中：球员定价、阵容提交、自动结算和排行榜很快上线。同期可先在联赛主页浏览球队、球员和比赛数据。",
            "This league is registered for fantasy contest. The engine is under construction — player pricing, lineup submission, settlement, and leaderboards land soon. In the meantime, browse teams, players, and box scores on the league page.",
          )}
        </p>
        <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700, letterSpacing: "0.04em" }}>
          {t("即将上线：选阵容 · 每日榜 · 周积分 · 我的成绩",
             "Coming soon: Build · Daily Board · Weekly · My Results")}
        </div>
      </div>
    </>
  );
}

function EmptyState({
  icon,
  title,
  body,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  icon: string;
  title: string;
  body: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 18,
        padding: "48px 28px",
        textAlign: "center",
        maxWidth: 640,
        margin: "40px auto",
      }}
    >
      <div style={{ fontSize: 44, marginBottom: 14 }} aria-hidden>
        {icon}
      </div>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: "#0f172a",
          letterSpacing: "-0.02em",
          margin: "0 0 10px",
        }}
      >
        {title}
      </h2>
      <p style={{ color: "#475569", fontSize: 14, lineHeight: 1.6, margin: "0 auto 22px", maxWidth: 480 }}>
        {body}
      </p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
        <Link
          href={primaryHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "10px 18px",
            background: "#1e3a8a",
            color: "#fff",
            borderRadius: 10,
            fontWeight: 800,
            fontSize: 14,
            textDecoration: "none",
          }}
        >
          {primaryLabel}
        </Link>
        {secondaryHref && (
          <Link
            href={secondaryHref}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 18px",
              background: "#fff",
              border: "1px solid #cbd5e1",
              color: "#0f172a",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
            }}
          >
            {secondaryLabel}
          </Link>
        )}
      </div>
    </div>
  );
}
