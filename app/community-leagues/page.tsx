"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import LeagueLogo from "@/components/basketball/LeagueLogo";
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
  logo_url: string | null;
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
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 20px 96px" }}>
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            {t("发现 · 真实联赛", "Discover · Real Leagues")}
          </div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.03em",
              margin: "0 0 10px",
              lineHeight: 1.1,
            }}
          >
            {t("社区联赛", "Community Leagues")}
          </h1>
          <p
            style={{
              color: "#475569",
              fontSize: 15,
              margin: 0,
              lineHeight: 1.65,
              maxWidth: 640,
            }}
          >
            {t(
              "探索 Blueprint Fantasy 上的真实篮球联赛，包括校园、半职业和私人组织赛。",
              "Explore real basketball leagues on Blueprint Fantasy — campus, semi-pro, and community-run.",
            )}
          </p>
        </div>

        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 14,
            }}
          >
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "linear-gradient(135deg, #f8fafc, #f1f5f9)",
                  border: "1px solid #eef2f7",
                  borderRadius: 18,
                  height: 168,
                }}
              />
            ))}
          </div>
        ) : leagues.length === 0 ? (
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef2f7",
              borderRadius: 18,
              padding: "56px 24px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#0f172a",
                letterSpacing: "-0.01em",
                marginBottom: 6,
              }}
            >
              {t("更多联赛即将开放", "More leagues coming soon")}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.65, maxWidth: 480, margin: "0 auto" }}>
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
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: 16,
            }}
          >
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/basketball-leagues/${l.slug}`}
                className="bp-league-card"
                style={{
                  position: "relative",
                  background: "#fff",
                  border: "1px solid #eef2f7",
                  borderRadius: 18,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  textDecoration: "none",
                  color: "inherit",
                  overflow: "hidden",
                  transition: "transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease",
                }}
              >
                <div
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "radial-gradient(120% 80% at 100% 0%, rgba(30, 58, 138, 0.06), transparent 55%)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>
                  <LeagueLogo name={l.name} logoUrl={l.logo_url} size={56} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h2
                      style={{
                        fontSize: 19,
                        fontWeight: 900,
                        color: "#0f172a",
                        letterSpacing: "-0.02em",
                        margin: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {l.name}
                    </h2>
                    <div style={{ marginTop: 6 }}>
                      <LeagueVisibilityBadge visibility={l.visibility} />
                    </div>
                  </div>
                </div>
                {l.description ? (
                  <p
                    style={{
                      color: "#475569",
                      fontSize: 13.5,
                      lineHeight: 1.6,
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {l.description}
                  </p>
                ) : (
                  <div style={{ flex: 1 }} />
                )}
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    paddingTop: 12,
                    borderTop: "1px solid #f1f5f9",
                    position: "relative",
                  }}
                >
                  {l.is_contest_enabled && (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        window.location.href = `/contest/${l.slug}/build`;
                      }}
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#92400e",
                        padding: "5px 12px",
                        borderRadius: 999,
                        background: "linear-gradient(135deg, #fef3c7, #fde68a)",
                        letterSpacing: "0.02em",
                        cursor: "pointer",
                      }}
                    >
                      {t("每日竞赛", "Daily Contest")} →
                    </span>
                  )}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 13,
                      color: "#1e3a8a",
                      fontWeight: 800,
                    }}
                  >
                    {t("查看详情 →", "View details →")}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <style>{`
        .bp-league-card:hover {
          transform: translateY(-2px);
          border-color: #cbd5e1;
          box-shadow: 0 20px 40px -24px rgba(15, 23, 42, 0.18);
        }
      `}</style>
    </>
  );
}
