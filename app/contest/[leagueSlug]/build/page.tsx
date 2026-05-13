"use client";

// /contest/[leagueSlug]/build
//
// Authorized-league daily-fantasy build page. Conceptually mirrors the
// NBA DFS build page: a horizontal date strip drives the experience,
// and selecting a date loads the contest, slate, lineup builder, and
// player pool for that date. Placeholder dates (scheduled games but
// no contest row yet) are resolved lazily via /by-date.
//
// State lifecycle on date switch:
//   • contest / slate / resolveError state is reset before the new fetch
//   • <ContestBuilder> is keyed by contest.id so its internal pool /
//     picks / lineup state never leaks across dates

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { redirect, useRouter } from "next/navigation";
import LightHeader from "@/components/LightHeader";
import ContestNav from "@/components/ContestNav";
import LeagueContestPageShell from "@/components/contest/league/PageShell";
import ContestBuilder, {
  ContestStatusHeader,
} from "@/components/contest/league/Builder";
import DateStrip, {
  bucketFor,
  type DateStripEntry,
} from "@/components/contest/league/DateStrip";
import SlateGames, {
  type SlateGame,
} from "@/components/contest/league/SlateGames";
import UnavailableNotice, {
} from "@/components/contest/league/UnavailableNotice";
import type { Contest, League } from "@/components/contest/league/types";
import type { UnavailableKind } from "@/components/contest/league/useLeagueContest";
import { basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type NearbyResponse = {
  league: { id: string; slug: string; name: string; timezone: string };
  today: string;
  contests: DateStripEntry[];
};

type ByDateBody =
  | { contest: Contest }
  | { error: string; date?: string; timezone?: string };

function pickDefaultEntry(
  entries: DateStripEntry[],
  today: string,
): DateStripEntry | null {
  if (entries.length === 0) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const todayEntry = sorted.find((e) => e.date === today);
  if (todayEntry) return todayEntry;
  const upcoming = sorted.find((e) => e.date > today);
  if (upcoming) return upcoming;
  const past = [...sorted].reverse().find((e) => e.date < today);
  return past ?? sorted[0];
}

export default function LeagueContestBuildPage({
  params,
}: {
  params: Promise<{ leagueSlug: string }>;
}) {
  const { leagueSlug } = use(params);
  if (leagueSlug === "nba") {
    redirect("/contest/nba/build");
  }
  return <Inner leagueSlug={leagueSlug} />;
}

function Inner({ leagueSlug }: { leagueSlug: string }) {
  const { t } = useLang();
  const router = useRouter();

  // League + chrome state.
  const [league, setLeague] = useState<League | null>(null);
  const [leagueUnavailable, setLeagueUnavailable] =
    useState<UnavailableKind | null>(null);
  const [loadingLeague, setLoadingLeague] = useState(true);

  // Date-strip + selection state.
  const [nearby, setNearby] = useState<DateStripEntry[]>([]);
  const [today, setToday] = useState<string>("");
  const [timezone, setTimezone] = useState<string>("UTC");
  const [selectedEntry, setSelectedEntry] = useState<DateStripEntry | null>(null);
  const [nearbyLoaded, setNearbyLoaded] = useState(false);

  // Per-date state. All four reset when the selected date changes.
  const [contest, setContest] = useState<Contest | null>(null);
  const [slate, setSlate] = useState<SlateGame[]>([]);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<{
    kind: UnavailableKind;
    date: string | null;
  } | null>(null);

  // 1. Load league metadata so the shell renders even before nearby returns.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await basketballJson<{ league: League }>(
        `/api/basketball-leagues/by-slug/${leagueSlug}`,
      );
      if (cancelled) return;
      if (res.status === 404 || !res.data) {
        setLeagueUnavailable("league_not_found");
        setLoadingLeague(false);
        return;
      }
      const l = res.data.league;
      setLeague(l);
      if (
        l.status !== "approved" ||
        l.visibility !== "public" ||
        !l.is_contest_enabled
      ) {
        setLeagueUnavailable("league_not_enabled");
      }
      setLoadingLeague(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueSlug]);

  // 2. Load nearby date strip.
  useEffect(() => {
    if (leagueUnavailable) return;
    let cancelled = false;
    (async () => {
      const res = await basketballJson<NearbyResponse>(
        `/api/basketball-contests/nearby?leagueSlug=${encodeURIComponent(leagueSlug)}`,
      );
      if (cancelled) return;
      if (!res.data) {
        setNearby([]);
        setNearbyLoaded(true);
        return;
      }
      setNearby(res.data.contests);
      setToday(res.data.today);
      setTimezone(res.data.league.timezone || "UTC");
      const def = pickDefaultEntry(res.data.contests, res.data.today);
      setSelectedEntry(def);
      setNearbyLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueSlug, leagueUnavailable]);

  // 3. Resolve the selected entry to a real contest, then load its slate.
  const loadSlate = useCallback(async (contestId: string) => {
    const res = await basketballJson<{ games: SlateGame[]; timezone: string }>(
      `/api/basketball-contests/${contestId}/games`,
    );
    if (res.data) setSlate(res.data.games);
  }, []);

  const resolveSelected = useCallback(
    async (entry: DateStripEntry) => {
      setResolving(true);
      setResolveError(null);
      setContest(null);
      setSlate([]);

      // Existing contest: fetch full metadata by id.
      if (entry.id && !entry.placeholder) {
        const res = await basketballJson<{ contest: Contest }>(
          `/api/basketball-contests/${entry.id}`,
        );
        if (!res.data) {
          setResolveError({ kind: "no_contest_today", date: entry.date });
          setResolving(false);
          return;
        }
        setContest(res.data.contest);
        await loadSlate(res.data.contest.id);
        setResolving(false);
        return;
      }

      // Placeholder: ask the resolver to materialize.
      const res = await fetch(
        `/api/basketball-contests/by-date?leagueSlug=${encodeURIComponent(leagueSlug)}&date=${entry.date}`,
      );
      const body = (await res.json().catch(() => null)) as ByDateBody | null;
      if (res.ok && body && "contest" in body) {
        setContest(body.contest);
        // Replace the placeholder in the strip with the now-real entry.
        setNearby((prev) =>
          prev.map((e) =>
            e.date === entry.date
              ? {
                  ...e,
                  id: body.contest.id,
                  status: body.contest.status,
                  lineup_lock_at: body.contest.lineup_lock_at,
                  placeholder: false,
                }
              : e,
          ),
        );
        setSelectedEntry({
          ...entry,
          id: body.contest.id,
          status: body.contest.status,
          lineup_lock_at: body.contest.lineup_lock_at,
          placeholder: false,
        });
        await loadSlate(body.contest.id);
        setResolving(false);
        return;
      }
      const err = body && "error" in body ? body.error : `http_${res.status}`;
      const kind: UnavailableKind =
        err === "no_games_on_date"     ? "no_contest_today" :
        err === "no_teams_in_games"    ? "no_teams_in_games" :
        err === "no_players_in_pool"   ? "no_players_in_pool" :
        err === "no_eligible_players"  ? "no_players_in_pool" :
        err === "league_not_enabled"   ? "league_not_enabled" :
                                          "no_contest_today";
      setResolveError({ kind, date: entry.date });
      setResolving(false);
    },
    [leagueSlug, loadSlate],
  );

  useEffect(() => {
    if (!selectedEntry) return;
    resolveSelected(selectedEntry);
  }, [selectedEntry, resolveSelected]);

  const onSelectEntry = useCallback(
    (entry: DateStripEntry) => {
      if (selectedEntry?.date === entry.date) return;
      setSelectedEntry(entry);
    },
    [selectedEntry?.date],
  );

  const onOpenLeaderboard = useCallback(() => {
    if (!contest) return;
    router.push(`/contest/${leagueSlug}/leaderboard?id=${contest.id}`);
  }, [contest, leagueSlug, router]);

  // ── render ───────────────────────────────────────────────────

  if (loadingLeague) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }
  if (leagueUnavailable === "league_not_found" || !league) {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("找不到该联赛。", "League not found.")}
        </main>
      </>
    );
  }
  if (leagueUnavailable === "league_not_enabled") {
    return (
      <>
        <LightHeader activeHref="/contest" />
        <ContestNav scope={{ kind: "league", slug: leagueSlug }} contestId={null} />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>{league.name}</div>
          <p>{t("该联赛暂未开放每日竞赛。", "This league is not available for fantasy contest yet.")}</p>
          <Link
            href={`/basketball-leagues/${league.slug}`}
            style={{
              display: "inline-block",
              marginTop: 16,
              padding: "10px 18px",
              background: "#1e3a8a",
              color: "#fff",
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            {t("查看联赛详情 →", "View League Details →")}
          </Link>
        </main>
      </>
    );
  }

  const selectedBucket = selectedEntry
    ? bucketFor(selectedEntry.date, today)
    : null;

  return (
    <LeagueContestPageShell
      leagueSlug={leagueSlug}
      league={league}
      contestId={contest?.id ?? null}
    >
      <DateStrip
        entries={nearby}
        today={today}
        selectedDate={selectedEntry?.date ?? null}
        onSelect={onSelectEntry}
      />

      {!nearbyLoaded ? (
        <div style={{ color: "#94a3b8", fontSize: 14, padding: "20px 0" }}>
          {t("加载日期…", "Loading dates…")}
        </div>
      ) : nearby.length === 0 ? (
        <UnavailableNotice
          kind="no_contest_today"
          date={today}
          timezone={timezone}
        />
      ) : resolving ? (
        <div style={{ color: "#64748b", fontSize: 14, padding: "12px 0" }}>
          {t("正在准备这一天的比赛…", "Preparing this date's contest…")}
        </div>
      ) : resolveError ? (
        <UnavailableNotice
          kind={resolveError.kind}
          date={resolveError.date}
          timezone={timezone}
        />
      ) : contest ? (
        <>
          <BucketBadge bucket={selectedBucket} />
          <ContestStatusHeader contest={contest} />
          <SlateGames games={slate} timezone={timezone} />
          <ContestBuilder key={contest.id} contest={contest} />
          <div style={{ marginTop: 24 }}>
            <button
              onClick={onOpenLeaderboard}
              style={{
                background: "transparent",
                border: "1px solid #1e3a8a",
                color: "#1e3a8a",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {t("查看排行榜", "Open daily board →")}
            </button>
          </div>
        </>
      ) : null}
    </LeagueContestPageShell>
  );
}

function BucketBadge({ bucket }: { bucket: "past" | "today" | "upcoming" | null }) {
  const { t } = useLang();
  if (!bucket) return null;
  const palette = {
    past:     { bg: "#f1f5f9", color: "#475569", label: t("已结束", "Past slate") },
    today:    { bg: "#dbeafe", color: "#1e3a8a", label: t("今日比赛", "Today's slate") },
    upcoming: { bg: "#ecfeff", color: "#0e7490", label: t("即将开始", "Upcoming slate") },
  }[bucket];
  return (
    <span
      style={{
        display: "inline-block",
        background: palette.bg,
        color: palette.color,
        padding: "4px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        marginBottom: 8,
      }}
    >
      {palette.label}
    </span>
  );
}
