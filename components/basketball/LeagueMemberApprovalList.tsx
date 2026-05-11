"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";

type Member = {
  user_id: string;
  role: "stat_keeper" | "player" | "viewer";
  status: "pending" | "approved" | "rejected" | "removed";
};

type Props = {
  leagueId: string;
  members: Member[];
  onChanged?: () => void;
};

const ROLE_OPTIONS: Array<Member["role"]> = ["viewer", "stat_keeper", "player"];

export default function LeagueMemberApprovalList({ leagueId, members, onChanged }: Props) {
  const { t } = useLang();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (members.length === 0) {
    return (
      <div style={{ color: "#64748b", fontSize: 14, padding: "12px 0" }}>
        {t("暂无成员", "No members yet.")}
      </div>
    );
  }

  const patch = async (
    userId: string,
    next: { role?: Member["role"]; status?: Member["status"] },
  ) => {
    setBusyId(userId);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/members`,
      {
        method: "PATCH",
        body: JSON.stringify({ user_id: userId, ...next }),
      },
    );
    setBusyId(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    onChanged?.();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {err && (
        <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
      )}
      {members.map((m) => (
        <div
          key={m.user_id}
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
          <code
            style={{
              fontSize: 12,
              color: "#475569",
              flex: "1 1 220px",
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={m.user_id}
          >
            {m.user_id}
          </code>
          <select
            value={m.role}
            disabled={busyId === m.user_id}
            onChange={(e) => patch(m.user_id, { role: e.target.value as Member["role"] })}
            style={{
              minHeight: 32,
              padding: "0 10px",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontSize: 13,
              background: "#fff",
            }}
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <span
            style={{
              padding: "4px 10px",
              borderRadius: 999,
              background:
                m.status === "approved"
                  ? "#dcfce7"
                  : m.status === "pending"
                    ? "#fef3c7"
                    : "#fee2e2",
              color:
                m.status === "approved"
                  ? "#166534"
                  : m.status === "pending"
                    ? "#92400e"
                    : "#991b1b",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {m.status}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {m.status !== "approved" && (
              <button
                onClick={() => patch(m.user_id, { status: "approved" })}
                disabled={busyId === m.user_id}
                style={btnStyle("#1e3a8a")}
              >
                {t("通过", "Approve")}
              </button>
            )}
            {m.status !== "rejected" && m.status !== "removed" && (
              <button
                onClick={() =>
                  patch(m.user_id, {
                    status: m.status === "approved" ? "removed" : "rejected",
                  })
                }
                disabled={busyId === m.user_id}
                style={btnStyle("#475569")}
              >
                {m.status === "approved" ? t("移除", "Remove") : t("拒绝", "Reject")}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
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
