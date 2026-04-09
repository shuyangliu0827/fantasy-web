"use client";

import { useEffect, useMemo, useState } from "react";
import LightHeader from "@/components/LightHeader";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";
import {
  DAILY_CONTEST_TIER_COUNTS,
  type ContestPlayer,
  type ContestTier,
  scoreLineupProjection,
  validateTierSelections,
} from "@/lib/daily-contest";

const TIER_ORDER: ContestTier[] = ["T1", "T2", "T3", "T4"];

type ContestResponse = {
  id: string;
  contest_date: string;
  status: string;
  player_pool: ContestPlayer[];
};

export default function ContestPage() {
  const { t } = useLang();
  const [contest, setContest] = useState<ContestResponse | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  useEffect(() => {
    const u = getSessionUser();
    setUserId(u?.id ?? "");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const createRes = await fetch("/api/contests/create-today", { method: "POST" });
      const createPayload = await createRes.json();
      if (!cancelled && createPayload.status === "success") {
        setContest(createPayload.contest);
      }

      if (!cancelled && userId && createPayload?.contest?.contest_date) {
        const lineupRes = await fetch(`/api/contests/lineup?userId=${userId}&date=${createPayload.contest.contest_date}`);
        const lineupPayload = await lineupRes.json();
        if (lineupPayload.status === "success" && lineupPayload.lineup?.player_ids) {
          setSelectedIds(lineupPayload.lineup.player_ids);
        }
      }

      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const selectedPlayers = useMemo(() => {
    const byId = new Map((contest?.player_pool ?? []).map((p) => [p.id, p]));
    return selectedIds.map((id) => byId.get(id)).filter(Boolean) as ContestPlayer[];
  }, [contest?.player_pool, selectedIds]);

  const tierCounts = useMemo(() => {
    const counts: Record<ContestTier, number> = { T1: 0, T2: 0, T3: 0, T4: 0 };
    for (const player of selectedPlayers) counts[player.tier]++;
    return counts;
  }, [selectedPlayers]);

  const projected = useMemo(() => scoreLineupProjection(selectedIds, contest?.player_pool ?? []), [selectedIds, contest?.player_pool]);

  function togglePlayer(player: ContestPlayer) {
    const alreadySelected = selectedIds.includes(player.id);
    if (alreadySelected) {
      setSelectedIds((prev) => prev.filter((id) => id !== player.id));
      return;
    }

    const nextTierCount = tierCounts[player.tier] + 1;
    if (nextTierCount > DAILY_CONTEST_TIER_COUNTS[player.tier]) {
      setMessage(`${player.tier} ${t("名额已满", "slots already full")}`);
      return;
    }

    if (selectedIds.length >= 5) {
      setMessage(t("阵容已满（5人）", "Lineup is full (5 players)."));
      return;
    }

    setSelectedIds((prev) => [...prev, player.id]);
  }

  async function save(mode: "draft" | "submit") {
    if (!contest) return;
    if (!userId) {
      setMessage(t("请先登录", "Please log in first."));
      return;
    }

    const validation = validateTierSelections(selectedIds, contest.player_pool);
    if (!validation.ok) {
      setMessage(validation.error);
      return;
    }

    setSaving(true);
    setMessage("");

    const res = await fetch("/api/contests/lineup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        playerIds: selectedIds,
        mode,
        date: contest.contest_date,
      }),
    });

    const payload = await res.json();
    setSaving(false);

    if (payload.status === "success") {
      setMessage(mode === "submit" ? t("提交成功", "Lineup submitted.") : t("草稿已保存", "Draft saved."));
      return;
    }

    setMessage(payload.message || t("保存失败", "Save failed."));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <LightHeader activeHref="/contest" />

      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px 40px" }}>
        <section style={{ marginBottom: 20 }}>
          <p style={{ margin: 0, color: "#475569", fontSize: 13 }}>{t("每日挑战赛", "Daily Contest")}</p>
          <h1 style={{ margin: "6px 0 0", fontSize: 30 }}>{t("当日全局公开赛", "Global same-day public contest")}</h1>
          <p style={{ margin: "8px 0 0", color: "#64748b" }}>
            {t("规则：T1×1，T2×1，T3×1，T4×2（共5人）", "Rules: T1×1, T2×1, T3×1, T4×2 (5 players total).")}
          </p>
        </section>

        {loading || !contest ? (
          <div>{t("加载中...", "Loading...")}</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr minmax(280px, 320px)", gap: 16 }}>
            <section style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16 }}>
              <div style={{ marginBottom: 12, color: "#334155", fontSize: 14 }}>
                {t("比赛日期", "Contest Date")}: <strong>{contest.contest_date}</strong> · {t("球员池", "Pool")}: {contest.player_pool.length}
              </div>

              {TIER_ORDER.map((tier) => (
                <div key={tier} style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>
                    {tier} ({tierCounts[tier]}/{DAILY_CONTEST_TIER_COUNTS[tier]})
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8 }}>
                    {contest.player_pool
                      .filter((p) => p.tier === tier)
                      .map((p) => {
                        const selected = selectedIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            onClick={() => togglePlayer(p)}
                            style={{
                              textAlign: "left",
                              background: selected ? "#dbeafe" : "#fff",
                              border: selected ? "1px solid #2563eb" : "1px solid #e2e8f0",
                              borderRadius: 10,
                              padding: "10px 12px",
                              cursor: "pointer",
                            }}
                          >
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: "#64748b" }}>{p.team} · {p.position}</div>
                            <div style={{ fontSize: 12, color: "#0f172a", marginTop: 4 }}>FPTS/G {p.fptsAvg.toFixed(1)}</div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              ))}
            </section>

            <aside style={{ background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0", padding: 16, height: "fit-content" }}>
              <h2 style={{ marginTop: 0 }}>{t("我的阵容", "My Lineup")}</h2>
              <ul style={{ paddingLeft: 18 }}>
                {selectedPlayers.map((p) => (
                  <li key={p.id}>{p.tier} · {p.name} ({p.fptsAvg.toFixed(1)})</li>
                ))}
              </ul>
              <p style={{ margin: "8px 0" }}>{t("预估分", "Projected")}: <strong>{projected.toFixed(1)}</strong></p>
              {message && <p style={{ color: "#b91c1c", fontSize: 13 }}>{message}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => save("draft")} disabled={saving} className="btn btn-ghost">{t("保存草稿", "Save Draft")}</button>
                <button onClick={() => save("submit")} disabled={saving} className="btn btn-primary">{t("提交阵容", "Submit")}</button>
              </div>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
