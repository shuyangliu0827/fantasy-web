"use client";

import { useLang } from "@/lib/lang";
import RequestAccessButton from "./RequestAccessButton";

type Props = {
  leagueId: string;
  leagueName: string;
  initialStatus?: "pending" | "approved" | "rejected" | "removed" | null;
};

export default function InviteOnlyLeagueWall({ leagueId, leagueName, initialStatus }: Props) {
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
        ✉️
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
          margin: "0 0 24px",
          maxWidth: 480,
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        {t(
          "该联赛为邀请制联赛。申请加入后，你可以查看数据、关注比赛，并参与获准开放的功能。",
          "This league is invite-only. Request access to follow the league, view stats, and participate in approved features.",
        )}
      </p>
      <RequestAccessButton leagueId={leagueId} initialStatus={initialStatus ?? null} />
    </div>
  );
}
