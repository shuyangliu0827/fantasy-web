"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";
import { uploadBasketballTeamLogo } from "@/lib/basketball/uploads";

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

type Mode = "bind" | "create";

export default function TeamBindModal({
  leagueId,
  onClose,
  onSubmitted,
}: Props) {
  const { t } = useLang();
  const [mode, setMode] = useState<Mode>("bind");

  const [teams, setTeams] = useState<Team[]>([]);
  const [boundTeamIds, setBoundTeamIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  // Create-mode fields
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [city, setCity] = useState("");
  const [bio, setBio] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
      return t("该球队已有其他经理。", "This team already has a manager.");
    }
    if (code === "already_bound_to_team") {
      return t(
        "你已经在本联赛管理了一支球队。",
        "You already manage a team in this league.",
      );
    }
    if (code === "forbidden") {
      return t("你的角色不能绑定球队。", "Your role cannot bind a team.");
    }
    if (code === "not_a_league_member") {
      return t("无权在该联赛创建球队。", "Not authorized in this league.");
    }
    if (code === "missing_team_id") return t("请选择球队。", "Pick a team.");
    if (code === "team_not_in_league" || code === "invalid_team_id") {
      return t("所选球队不属于本联赛。", "Team is not in this league.");
    }
    if (code === "missing_name") {
      return t("请填写球队名称。", "Team name is required.");
    }
    if (code === "duplicate_team_name") {
      return t("该名称在本联赛已被使用。", "Team name already used in this league.");
    }
    return code;
  };

  const submitBind = async () => {
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

  const submitCreate = async () => {
    if (!name.trim()) {
      setErr(t("请填写球队名称。", "Team name is required."));
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/teams/self`,
      {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          abbreviation: abbreviation.trim() || undefined,
          city: city.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      },
    );
    if (!res.ok) {
      setBusy(false);
      const body = await res.json().catch(() => ({}));
      setErr(translateError((body as { error?: string }).error ?? `HTTP ${res.status}`));
      return;
    }
    const created = (await res.json()) as { team?: { id: string } };
    // Best-effort logo upload — if it fails, the team still exists.
    if (logoFile && created.team?.id) {
      try {
        await uploadBasketballTeamLogo(leagueId, created.team.id, logoFile);
      } catch {
        /* ignore — bind succeeded */
      }
    }
    setBusy(false);
    onSubmitted();
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 13,
    color: "#0f172a",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
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
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            {t("加入球队", "Set up your team")}
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

        {/* Mode switcher */}
        <div
          role="tablist"
          style={{
            display: "inline-flex",
            background: "#f1f5f9",
            borderRadius: 999,
            padding: 4,
            alignSelf: "flex-start",
          }}
        >
          {(["bind", "create"] as const).map((m) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => {
                setMode(m);
                setErr(null);
              }}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 800,
                border: "none",
                borderRadius: 999,
                cursor: "pointer",
                background: mode === m ? "#1e3a8a" : "transparent",
                color: mode === m ? "#fff" : "#475569",
              }}
            >
              {m === "bind"
                ? t("绑定现有球队", "Bind existing")
                : t("创建我的球队", "Create new")}
            </button>
          ))}
        </div>

        <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
          {mode === "bind"
            ? t(
                "选择一支尚未被认领的球队进行绑定。绑定后你将能编辑球队信息、添加/编辑/移除球员。每位经理仅可绑定一支球队。",
                "Pick an unmanaged team to bind. After binding you can edit the team info, add/edit/remove its players. Only one team per manager.",
              )
            : t(
                "在本联赛创建一支属于你的球队。创建后你将自动成为该球队的经理。每位经理仅可拥有一支球队。",
                "Create a new team in this league. You will automatically become its manager. Only one team per manager.",
              )}
        </p>

        {mode === "bind" ? (
          loading ? (
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
                        <div
                          style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}
                        >
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
          )
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              maxHeight: 360,
              overflowY: "auto",
            }}
          >
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                {t("球队名称", "Team name")} *
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("例如：城南雄狮", "e.g. Southside Lions")}
                style={inputStyle}
                maxLength={60}
              />
            </label>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  flex: "1 1 160px",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                  {t("简称", "Abbreviation")}
                </span>
                <input
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  placeholder="SSL"
                  style={inputStyle}
                  maxLength={8}
                />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  flex: "1 1 160px",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                  {t("城市", "City")}
                </span>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("城市 / 地区", "City / region")}
                  style={inputStyle}
                  maxLength={60}
                />
              </label>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>
                {t("球队简介 (可选)", "Bio (optional)")}
              </span>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  fontFamily: "inherit",
                  minHeight: 60,
                }}
                maxLength={300}
              />
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: "#475569",
              }}
            >
              {t("队标 (可选)", "Logo (optional)")}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                style={{ fontSize: 12 }}
              />
            </label>
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
          {mode === "bind" ? (
            <button
              onClick={submitBind}
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
          ) : (
            <button
              onClick={submitCreate}
              disabled={!name.trim() || busy}
              style={{
                padding: "8px 16px",
                background: !name.trim() || busy ? "#94a3b8" : "#1e3a8a",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 13,
                cursor: !name.trim() || busy ? "default" : "pointer",
              }}
            >
              {busy ? t("创建中…", "Creating…") : t("创建并绑定", "Create & bind")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
