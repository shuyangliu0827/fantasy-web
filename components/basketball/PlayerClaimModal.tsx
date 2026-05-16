"use client";

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/lib/lang";
import { basketballFetch, basketballJson } from "@/lib/basketball/client";

type Player = {
  id: string;
  display_name: string;
  position: string | null;
  team_id: string | null;
  jersey_number: string | null;
  avatar_url: string | null;
  claim_status: "unclaimed" | "pending" | "approved" | "rejected";
  claimed_by_user_id: string | null;
  is_active: boolean;
};

type Team = { id: string; name: string };

type Props = {
  leagueId: string;
  onClose: () => void;
  onSubmitted: () => void;
};

type Mode = "create" | "claim";

const POSITION_OPTIONS = [
  "PG",
  "SG",
  "SF",
  "PF",
  "C",
  "PG/SG",
  "SG/SF",
  "SF/PF",
  "PF/C",
] as const;

export default function PlayerClaimModal({
  leagueId,
  onClose,
  onSubmitted,
}: Props) {
  const { t } = useLang();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("create");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // "create" form
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [teamId, setTeamId] = useState<string>("");
  const [jersey, setJersey] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [birthYear, setBirthYear] = useState("");

  // "claim" form
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [pRes, tRes] = await Promise.all([
        basketballJson<{ players: Player[] }>(
          `/api/basketball-leagues/${leagueId}/players`,
        ),
        basketballJson<{ teams: Team[] }>(
          `/api/basketball-leagues/${leagueId}/teams`,
        ),
      ]);
      if (cancelled) return;
      setPlayers(pRes.data?.players ?? []);
      setTeams(tRes.data?.teams ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  const unclaimed = useMemo(
    () =>
      players.filter(
        (p) => p.claim_status === "unclaimed" && p.is_active !== false,
      ),
    [players],
  );

  const teamName = (tid: string | null) =>
    tid ? teams.find((tm) => tm.id === tid)?.name ?? "" : "";

  const translateError = (code: string) => {
    if (code === "already_linked_in_league") {
      return t(
        "该账号已在本联赛绑定其他球员档案。",
        "This account already has a player profile linked in this league.",
      );
    }
    if (code === "player_already_claimed") {
      return t("该球员档案已被绑定。", "This player profile is already claimed.");
    }
    if (code === "not_a_league_member") {
      return t(
        "你不是本联赛的成员，无法绑定球员档案。",
        "You are not a member of this league.",
      );
    }
    if (code === "forbidden") {
      return t(
        "你的角色无权创建球员档案。",
        "Your role cannot create a player profile here.",
      );
    }
    if (code === "missing_display_name") return t("请填写球员名。", "Display name is required.");
    if (code === "missing_team_id") return t("请选择球队。", "Pick a team.");
    if (code === "missing_position") return t("请选择位置。", "Pick a position.");
    if (code === "invalid_position") return t("位置无效。", "Invalid position.");
    if (code === "invalid_team_id" || code === "team_not_in_league") {
      return t("所选球队不属于本联赛。", "The selected team is not in this league.");
    }
    return code;
  };

  const submitCreate = async () => {
    setErr(null);
    if (!name.trim()) {
      setErr(translateError("missing_display_name"));
      return;
    }
    if (!teamId) {
      setErr(translateError("missing_team_id"));
      return;
    }
    if (!position) {
      setErr(translateError("missing_position"));
      return;
    }
    setBusy(true);
    const heightCmNum = heightCm ? Number(heightCm) : undefined;
    const weightKgNum = weightKg ? Number(weightKg) : undefined;
    const birthYearNum = birthYear ? Number(birthYear) : undefined;
    const res = await basketballFetch(
      `/api/basketball-leagues/${leagueId}/players/self`,
      {
        method: "POST",
        body: JSON.stringify({
          display_name: name.trim(),
          team_id: teamId,
          position,
          jersey_number: jersey || undefined,
          height_cm: Number.isFinite(heightCmNum) ? heightCmNum : undefined,
          weight_kg: Number.isFinite(weightKgNum) ? weightKgNum : undefined,
          birth_year: Number.isFinite(birthYearNum) ? birthYearNum : undefined,
        }),
      },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = (body as { error?: string }).error ?? `HTTP ${res.status}`;
      setErr(translateError(code));
      return;
    }
    onSubmitted();
  };

  const submitClaim = async () => {
    if (!selectedId) return;
    setBusy(true);
    setErr(null);
    const res = await basketballFetch(
      `/api/basketball-players/${selectedId}/claim`,
      { method: "POST" },
    );
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const code = (body as { error?: string }).error ?? `HTTP ${res.status}`;
      setErr(translateError(code));
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
          width: "min(640px, 100%)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#0f172a" }}>
            {t("绑定球员档案", "Bind Player Profile")}
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

        <div
          style={{
            display: "flex",
            gap: 6,
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          {(["create", "claim"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setErr(null);
              }}
              style={{
                padding: "8px 14px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: mode === m ? 800 : 600,
                color: mode === m ? "#1e3a8a" : "#64748b",
                borderBottom:
                  mode === m ? "2px solid #1e3a8a" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {m === "create"
                ? t("新建球员档案", "Create New")
                : t("认领已有档案", "Claim Existing")}
            </button>
          ))}
        </div>

        {mode === "create" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
              {t(
                "在本联赛中创建你自己的球员档案，提交后将自动与你的账号绑定。每个联赛仅可绑定一个档案。",
                "Create your own player profile in this league. It will be automatically linked to your account. Only one profile per league.",
              )}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("球员名", "Display name")}
              style={inputStyle()}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                style={{ ...inputStyle(), flex: "1 1 120px" }}
              >
                <option value="">{t("位置", "Position")}</option>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                style={{ ...inputStyle(), flex: "2 1 200px" }}
              >
                <option value="">{t("选择球队", "Pick team")}</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
              <input
                value={jersey}
                onChange={(e) => setJersey(e.target.value)}
                placeholder={t("球衣号", "Jersey #")}
                style={{ ...inputStyle(), flex: "0 1 110px" }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder={t("身高 cm", "Height cm")}
                style={{ ...inputStyle(), flex: "1 1 120px" }}
              />
              <input
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder={t("体重 kg", "Weight kg")}
                style={{ ...inputStyle(), flex: "1 1 120px" }}
              />
              <input
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value)}
                type="number"
                inputMode="numeric"
                placeholder={t("出生年", "Birth year")}
                style={{ ...inputStyle(), flex: "1 1 130px" }}
              />
            </div>
          </div>
        )}

        {mode === "claim" && (
          <>
            <p style={{ margin: 0, color: "#475569", fontSize: 13, lineHeight: 1.5 }}>
              {t(
                "选择一个由管理员预创建的待认领档案。提交后将进入「待审核」状态。",
                "Pick a pre-created profile to claim. After submitting, your claim will be pending review.",
              )}
            </p>
            {loading ? (
              <div style={{ color: "#64748b", padding: "20px 0" }}>
                {t("加载中…", "Loading…")}
              </div>
            ) : unclaimed.length === 0 ? (
              <div style={{ color: "#94a3b8", padding: "20px 0", fontSize: 14 }}>
                {t(
                  "当前没有可认领的球员档案。",
                  "No unclaimed player profiles available.",
                )}
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
                  {unclaimed.map((p) => (
                    <li key={p.id}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          background: selectedId === p.id ? "#eff6ff" : "#fff",
                        }}
                      >
                        <input
                          type="radio"
                          name="player_claim_choice"
                          value={p.id}
                          checked={selectedId === p.id}
                          onChange={() => setSelectedId(p.id)}
                        />
                        {p.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.avatar_url}
                            alt=""
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              objectFit: "cover",
                              background: "#f1f5f9",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#f1f5f9",
                              display: "inline-block",
                            }}
                          />
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14 }}>
                            {p.display_name}
                            {p.jersey_number && (
                              <span
                                style={{
                                  color: "#1e3a8a",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  marginLeft: 6,
                                }}
                              >
                                #{p.jersey_number}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            {[p.position, teamName(p.team_id)]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </div>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {err && <div style={{ color: "#991b1b", fontSize: 13, fontWeight: 700 }}>{err}</div>}

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
          {mode === "create" ? (
            <button
              onClick={submitCreate}
              disabled={busy}
              style={primaryBtn(busy)}
            >
              {busy
                ? t("提交中…", "Submitting…")
                : t("创建并绑定", "Create + Bind")}
            </button>
          ) : (
            <button
              onClick={submitClaim}
              disabled={!selectedId || busy}
              style={primaryBtn(!selectedId || busy)}
            >
              {busy ? t("提交中…", "Submitting…") : t("申请绑定", "Submit Claim")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function inputStyle(): React.CSSProperties {
  return {
    minHeight: 40,
    padding: "0 12px",
    border: "1px solid #cbd5e1",
    borderRadius: 8,
    fontSize: 14,
    background: "#fff",
  };
}

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    background: disabled ? "#94a3b8" : "#1e3a8a",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontWeight: 800,
    fontSize: 13,
    cursor: disabled ? "default" : "pointer",
  };
}
