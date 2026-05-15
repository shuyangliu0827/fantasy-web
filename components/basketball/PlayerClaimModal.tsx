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

export default function PlayerClaimModal({
  leagueId,
  onClose,
  onSubmitted,
}: Props) {
  const { t } = useLang();
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      if (pRes.error) {
        setErr(pRes.error);
      } else {
        setPlayers(pRes.data?.players ?? []);
      }
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

  const submit = async () => {
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
      if (code === "already_linked_in_league") {
        setErr(
          t(
            "该账号已在本联赛绑定其他球员档案。",
            "This account already has a player profile linked in this league.",
          ),
        );
      } else if (code === "player_already_claimed") {
        setErr(t("该球员档案已被绑定。", "This player profile is already claimed."));
      } else if (code === "not_a_league_member") {
        setErr(
          t(
            "你不是本联赛的成员，无法认领球员档案。",
            "You are not a member of this league.",
          ),
        );
      } else {
        setErr(code);
      }
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
            {t("认领球员档案", "Claim Player Profile")}
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
            "请选择一个待认领的球员档案。提交后将进入「待审核」状态，由联赛管理员审批。",
            "Pick an unclaimed player profile. After submitting, your claim will be pending review by a league admin.",
          )}
        </p>
        {loading ? (
          <div style={{ color: "#64748b", padding: "20px 0" }}>
            {t("加载中…", "Loading…")}
          </div>
        ) : unclaimed.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: "20px 0", fontSize: 14 }}>
            {t("当前没有可认领的球员档案。", "No unclaimed player profiles available.")}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
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
                        {[p.position, teamName(p.team_id)].filter(Boolean).join(" · ") || "—"}
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
            {busy ? t("提交中…", "Submitting…") : t("申请绑定", "Submit Claim")}
          </button>
        </div>
      </div>
    </div>
  );
}
