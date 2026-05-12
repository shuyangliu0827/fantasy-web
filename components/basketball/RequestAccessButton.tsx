"use client";

import { useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch } from "@/lib/basketball/client";

type Props = {
  leagueId: string;
  initialStatus?: "pending" | "approved" | "rejected" | "removed" | null;
  onChange?: (status: "pending" | "approved" | "rejected" | "removed") => void;
};

export default function RequestAccessButton({ leagueId, initialStatus, onChange }: Props) {
  const { t } = useLang();
  const [status, setStatus] = useState(initialStatus ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (status === "pending") {
    return (
      <span style={{ fontSize: 14, color: "#92400e", fontWeight: 700 }}>
        {t("已申请，等待审核", "Request pending review")}
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span style={{ fontSize: 14, color: "#166534", fontWeight: 700 }}>
        {t("你已获得访问权限", "You have access")}
      </span>
    );
  }

  const handleClick = async () => {
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/request-access`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setStatus("pending");
    onChange?.("pending");
  };

  return (
    <div style={{ display: "inline-flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={handleClick}
        disabled={busy}
        style={{
          minHeight: 44,
          padding: "0 22px",
          borderRadius: 12,
          background: busy ? "#94a3b8" : "#1e3a8a",
          color: "#fff",
          fontSize: 15,
          fontWeight: 800,
          border: "none",
          cursor: busy ? "default" : "pointer",
        }}
      >
        {busy ? t("申请中…", "Requesting…") : t("申请访问", "Request access")}
      </button>
      {err && (
        <span style={{ fontSize: 12, color: "#991b1b" }}>
          {err === "unauthorized" ? t("请先登录", "Please log in first") : err}
        </span>
      )}
    </div>
  );
}
