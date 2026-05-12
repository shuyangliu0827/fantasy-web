"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
  created_at: string;
};

export default function OtherLeaguesPage() {
  const { t } = useLang();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await basketballJson<{ leagues: League[] }>(`/api/basketball-leagues`);
      if (cancelled) return;
      // Only surface approved + contest-enabled leagues here. Leagues
      // that exist but haven't opted into fantasy gameplay are still
      // reachable via /basketball-leagues/[slug] (e.g. linked from
      // anywhere else on the site); they just don't belong on a
      // "fantasy contest" discovery surface.
      const playable = (res.data?.leagues ?? []).filter(
        (l) => l.status === "approved" && l.is_contest_enabled,
      );
      setLeagues(playable);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <LightHeader activeHref="/contest" />
      <ContestNav scope={{ kind: "nba" }} contestId={null} />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px 80px" }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            margin: "0 0 6px",
          }}
        >
          {t("其他联赛", "Other Leagues")}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          {t(
            "NBA 之外的真实篮球联赛 — 校园、半职业、私人组织赛。每个联赛有独立的球队、球员和数据。",
            "Real-world basketball leagues beyond the NBA — campus, semi-pro, private. Each league has its own teams, players, and stats.",
          )}
        </p>

        {loading ? (
          <div style={{ color: "#94a3b8", fontSize: 14 }}>
            {t("加载中…", "Loading…")}
          </div>
        ) : leagues.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e2e8f0",
              borderRadius: 14,
              padding: "40px 24px",
              textAlign: "center",
              color: "#64748b",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }} aria-hidden>
              🏀
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", marginBottom: 8 }}>
              {t("更多联赛即将开放", "More leagues coming soon")}
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.6 }}>
              {t(
                "蓝本正在邀请校园和半职业联赛加入。如果你是联赛组织方，可以申请创建。",
                "Blueprint is inviting campus and semi-pro leagues. If you organize one, you can apply to host it here.",
              )}
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 14,
            }}
          >
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/contest/${l.slug}/build`}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 18,
                  textDecoration: "none",
                  color: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  transition: "transform 0.15s, border-color 0.15s",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <h2
                    style={{
                      fontSize: 18,
                      fontWeight: 900,
                      color: "#0f172a",
                      letterSpacing: "-0.02em",
                      margin: 0,
                    }}
                  >
                    {l.name}
                  </h2>
                  <LeagueVisibilityBadge visibility={l.visibility} />
                </div>
                {l.description && (
                  <p
                    style={{
                      color: "#475569",
                      fontSize: 13,
                      lineHeight: 1.5,
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {l.description}
                  </p>
                )}
                <span style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 800, marginTop: 4 }}>
                  {t("进入联赛 →", "Enter league →")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
