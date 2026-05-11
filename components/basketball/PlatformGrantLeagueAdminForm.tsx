"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";

type Props = {
  leagueId: string;
  onGranted?: () => void;
};

export default function PlatformGrantLeagueAdminForm({ leagueId, onGranted }: Props) {
  const { t } = useLang();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"league_owner" | "league_admin">("league_admin");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  const submit = async () => {
    const trimmed = userId.trim();
    if (!trimmed) {
      setMsg({ kind: "err", text: t("请输入 user_id", "user_id required") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await basketballFetch(
      `/api/platform/basketball-leagues/${leagueId}/grant-admin`,
      { method: "POST", body: JSON.stringify({ user_id: trimmed, role }) },
    );
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({ kind: "err", text: body.error ?? `HTTP ${res.status}` });
      return;
    }
    setMsg({ kind: "ok", text: t("已授权", "Granted") });
    setUserId("");
    onGranted?.();
  };

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
        {t("授予联赛管理员权限", "Grant league admin")}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          placeholder="user_id (uuid)"
          style={{
            flex: "1 1 240px",
            minHeight: 40,
            padding: "0 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "league_owner" | "league_admin")}
          style={{
            minHeight: 40,
            padding: "0 12px",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            background: "#fff",
          }}
        >
          <option value="league_admin">league_admin</option>
          <option value="league_owner">league_owner</option>
        </select>
        <button
          onClick={submit}
          disabled={busy}
          style={{
            minHeight: 40,
            padding: "0 18px",
            background: busy ? "#94a3b8" : "#1e3a8a",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 800,
            cursor: busy ? "default" : "pointer",
          }}
        >
          {busy ? t("授权中…", "Granting…") : t("授权", "Grant")}
        </button>
      </div>
      {msg && (
        <div
          style={{
            fontSize: 13,
            color: msg.kind === "err" ? "#991b1b" : "#166534",
            fontWeight: 700,
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}
