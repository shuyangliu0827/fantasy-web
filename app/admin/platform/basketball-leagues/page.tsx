"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import PlatformGrantLeagueAdminForm from "@/components/basketball/PlatformGrantLeagueAdminForm";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";

type League = {
  id: string;
  slug: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "archived";
  visibility: "public" | "invite_only" | "private";
  created_by: string;
  created_at: string;
};

type MeAccess = {
  user_id: string | null;
  is_platform_admin: boolean;
};

const STATUS_NEXT: Record<League["status"], League["status"]> = {
  pending: "approved",
  approved: "archived",
  rejected: "approved",
  archived: "approved",
};

export default function PlatformBasketballLeaguesPage() {
  const { t } = useLang();
  const [me, setMe] = useState<MeAccess | null>(null);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const meRes = await basketballJson<MeAccess>(`/api/me/basketball-access`);
    setMe(meRes.data);
    if (!meRes.data?.is_platform_admin) return;

    const list = await basketballJson<{ leagues: League[] }>(`/api/platform/basketball-leagues`);
    if (list.error) {
      setErr(list.error);
      return;
    }
    setLeagues(list.data?.leagues ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (id: string, status: League["status"]) => {
    setErr(null);
    const res = await basketballFetch(
      `/api/platform/basketball-leagues/${id}/status`,
      { method: "PATCH", body: JSON.stringify({ status }) },
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(body.error ?? `HTTP ${res.status}`);
      return;
    }
    setLeagues((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
  };

  if (!me) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
          {t("加载中…", "Loading…")}
        </main>
      </>
    );
  }

  if (!me.is_platform_admin) {
    return (
      <>
        <LightHeader activeHref="" />
        <main style={{ padding: 40, textAlign: "center", color: "#991b1b", fontWeight: 700 }}>
          {t("仅平台管理员可访问。", "Platform admin only.")}
        </main>
      </>
    );
  }

  return (
    <>
      <LightHeader activeHref="" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 900,
            color: "#0f172a",
            letterSpacing: "-0.02em",
            margin: "0 0 6px",
          }}
        >
          {t("平台管理 · 篮球联赛", "Platform · Basketball Leagues")}
        </h1>
        <p style={{ color: "#475569", fontSize: 14, margin: "0 0 24px" }}>
          {t(
            "审核联赛申请、归档失活联赛、授予联赛管理员权限。",
            "Approve / archive leagues and grant league admin permissions.",
          )}
        </p>

        {err && (
          <div
            style={{
              background: "#fee2e2",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: 8,
              marginBottom: 16,
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            {err}
          </div>
        )}

        {leagues.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: 24, textAlign: "center" }}>
            {t("暂无篮球联赛。", "No basketball leagues yet.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leagues.map((l) => (
              <div
                key={l.id}
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                  padding: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Link
                      href={`/basketball-leagues/${l.slug}`}
                      style={{
                        fontWeight: 900,
                        color: "#0f172a",
                        textDecoration: "none",
                        fontSize: 16,
                      }}
                    >
                      {l.name}
                    </Link>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      /{l.slug} ·{" "}
                      <code title={l.created_by}>created_by {l.created_by.slice(0, 8)}…</code>
                    </div>
                  </div>
                  <LeagueVisibilityBadge visibility={l.visibility} />
                  <span
                    style={{
                      padding: "4px 10px",
                      borderRadius: 999,
                      background:
                        l.status === "approved"
                          ? "#dcfce7"
                          : l.status === "pending"
                            ? "#fef3c7"
                            : "#fee2e2",
                      color:
                        l.status === "approved"
                          ? "#166534"
                          : l.status === "pending"
                            ? "#92400e"
                            : "#991b1b",
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    {l.status}
                  </span>
                  <button
                    onClick={() => setStatus(l.id, STATUS_NEXT[l.status])}
                    style={smallBtn("#1e3a8a")}
                  >
                    {t("切换到", "→")} {STATUS_NEXT[l.status]}
                  </button>
                  {l.status !== "rejected" && (
                    <button
                      onClick={() => setStatus(l.id, "rejected")}
                      style={smallBtn("#475569")}
                    >
                      {t("拒绝", "Reject")}
                    </button>
                  )}
                  <button
                    onClick={() => setExpanded((id) => (id === l.id ? null : l.id))}
                    style={smallBtn("#0f172a")}
                  >
                    {expanded === l.id ? t("收起", "Hide") : t("授权", "Grant")}
                  </button>
                </div>
                {expanded === l.id && (
                  <div style={{ marginTop: 14 }}>
                    <PlatformGrantLeagueAdminForm leagueId={l.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function smallBtn(bg: string): React.CSSProperties {
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
