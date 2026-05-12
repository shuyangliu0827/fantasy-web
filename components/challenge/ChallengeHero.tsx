"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { track } from "@/lib/shared/analytics";

type Props = {
  contestHref: string;
  utm: Record<string, string | null>;
};

export default function ChallengeHero({ contestHref, utm }: Props) {
  const { t } = useLang();

  const handleStartClick = () => {
    track("challenge_start_picking_click", { location: "hero", ...utm });
  };

  const handleHowClick = () => {
    track("challenge_how_it_works_click", utm);
    const el = document.getElementById("how-it-works");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      style={{
        position: "relative",
        background: "var(--gradient-hero)",
        color: "#fff",
        overflow: "hidden",
        borderBottom: "1px solid var(--border-color)",
      }}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.10) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: "rgba(245, 158, 11, 0.18)",
          filter: "blur(90px)",
          animation: "challengeGlowPulse 6s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <style>{`
        @keyframes challengeGlowPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>

      <div
        style={{
          position: "relative",
          maxWidth: 1200,
          margin: "0 auto",
          padding: "clamp(56px, 9vw, 112px) clamp(20px, 5vw, 48px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: 22,
          minHeight: "min(78vh, 720px)",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: "6px 14px",
            borderRadius: 999,
            background: "rgba(245, 158, 11, 0.14)",
            border: "1px solid rgba(245, 158, 11, 0.4)",
            color: "var(--accent-gold-light)",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          {t("扫码入口", "Poster QR Entry")}
        </span>

        <h1
          style={{
            fontSize: "clamp(40px, 7vw, 76px)",
            lineHeight: 0.98,
            letterSpacing: "-0.04em",
            fontWeight: 900,
            margin: 0,
            maxWidth: 760,
            textShadow: "0 4px 32px rgba(0,0,0,0.4)",
          }}
        >
          {t("今晚选你的 NBA 阵容。", "Pick your NBA lineup tonight.")}
        </h1>

        <p
          style={{
            fontSize: "clamp(16px, 2.2vw, 20px)",
            lineHeight: 1.55,
            color: "#cbd5e1",
            margin: 0,
            maxWidth: 580,
          }}
        >
          {t(
            "比赛开始前选 5 个球员，真实 NBA 数据决定排行榜。",
            "Choose 5 players before tipoff. Real NBA stats decide the leaderboard.",
          )}
        </p>

        <p
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "#94a3b8",
            margin: 0,
            letterSpacing: "0.01em",
          }}
        >
          {t(
            "不下注，不赌钱，只拼篮球判断。",
            "No betting. No cash prizes. Just basketball judgment.",
          )}
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 14,
          }}
        >
          <Link
            href={contestHref}
            onClick={handleStartClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 52,
              padding: "0 26px",
              borderRadius: 14,
              background: "var(--gradient-gold)",
              color: "#0a0e1a",
              fontSize: 16,
              fontWeight: 800,
              textDecoration: "none",
              boxShadow: "var(--shadow-glow)",
              transition: "transform 0.15s",
            }}
          >
            {t("开始选人", "Start Picking")} →
          </Link>
          <button
            type="button"
            onClick={handleHowClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              minHeight: 52,
              padding: "0 26px",
              borderRadius: 14,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#fff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
            }}
          >
            {t("怎么玩", "How It Works")}
          </button>
        </div>
      </div>
    </section>
  );
}
