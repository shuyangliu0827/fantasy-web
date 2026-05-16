"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
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

export default function CommunityLeaguesPage() {
  const { t } = useLang();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await basketballJson<{ leagues: League[] }>(`/api/basketball-leagues`);
      if (cancelled) return;
      // The Community Leagues directory shows every approved real
      // basketball league. Whether a given league has opted into the
      // DFS contest surface is a separate axis (is_contest_enabled),
      // surfaced per-card via the link target.
      const approved = (res.data?.leagues ?? []).filter(
        (l) => l.status === "approved",
      );
      setLeagues(approved);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <LightHeader activeHref="/community-leagues" />
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
          {t("社区联赛", "Community Leagues")}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, margin: "0 0 24px", lineHeight: 1.6 }}>
          {t(
            "探索 Blueprint Fantasy 上的真实篮球联赛，包括校园、半职业和私人组织赛。",
            "Explore real basketball leagues on Blueprint Fantasy, including campus, semi-professional, and community-run leagues.",
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
              <div
                key={l.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 18,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
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
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  {l.is_contest_enabled && (
                    <Link
                      href={`/contest/${l.slug}/build`}
                      style={{
                        fontSize: 13,
                        color: "#1e3a8a",
                        fontWeight: 800,
                        textDecoration: "none",
                      }}
                    >
                      {t("进入每日竞赛 →", "Play daily contest →")}
                    </Link>
                  )}
                  <Link
                    href={`/basketball-leagues/${l.slug}`}
                    style={{
                      fontSize: 13,
                      color: "#1e3a8a",
                      fontWeight: 800,
                      textDecoration: "none",
                    }}
                  >
                    {t("查看联赛详情 →", "View league details →")}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
