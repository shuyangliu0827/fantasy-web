"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import AuthGate from "@/components/basketball/AuthGate";
import LeagueVisibilityBadge from "@/components/basketball/LeagueVisibilityBadge";
import LeagueLogo from "@/components/basketball/LeagueLogo";
import PlatformGrantLeagueAdminForm from "@/components/basketball/PlatformGrantLeagueAdminForm";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { useLang } from "@/lib/lang";
import { leagueStatusLabel } from "@/lib/basketball/status-labels";

type League = {
  id: string;
  slug: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "archived";
  visibility: "public" | "invite_only" | "private";
  created_by: string;
  created_at: string;
  logo_url?: string | null;
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
  return (
    <AuthGate>
      <PlatformBasketballLeaguesPageInner />
    </AuthGate>
  );
}

function PlatformBasketballLeaguesPageInner() {
  const { t, lang } = useLang();
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
      <main style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 20px 96px" }}>
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#94a3b8",
              marginBottom: 8,
            }}
          >
            {t("平台管理", "Platform Admin")}
          </div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: "#0f172a",
              letterSpacing: "-0.025em",
              margin: "0 0 10px",
              lineHeight: 1.15,
            }}
          >
            {t("篮球联赛", "Basketball Leagues")}
          </h1>
          <p style={{ color: "#475569", fontSize: 14, margin: 0, lineHeight: 1.6, maxWidth: 640 }}>
            {t(
              "审核联赛申请、归档失活联赛、授予联赛管理员权限。",
              "Approve / archive leagues and grant league admin permissions.",
            )}
          </p>
        </div>

        <CreateLeagueForm onCreated={load} />

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
          <div
            style={{
              background: "#fff",
              border: "1px solid #eef2f7",
              borderRadius: 16,
              padding: "48px 24px",
              textAlign: "center",
              color: "#64748b",
              fontSize: 14,
            }}
          >
            {t("暂无篮球联赛。", "No basketball leagues yet.")}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {leagues.map((l) => (
              <div
                key={l.id}
                style={{
                  background: "#fff",
                  border: "1px solid #eef2f7",
                  borderRadius: 16,
                  padding: 18,
                  transition: "border-color 0.18s ease, box-shadow 0.18s ease",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 14,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <LeagueLogo name={l.name} logoUrl={l.logo_url} size={44} />
                  <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                    <Link
                      href={`/basketball-leagues/${l.slug}`}
                      style={{
                        fontWeight: 900,
                        color: "#0f172a",
                        textDecoration: "none",
                        fontSize: 16,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {l.name}
                    </Link>
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                      <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                        /{l.slug}
                      </span>{" "}
                      ·{" "}
                      <code title={l.created_by} style={{ color: "#94a3b8" }}>
                        {l.created_by.slice(0, 8)}…
                      </code>
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
                      letterSpacing: "0.06em",
                    }}
                  >
                    {leagueStatusLabel(l.status, lang)}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button
                      onClick={() => setStatus(l.id, STATUS_NEXT[l.status])}
                      style={smallBtn("primary")}
                    >
                      → {leagueStatusLabel(STATUS_NEXT[l.status], lang)}
                    </button>
                    {l.status !== "rejected" && (
                      <button
                        onClick={() => setStatus(l.id, "rejected")}
                        style={smallBtn("ghost")}
                      >
                        {t("拒绝", "Reject")}
                      </button>
                    )}
                    <button
                      onClick={() => setExpanded((id) => (id === l.id ? null : l.id))}
                      style={smallBtn("dark")}
                    >
                      {expanded === l.id ? t("收起", "Hide") : t("授权", "Grant")}
                    </button>
                  </div>
                </div>
                {expanded === l.id && (
                  <div
                    style={{
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: "1px solid #f1f5f9",
                    }}
                  >
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

function smallBtn(variant: "primary" | "dark" | "ghost"): React.CSSProperties {
  const base: React.CSSProperties = {
    minHeight: 32,
    padding: "0 14px",
    border: "none",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.01em",
    cursor: "pointer",
    transition: "background 0.15s ease, color 0.15s ease",
  };
  if (variant === "primary") {
    return {
      ...base,
      background: "linear-gradient(135deg, #1e3a8a, #1e40af)",
      color: "#fff",
    };
  }
  if (variant === "dark") {
    return { ...base, background: "#0f172a", color: "#fff" };
  }
  return {
    ...base,
    background: "transparent",
    color: "#475569",
    border: "1px solid #e2e8f0",
  };
}

function CreateLeagueForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useLang();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [open, setOpen] = useState(false);

  const slugify = (v: string) =>
    v
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const submit = async () => {
    const nm = name.trim();
    const sl = slug.trim() || slugify(nm);
    if (!nm || !sl) {
      setMsg({ kind: "err", text: t("名称和 slug 必填", "Name and slug required") });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await basketballFetch(`/api/basketball-leagues`, {
      method: "POST",
      body: JSON.stringify({
        name: nm,
        slug: sl,
        description: description || undefined,
      }),
    });
    setBusy(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg({
        kind: "err",
        text:
          body.error === "duplicate key value violates unique constraint \"basketball_leagues_slug_key\""
            ? t("slug 已被占用", "slug already taken")
            : body.error ?? `HTTP ${res.status}`,
      });
      return;
    }
    setMsg({ kind: "ok", text: t("已创建", "Created") });
    setName("");
    setSlug("");
    setDescription("");
    setOpen(false);
    onCreated();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          minHeight: 40,
          padding: "0 18px",
          background: "#1e3a8a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 800,
          cursor: "pointer",
          marginBottom: 20,
        }}
      >
        + {t("创建新联赛", "New basketball league")}
      </button>
    );
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #cbd5e1",
        borderRadius: 14,
        padding: 18,
        marginBottom: 20,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ fontWeight: 900, color: "#0f172a", fontSize: 16 }}>
        {t("创建新联赛", "New basketball league")}
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("联赛名称 (例: 北区夏季联赛)", "League name (e.g. North Summer League)")}
        style={fieldStyle()}
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={t("slug (URL 用，留空自动生成)", "slug (URL path, auto-generated if empty)")}
        style={{ ...fieldStyle(), fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t("简介（可选）", "Description (optional)")}
        style={{ ...fieldStyle(), minHeight: 70, padding: 10, resize: "vertical" }}
      />
      <div style={{ display: "flex", gap: 8 }}>
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
          {busy ? t("创建中…", "Creating…") : t("创建", "Create")}
        </button>
        <button
          onClick={() => {
            setOpen(false);
            setMsg(null);
          }}
          style={{
            minHeight: 40,
            padding: "0 14px",
            background: "transparent",
            color: "#475569",
            border: "1px solid #cbd5e1",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {t("取消", "Cancel")}
        </button>
      </div>
      <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5 }}>
        {t(
          "联赛会以 pending / invite_only 状态创建，你将自动成为 league_owner。可在下面把它切到 approved + public。",
          "League is created as pending / invite_only. You become league_owner automatically. Flip it to approved + public below.",
        )}
      </div>
      {msg && (
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: msg.kind === "err" ? "#991b1b" : "#166534",
          }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

function fieldStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  };
}
