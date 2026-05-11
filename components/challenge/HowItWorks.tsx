"use client";

import { useLang } from "@/lib/lang";

type Step = {
  step: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
};

const STEPS: Step[] = [
  {
    step: "01",
    titleZh: "选阵容",
    titleEn: "Pick your lineup",
    bodyZh: "比赛开始前选 5 个 NBA 球员。",
    bodyEn: "Choose 5 NBA players before games start.",
  },
  {
    step: "02",
    titleZh: "看比赛",
    titleEn: "Watch the games",
    bodyZh: "球员真实表现会转化成 fantasy points。",
    bodyEn: "Players earn fantasy points from real NBA stats.",
  },
  {
    step: "03",
    titleZh: "看排名",
    titleEn: "Climb the leaderboard",
    bodyZh: "比赛结束后，看看你的篮球判断排第几。",
    bodyEn: "Compare your score with other fans after the final buzzer.",
  },
];

export default function HowItWorks() {
  const { t } = useLang();

  return (
    <section
      id="how-it-works"
      style={{
        background: "#fff",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 36 }}>
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
            {t("快速教学", "New User Education")}
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
            {t("怎么玩", "How it works")}
          </h2>
        </div>

        <div className="challenge-cards-grid">
          {STEPS.map((s) => (
            <div
              key={s.step}
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 24,
                padding: 28,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: "var(--gradient-gold)",
                  color: "#0a0e1a",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 20,
                  marginBottom: 18,
                }}
              >
                {s.step.slice(-1)}
              </div>
              <div
                style={{
                  color: "#f59e0b",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: "0.16em",
                  marginBottom: 6,
                }}
              >
                {s.step}
              </div>
              <h3
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  letterSpacing: "-0.02em",
                  color: "#0f172a",
                  margin: 0,
                }}
              >
                {t(s.titleZh, s.titleEn)}
              </h3>
              <p
                style={{
                  color: "#475569",
                  fontSize: 15,
                  lineHeight: 1.55,
                  margin: "10px 0 0",
                }}
              >
                {t(s.bodyZh, s.bodyEn)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .challenge-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }
        @media (max-width: 860px) {
          .challenge-cards-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  );
}
