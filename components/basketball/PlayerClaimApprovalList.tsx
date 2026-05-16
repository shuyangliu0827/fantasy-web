"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";

type Player = {
  id: string;
  display_name: string;
  claimed_by_user_id: string | null;
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
};

type Props = {
  players: Player[];
  onChanged?: () => void;
};

export default function PlayerClaimApprovalList({ players, onChanged }: Props) {
  const { t } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const pending = players.filter((p) => p.claim_status === "pending");
  const approved = players.filter((p) => p.claim_status === "approved");

  const decide = async (playerId: string, claim_status: "approved" | "rejected") => {
    setBusyId(playerId);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-players/${playerId}/claim`,
      { method: "PATCH", body: JSON.stringify({ claim_status }) },
    );
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    onChanged?.();
  };

  const unbind = async (playerId: string) => {
    if (
      !window.confirm(
        t(
          "确认解绑该球员？平台账号将与该档案断开。",
          "Unbind this player? The platform account will be disconnected from this profile.",
        ),
      )
    )
      return;
    setBusyId(playerId);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-players/${playerId}/claim`,
      { method: "DELETE" },
    );
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    onChanged?.();
  };

  if (pending.length === 0 && approved.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 14, padding: "12px 0" }}>
        {t("暂无认领申请", "No pending claims.")}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
      )}
      {pending.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            {t("待审核", "Pending")} · {pending.length}
          </h3>
          {pending.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#fff",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                  {p.display_name}
                </div>
                <code
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                  title={p.claimed_by_user_id ?? undefined}
                >
                  {p.claimed_by_user_id}
                </code>
              </div>
              <button
                onClick={() => decide(p.id, "approved")}
                disabled={busyId === p.id}
                style={btn("#1e3a8a")}
              >
                {t("通过", "Approve")}
              </button>
              <button
                onClick={() => decide(p.id, "rejected")}
                disabled={busyId === p.id}
                style={btn("#475569")}
              >
                {t("拒绝", "Reject")}
              </button>
            </div>
          ))}
        </section>
      )}
      {approved.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3
            style={{
              fontSize: 13,
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              letterSpacing: "0.02em",
            }}
          >
            {t("已绑定", "Linked")} · {approved.length}
          </h3>
          {approved.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                background: "#fff",
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                  {p.display_name}
                </div>
                <code
                  style={{
                    fontSize: 11,
                    color: "#64748b",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    display: "block",
                  }}
                  title={p.claimed_by_user_id ?? undefined}
                >
                  {p.claimed_by_user_id}
                </code>
              </div>
              <button
                onClick={() => unbind(p.id)}
                disabled={busyId === p.id}
                style={{
                  ...btn("#991b1b"),
                  background: "transparent",
                  color: "#991b1b",
                  border: "1px solid #fecaca",
                }}
              >
                {t("解绑", "Unbind")}
              </button>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return {
    minHeight: 32,
    padding: "0 12px",
    background: bg,
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  };
}
