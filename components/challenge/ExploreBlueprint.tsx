"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { track } from "@/lib/shared/analytics";

type Route = {
  icon: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
  path: string;
  event:
    | "challenge_start_picking_click"
    | "challenge_daily_board_click"
    | "challenge_discover_click"
    | "challenge_leagues_click";
};

const ROUTES: Route[] = [
  {
    icon: "🔥",
    titleZh: "每日竞赛",
    titleEn: "Daily Fantasy",
    bodyZh: "选择今晚阵容。",
    bodyEn: "Build tonight's lineup.",
    path: "/contest/nba/build",
    event: "challenge_start_picking_click",
  },
  {
    icon: "🏆",
    titleZh: "每日榜",
    titleEn: "Daily Board",
    bodyZh: "查看今日排名。",
    bodyEn: "See today's leaderboard.",
    path: "/contest/nba/leaderboard",
    event: "challenge_daily_board_click",
  },
  {
    icon: "🔎",
    titleZh: "发现",
    titleEn: "Discover",
    bodyZh: "浏览和发布篮球内容。",
    bodyEn: "Read and post basketball takes.",
    path: "/discover",
    event: "challenge_discover_click",
  },
  {
    icon: "👥",
    titleZh: "公开联赛",
    titleEn: "Leagues",
    bodyZh: "加入长期联赛。",
    bodyEn: "Join public season-long leagues.",
    path: "/league",
    event: "challenge_leagues_click",
  },
];

function appendQs(path: string, qs: string): string {
  if (!qs) return path;
  return path.includes("?") ? `${path}&${qs}` : `${path}?${qs}`;
}

export default function ExploreBlueprint({ qs }: { qs: string }) {
  const { t } = useLang();

  return (
    <section
      style={{
        background: "var(--bg-primary, #0a0e1a)",
        color: "#fff",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 36 }}>
          <div
            style={{
              color: "var(--accent-gold, #f59e0b)",
              textTransform: "uppercase",
              letterSpacing: "0.22em",
              fontSize: 12,
              fontWeight: 800,
              marginBottom: 10,
            }}
          >
            {t("重要路径入口", "Site Routing")}
          </div>
          <h2
            style={{
              fontSize: "clamp(28px, 4vw, 44px)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: 900,
              margin: 0,
            }}
          >
            {t("探索蓝本", "Explore Blueprint")}
          </h2>
        </div>

        <div className="challenge-routes-grid">
          {ROUTES.map((r) => (
            <Link
              key={r.path}
              href={appendQs(r.path, qs)}
              onClick={() => track(r.event, { location: "explore" })}
              style={{
                display: "block",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 24,
                padding: 24,
                color: "#fff",
                textDecoration: "none",
                transition: "transform 0.15s, border-color 0.15s",
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "rgba(245, 158, 11, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 18,
                }}
                aria-hidden
              >
                {r.icon}
              </div>
              <h3
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  margin: 0,
                }}
              >
                {t(r.titleZh, r.titleEn)}
              </h3>
              <p
                style={{
                  color: "#94a3b8",
                  fontSize: 14,
                  lineHeight: 1.5,
                  margin: "8px 0 14px",
                }}
              >
                {t(r.bodyZh, r.bodyEn)}
              </p>
              <code
                style={{
                  fontFamily:
                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  color: "var(--accent-gold-light, #fbbf24)",
                  fontSize: 12,
                }}
              >
                {r.path}
              </code>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .challenge-routes-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 1024px) {
          .challenge-routes-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 560px) {
          .challenge-routes-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
