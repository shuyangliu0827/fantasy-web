"use client";

import { useLang } from "@/lib/lang";

export default function PrivateLeagueWall({ leagueName }: { leagueName: string }) {
  const { t } = useLang();
  return (
    <div
      style={{
        maxWidth: 640,
        margin: "80px auto",
        padding: "48px 32px",
        textAlign: "center",
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 24,
        boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }} aria-hidden>
        🔒
      </div>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 900,
          color: "#0f172a",
          margin: "0 0 14px",
          letterSpacing: "-0.02em",
        }}
      >
        {leagueName}
      </h1>
      <p
        style={{
          color: "#475569",
          fontSize: 15,
          lineHeight: 1.6,
          margin: 0,
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {t(
          "该联赛为私密联赛。只有获批成员可以查看数据、Fantasy 比赛、排行榜和联赛内容。",
          "This league is private. Only approved members can view its stats, fantasy contests, leaderboards, and content.",
        )}
      </p>
    </div>
  );
}
