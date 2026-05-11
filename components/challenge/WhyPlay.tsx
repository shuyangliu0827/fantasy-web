"use client";

import { useLang } from "@/lib/lang";

type Card = {
  icon: string;
  titleZh: string;
  titleEn: string;
  bodyZh: string;
  bodyEn: string;
};

const CARDS: Card[] = [
  {
    icon: "🏀",
    titleZh: "让每场比赛更有参与感",
    titleEn: "Make every game matter",
    bodyZh: "你选的人让每一节、每一次轮换、每一个数据都变得和你有关。",
    bodyEn: "Your picks make every quarter, rotation, and stat line feel personal.",
  },
  {
    icon: "📈",
    titleZh: "积累你的篮球判断记录",
    titleEn: "Build your basketball track record",
    bodyZh: "你的阵容、分数和排名，会变成你的篮球身份。",
    bodyEn: "Your lineups, scores, and rankings become your basketball identity.",
  },
  {
    icon: "🔒",
    titleZh: "不下注也能有竞争感",
    titleEn: "Compete without betting",
    bodyZh: "没有赌钱，只有判断、排名和面子。",
    bodyEn: "No money. No gambling. Just judgment, pride, and receipts.",
  },
];

export default function WhyPlay() {
  const { t } = useLang();

  return (
    <section
      style={{
        background: "#fff",
        padding: "clamp(56px, 8vw, 96px) clamp(20px, 5vw, 48px)",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ marginBottom: 36, maxWidth: 880 }}>
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
            {t("用户价值", "User Benefit")}
          </div>
          <h2
            style={{
              fontSize: "clamp(26px, 3.6vw, 40px)",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              fontWeight: 900,
              color: "#0f172a",
              margin: 0,
            }}
          >
            {t(
              "谁都能聊球。蓝本记录你的判断结果。",
              "Anyone can talk basketball. Blueprint turns your picks into a track record.",
            )}
          </h2>
        </div>

        <div className="challenge-cards-grid">
          {CARDS.map((c) => (
            <div
              key={c.titleEn}
              style={{
                background: "#fff",
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
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  marginBottom: 18,
                }}
                aria-hidden
              >
                {c.icon}
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
                {t(c.titleZh, c.titleEn)}
              </h3>
              <p
                style={{
                  color: "#475569",
                  fontSize: 15,
                  lineHeight: 1.6,
                  margin: "10px 0 0",
                }}
              >
                {t(c.bodyZh, c.bodyEn)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
