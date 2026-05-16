"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";

type Team = {
  id: string;
  name: string;
  abbreviation: string | null;
  city: string | null;
  logo_url: string | null;
};

type Props = {
  leagueId: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function TeamBindModal({
  leagueId,
  onClose,
  onSubmitted,
}: Props) {
  const { t } = useLang();
  const [teams, setTeams] = useState<Team[]>([]);
  const [boundTeamIds, setBoundTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [tRes, mRes] = await Promise.all([
        basketballJson<{ teams: Team[] }>(
          `/api/basketball-leagues/${leagueId}/teams`,
        ),
        basketballJson<{ team_ids: string[] }>(
          `/api/basketball-leagues/${leagueId}/managed-teams`,
        ),
      ]);
      if (cancelled) return;
      setTeams(tRes.data?.teams ?? []);
      setBoundTeamIds(new Set(mRes.data?.team_ids ?? []));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const available = useMemo(
    () => teams.filter((tm) => !boundTeamIds.has(tm.id)),
    [teams, boundTeamIds],
  );

  const translateError = (code: string) => {
    if (code === "team_already_managed") {
      return t(
        "该球队已有其他经理。",
        "This team already has a manager.",
      );
    }
    if (code === "already_bound_to_team") {
      return t(
        "你已经绑定了一支球队，请先解绑。",
        "You are already bound to a team. Unbind first.",
      );
    }
    if (code === "forbidden") {
      return t(
        "你的角色不能绑定球队。",
        "Your role cannot bind a team.",
      );
    }
    if (code === "missing_team_id") return t("请选择球队。", "Pick a team.");
    if (code === "team_not_in_league" || code === "invalid_team_id") {
      return t("所选球队不属于本联赛。", "Team is not in this league.");
    }
    return code;
  };

  const submit = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/team-bind`,
      { method: "POST", body: JSON.stringify({ team_id: selectedId }) },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setErr(translateError((body as { error?: string }).error ?? `HTTP ${res.status}`));
      return;
    }
    onSubmitted();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 14,
          padding: 22,
          width: "min(560px, 100%)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            {t("绑定球队", "Bind Team")}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: 22,
              cursor: "pointer",
              color: "#64748b",
              lineHeight: 1,
            }}
            aria-label={t("关闭", "Close")}
          >
            ×
          </button>
        </div>
        <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
          {t(
            "选择一支尚未被认领的球队进行绑定。绑定后你将能编辑球队信息、添加/编辑/移除球员。每位经理仅可绑定一支球队。",
            "Pick an unmanaged team to bind. After binding you can edit the team info, add/edit/remove its players. Only one team per manager.",
          )}
        </p>
        {loading ? (
          <div style={{ color: "#64748b", padding: "20px 0" }}>
            {t("加载中…", "Loading…")}
          </div>
        ) : available.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: "20px 0", fontSize: 14 }}>
            {t("当前没有可绑定的球队。", "No unmanaged teams available.")}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              maxHeight: 320,
            }}
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {available.map((tm) => (
                <li key={tm.id}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "10px 12px",
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      background: selectedId === tm.id ? "#eff6ff" : "#fff",
                    }}
                  >
                    <input
                      type="radio"
                      name="team_bind_choice"
                      value={tm.id}
                      checked={selectedId === tm.id}
                      onChange={() => setSelectedId(tm.id)}
                    />
                    {tm.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={tm.logo_url}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          objectFit: "cover",
                          background: "#f1f5f9",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 6,
                          background: "#f1f5f9",
                          display: "inline-block",
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                        {tm.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {[tm.city, tm.abbreviation].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
        {err && (
          <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "#fff",
              border: "1px solid #cbd5e1",
              borderRadius: 8,
              fontWeight: 700,
              fontSize: 13,
              color: "#0f172a",
              cursor: "pointer",
            }}
          >
            {t("取消", "Cancel")}
          </button>
          <button
            onClick={submit}
            disabled={!selectedId || busy}
            style={{
              padding: "8px 16px",
              background: !selectedId || busy ? "#94a3b8" : "#1e3a8a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 13,
              cursor: !selectedId || busy ? "default" : "pointer",
            }}
          >
            {busy ? t("绑定中…", "Binding…") : t("绑定", "Bind")}
          </button>
        </div>
      </div>
    </div>
  );
}
