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
            {leagues.map((l) => {
              const href = l.is_contest_enabled
                ? `/contest/${l.slug}/build`
                : `/basketball-leagues/${l.slug}`;
              return (
                <Link
                  key={l.id}
                  href={href}
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
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
