"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";
import { track } from "@/lib/shared/analytics";

type Props = {
  contestHref: string;
  utm: Record<string, string | null>;
};

export default function FinalCTA({ contestHref, utm }: Props) {
  const { t } = useLang();

  const handleClick = () => {
    track("challenge_start_picking_click", { location: "final_cta", ...utm });
  };

  return (
    <section
      style={{
        padding: "clamp(40px, 6vw, 72px) clamp(20px, 5vw, 48px)",
        background: "#fff",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          background:
            "linear-gradient(135deg, #243f96 0%, #14337f 60%, #0a1f5a 100%)",
          color: "#fff",
          borderRadius: 28,
          padding: "clamp(48px, 7vw, 88px) clamp(24px, 5vw, 56px)",
          textAlign: "center",
          boxShadow: "0 28px 70px rgba(20, 51, 127, 0.32)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: 0.18,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            pointerEvents: "none",
          }}
        />
        <h2
          style={{
            position: "relative",
            fontSize: "clamp(28px, 5vw, 44px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            fontWeight: 900,
            margin: 0,
          }}
        >
          {t("准备好做出你的判断了吗？", "Ready to make your call?")}
        </h2>
        <p
          style={{
            position: "relative",
            color: "#dbeafe",
            fontSize: "clamp(15px, 2vw, 18px)",
            margin: "14px auto 28px",
            maxWidth: 560,
            lineHeight: 1.55,
          }}
        >
          {t(
            "赛前选阵容，赛后看排名。",
            "Pick your lineup before tipoff. Check the leaderboard after the games.",
          )}
        </p>
        <Link
          href={contestHref}
          onClick={handleClick}
          style={{
            position: "relative",
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            minHeight: 56,
            padding: "0 32px",
            borderRadius: 14,
            background: "var(--gradient-gold, linear-gradient(135deg,#f59e0b,#d97706))",
            color: "#0a0e1a",
            fontSize: 17,
            fontWeight: 900,
            textDecoration: "none",
            boxShadow: "0 16px 32px rgba(245,158,11,0.32)",
          }}
        >
          {t("开始选人", "Start Picking")} →
        </Link>
      </div>
    </section>
  );
}
