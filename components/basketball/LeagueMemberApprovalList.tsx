"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";
import { memberRoleLabel } from "@/lib/basketball/role-labels";
import { memberStatusLabel } from "@/lib/i18n/labels";

type MemberRole =
  | "league_admin"
  | "team_manager"
  | "player"
  | "referee"
  | "scorekeeper"
  | "viewer";

type UserProfile = {
  id: string;
  username: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
};
type Member = {
  user_id: string;
  role: MemberRole;
  status: "pending" | "approved" | "rejected" | "removed";
  team_id?: string | null;
  profile?: UserProfile | null;
};

type TeamRef = { id: string; name: string };

type Props = {
  leagueId: string;
  members: Member[];
  teams?: TeamRef[];
  onChanged?: () => void;
};

const ROLE_OPTIONS: MemberRole[] = [
  "league_admin",
  "team_manager",
  "player",
  "referee",
  "scorekeeper",
  "viewer",
];
const TEAM_SCOPED_ROLES = new Set<MemberRole>(["team_manager", "player"]);

export default function LeagueMemberApprovalList({ leagueId, members, teams, onChanged }: Props) {
  const { t, lang } = useLang();
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
    next: { role?: MemberRole; status?: Member["status"]; team_id?: string | null },
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
          <MemberIdentity profile={m.profile ?? null} userId={m.user_id} />
          <select
            value={m.role}
            disabled={busyId === m.user_id}
            onChange={(e) => patch(m.user_id, { role: e.target.value as MemberRole })}
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
                {memberRoleLabel(r, lang)}
              </option>
            ))}
          </select>
          {TEAM_SCOPED_ROLES.has(m.role) && teams && teams.length > 0 && (
            <select
              value={m.team_id ?? ""}
              disabled={busyId === m.user_id}
              onChange={(e) => patch(m.user_id, { team_id: e.target.value || null })}
              style={{
                minHeight: 32,
                padding: "0 10px",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                fontSize: 12,
                background: "#fff",
                maxWidth: 160,
              }}
              title={t("球队", "Team")}
            >
              <option value="">{t("(无队)", "(no team)")}</option>
              {teams.map((tm) => (
                <option key={tm.id} value={tm.id}>{tm.name}</option>
              ))}
            </select>
          )}
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
            }}
          >
            {memberStatusLabel(m.status, lang)}
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

function MemberIdentity({
  profile,
  userId,
}: {
  profile: UserProfile | null;
  userId: string;
}) {
  // Priority: name → username → email → shortened UUID.
  const primary =
    profile?.name?.trim() ||
    profile?.username?.trim() ||
    profile?.email?.trim() ||
    `${userId.slice(0, 8)}…`;
  const secondaryParts: string[] = [];
  if (profile?.email && profile.email.trim() !== primary) {
    secondaryParts.push(profile.email.trim());
  }
  secondaryParts.push(`user_id: ${userId}`);

  return (
    <div
      style={{
        flex: "1 1 220px",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: "#0f172a",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={primary}
      >
        {primary}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "#94a3b8",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={userId}
      >
        {secondaryParts.join(" · ")}
      </span>
    </div>
  );
}
