"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  updateLeagueBranding,
  updateLeagueRules,
  reshuffleDraftOrder,
  updateTeamDraftPositions,
  League,
  supabase,
} from "@/lib/store";
import { ESPN_DEFAULT_WEIGHTS, PointsWeights } from "@/lib/scoring-config";

// ─── Types ───────────────────────────────────────────────────────────────────

type PointsSystemKey = "espn_default" | "custom";
type ScoringTypeKey = "h2h_points" | "h2h_categories" | "rotisserie";

const SCORING_OPTIONS: { key: ScoringTypeKey; label: string; supported: boolean }[] = [
  { key: "h2h_points",     label: "H2H Points",     supported: true  },
  { key: "h2h_categories", label: "H2H Categories", supported: false },
  { key: "rotisserie",     label: "Rotisserie",      supported: false },
];

const ESPN_FORMULA_ROWS: { stat: string; label_zh: string; label_en: string; value: number }[] = [
  { stat: "pts",  label_zh: "得分",     label_en: "Points",          value: ESPN_DEFAULT_WEIGHTS.pts  },
  { stat: "fg3m", label_zh: "三分命中", label_en: "3-Pointers Made", value: ESPN_DEFAULT_WEIGHTS.fg3m },
  { stat: "fga",  label_zh: "投篮出手", label_en: "FG Attempts",     value: ESPN_DEFAULT_WEIGHTS.fga  },
  { stat: "fgm",  label_zh: "投篮命中", label_en: "FG Made",         value: ESPN_DEFAULT_WEIGHTS.fgm  },
  { stat: "fta",  label_zh: "罚球出手", label_en: "FT Attempts",     value: ESPN_DEFAULT_WEIGHTS.fta  },
  { stat: "ftm",  label_zh: "罚球命中", label_en: "FT Made",         value: ESPN_DEFAULT_WEIGHTS.ftm  },
  { stat: "reb",  label_zh: "篮板",     label_en: "Rebounds",        value: ESPN_DEFAULT_WEIGHTS.reb  },
  { stat: "ast",  label_zh: "助攻",     label_en: "Assists",         value: ESPN_DEFAULT_WEIGHTS.ast  },
  { stat: "stl",  label_zh: "抢断",     label_en: "Steals",          value: ESPN_DEFAULT_WEIGHTS.stl  },
  { stat: "blk",  label_zh: "盖帽",     label_en: "Blocks",          value: ESPN_DEFAULT_WEIGHTS.blk  },
  { stat: "tov",  label_zh: "失误",     label_en: "Turnovers",       value: ESPN_DEFAULT_WEIGHTS.tov  },
];

type DraftTeam = { id: string; name: string; user_id: string; draft_position: number };

// ─── Component ───────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useLang();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [user, setUser]       = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague]   = useState<League | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Branding state
  const [name, setName]               = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl]         = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [savingBranding, setSavingBranding] = useState(false);
  const [uploadingLogo, setUploadingLogo]   = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  // ── Rules state
  const [scoringType, setScoringType]       = useState<ScoringTypeKey>("h2h_points");
  const [pointsSystem, setPointsSystem]     = useState<PointsSystemKey>("espn_default");
  const [customWeights, setCustomWeights]   = useState<PointsWeights>({ ...ESPN_DEFAULT_WEIGHTS });
  const [draftType, setDraftType]           = useState("snake");
  const [maxTeams, setMaxTeams]             = useState(10);
  const [visibility, setVisibility]         = useState<"public" | "private">("public");
  const [savingRules, setSavingRules]       = useState(false);

  // ── Draft order state
  const [draftTeams, setDraftTeams]                 = useState<DraftTeam[]>([]);
  const [draftPositionInputs, setDraftPositionInputs] = useState<Record<string, number>>({});
  const [savingDraftOrder, setSavingDraftOrder]     = useState(false);
  const [reshuffling, setReshuffling]               = useState(false);

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      // Branding
      setName(leagueData.name);
      setDescription(leagueData.description || "");
      setLogoUrl(leagueData.logo_url || "");
      if (leagueData.logo_url) setLogoPreview(leagueData.logo_url);
      // Rules
      setScoringType((leagueData.scoring_type as ScoringTypeKey) || "h2h_points");
      setPointsSystem((leagueData.points_system as PointsSystemKey) || "espn_default");
      if (leagueData.points_weights) {
        setCustomWeights({ ...ESPN_DEFAULT_WEIGHTS, ...leagueData.points_weights } as PointsWeights);
      }
      setDraftType(leagueData.draft_type || "snake");
      setMaxTeams(leagueData.max_teams || 10);
      setVisibility(leagueData.visibility || "public");

      // 加载 fantasy_teams 用于选秀顺位管理
      const { data: teams } = await supabase
        .from("fantasy_teams")
        .select("id, name, user_id, draft_position")
        .eq("league_id", leagueData.id)
        .order("draft_position", { ascending: true });
      if (teams) {
        setDraftTeams(teams as DraftTeam[]);
        const inputs: Record<string, number> = {};
        for (const t of teams) inputs[t.id] = t.draft_position ?? 0;
        setDraftPositionInputs(inputs);
      }
    }
    setLoading(false);
  }

  // ── Logo file upload
  async function handleLogoFile(file: File) {
    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingLogo(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `league-logos/${league!.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("league-logos")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("league-logos")
        .getPublicUrl(path);

      setLogoUrl(urlData.publicUrl);
    } catch (err: any) {
      alert(t(`Logo上传失败: ${err?.message}`, `Logo upload failed: ${err?.message}`));
    } finally {
      setUploadingLogo(false);
    }
  }

  // ── Save branding
  async function handleSaveBranding() {
    if (!league) return;
    setSavingBranding(true);
    const result = await updateLeagueBranding(league.id, {
      name: name.trim(),
      description: description.trim(),
      logo_url: logoUrl || undefined,
    });
    if (result.ok) {
      setLeague({ ...league, name: name.trim(), description: description.trim(), logo_url: logoUrl || undefined });
      alert(t("品牌信息已保存！", "Branding saved!"));
    } else {
      alert(t(`保存失败: ${result.error}`, `Save failed: ${result.error}`));
    }
    setSavingBranding(false);
  }

  // ── Save rules
  async function handleSaveRules() {
    if (!league) return;
    setSavingRules(true);
    const result = await updateLeagueRules(league.id, {
      scoring_type: scoringType,
      points_system: scoringType === "h2h_points" ? pointsSystem : null,
      points_weights:
        scoringType === "h2h_points" && pointsSystem === "custom" ? customWeights : null,
      draft_type: draftType,
      max_teams: maxTeams,
      visibility,
    });
    if (result.ok) {
      setLeague({
        ...league,
        scoring_type: scoringType,
        points_system: scoringType === "h2h_points" ? pointsSystem : null,
        draft_type: draftType,
        max_teams: maxTeams,
        visibility,
      });
      alert(t("赛制设置已保存！", "Competition rules saved!"));
    } else {
      alert(t(`保存失败: ${result.error}`, `Save failed: ${result.error}`));
    }
    setSavingRules(false);
  }

  // ── 重新随机分配顺位
  async function handleReshuffle() {
    if (!league) return;
    if (!confirm(t("确定重新随机分配所有人的选秀顺位吗？", "Randomly reassign all draft positions?"))) return;
    setReshuffling(true);
    const result = await reshuffleDraftOrder(league.id);
    if (result.ok) {
      const { data: teams } = await supabase
        .from("fantasy_teams")
        .select("id, name, user_id, draft_position")
        .eq("league_id", league.id)
        .order("draft_position", { ascending: true });
      if (teams) {
        setDraftTeams(teams as DraftTeam[]);
        const inputs: Record<string, number> = {};
        for (const t of teams) inputs[t.id] = t.draft_position ?? 0;
        setDraftPositionInputs(inputs);
      }
      alert(t("顺位已随机重排！", "Draft order reshuffled!"));
    } else {
      alert(t("操作失败", "Failed"));
    }
    setReshuffling(false);
  }

  // ── 保存盟主手动调整的顺位
  async function handleSaveDraftOrder() {
    if (!league) return;
    const n = draftTeams.length;
    if (n === 0) return;

    const updates = draftTeams.map((t) => ({
      teamId: t.id,
      position: draftPositionInputs[t.id] ?? t.draft_position,
    }));

    // 前端校验
    const positions = updates.map((u) => u.position);
    if (positions.some((p) => !Number.isInteger(p) || p < 1 || p > n)) {
      alert(t(`顺位必须在 1 到 ${n} 之间`, `Positions must be between 1 and ${n}`));
      return;
    }
    if (new Set(positions).size !== n) {
      alert(t("顺位不能重复，请检查后重新保存", "Duplicate positions detected, please fix and save again"));
      return;
    }

    setSavingDraftOrder(true);
    const result = await updateTeamDraftPositions(league.id, updates);
    if (result.ok) {
      // 重新排列本地显示顺序
      const sorted = [...draftTeams].sort(
        (a, b) => (draftPositionInputs[a.id] ?? a.draft_position) - (draftPositionInputs[b.id] ?? b.draft_position)
      );
      setDraftTeams(sorted);
      alert(t("选秀顺位已保存！", "Draft order saved!"));
    } else {
      alert(t(`保存失败: ${result.error}`, `Save failed: ${result.error}`));
    }
    setSavingDraftOrder(false);
  }

  // ── Delete league
  async function handleDelete() {
    if (!league) return;
    if (!confirm(t(`确定要删除联赛 "${league.name}" 吗？此操作不可恢复。`, `Delete "${league.name}"? This cannot be undone.`))) return;
    const { error } = await supabase.from("leagues").delete().eq("id", league.id);
    if (!error) {
      router.push("/league");
    } else {
      alert(t("删除失败", "Failed to delete"));
    }
  }

  const isOwner    = !!(user && league && league.commissioner_id === user.id);
  const rulesLocked = !!(league && league.status !== "draft_pending");

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="loading-container"><p>{t("加载中...", "Loading...")}</p></div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  if (!league || !isOwner) {
    return (
      <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
        <LightHeader activeHref="/league" />
        <div className="error-container">
          <h2>{t("无权访问", "Access Denied")}</h2>
          <Link href={`/league/${slug}`} className="back-link">{t("返回联赛", "Back")}</Link>
        </div>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="app" style={{ minHeight: "100vh", background: "#f9fafb" }}>
      <LightHeader activeHref="/league" />

      <div className="league-header-mini">
        <div className="league-header-inner">
          <Link href={`/league/${slug}`} className="league-title">
            {logoPreview
              ? <img src={logoPreview} alt="" className="league-logo-sm" />
              : <span className="league-icon">🏀</span>}
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <h1>{t("联赛设置", "League Settings")}</h1>

          {/* ── Section 1: League Branding ── */}
          <div className="settings-section">
            <h2>{t("联赛品牌", "League Branding")}</h2>
            <p className="section-hint">{t("品牌信息随时可修改。", "Branding can be updated at any time.")}</p>

            <div className="form-group">
              <label>{t("联赛名称", "League Name")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder={t("输入联赛名称", "Enter league name")}
              />
            </div>

            <div className="form-group">
              <label>{t("联赛描述", "Description")}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder={t("简单介绍你的联赛（可选）", "Brief description (optional)")}
              />
            </div>

            <div className="form-group">
              <label>{t("联赛徽标", "League Logo")}</label>
              <div className="logo-upload-row">
                {logoPreview && (
                  <img src={logoPreview} alt="Logo preview" className="logo-preview" />
                )}
                <div className="logo-upload-controls">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleLogoFile(file);
                    }}
                  />
                  <button
                    className="upload-btn"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo
                      ? t("上传中...", "Uploading...")
                      : t("上传图片", "Upload Image")}
                  </button>
                  <span className="logo-or">{t("或", "or")}</span>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => {
                      setLogoUrl(e.target.value);
                      setLogoPreview(e.target.value || null);
                    }}
                    placeholder={t("粘贴图片 URL", "Paste image URL")}
                    className="logo-url-input"
                  />
                </div>
              </div>
            </div>

            <div className="actions-bar">
              <button className="save-btn" onClick={handleSaveBranding} disabled={savingBranding || uploadingLogo}>
                {savingBranding ? t("保存中...", "Saving...") : t("保存品牌信息", "Save Branding")}
              </button>
            </div>
          </div>

          {/* ── Section 2: Competition Rules ── */}
          <div className="settings-section">
            <h2>{t("赛制规则", "Competition Rules")}</h2>

            {rulesLocked ? (
              <div className="rules-locked-banner">
                <span className="lock-icon">🔒</span>
                <div>
                  <div className="lock-title">{t("规则已锁定", "Rules Locked")}</div>
                  <div className="lock-desc">
                    {t(
                      "选秀开始后，赛制规则将锁定以保证公平性，无法再次修改。",
                      "Competition rules are locked once the draft starts to ensure fairness."
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className="section-hint">
                {t("赛制规则在选秀开始后将锁定。", "These rules will lock once the draft starts.")}
              </p>
            )}

            {/* Scoring Type */}
            <div className="form-group">
              <label>{t("计分类型", "Scoring Type")}</label>
              <div className="scoring-type-grid">
                {SCORING_OPTIONS.map((opt) => (
                  <div
                    key={opt.key}
                    className={[
                      "scoring-type-card",
                      !opt.supported ? "disabled" : "",
                      scoringType === opt.key && opt.supported ? "selected" : "",
                    ].join(" ")}
                    onClick={() => {
                      if (opt.supported && !rulesLocked) setScoringType(opt.key);
                    }}
                    aria-disabled={!opt.supported || rulesLocked}
                  >
                    <span className="scoring-card-label">{opt.label}</span>
                    {!opt.supported && (
                      <span className="coming-soon-badge">{t("即将上线", "Coming Soon")}</span>
                    )}
                    {opt.supported && scoringType === opt.key && (
                      <span className="selected-check">✓</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Points System — only for H2H Points */}
            {scoringType === "h2h_points" && (
              <div className="form-group subsection">
                <label>{t("积分方案", "Points System")}</label>
                <div className="radio-group">
                  <label className={`radio-option ${pointsSystem === "espn_default" && !rulesLocked ? "selected" : pointsSystem === "espn_default" ? "selected locked" : ""}`}>
                    <input
                      type="radio"
                      checked={pointsSystem === "espn_default"}
                      onChange={() => { if (!rulesLocked) setPointsSystem("espn_default"); }}
                      disabled={rulesLocked}
                    />
                    ESPN Default
                  </label>
                  <label className={`radio-option ${pointsSystem === "custom" && !rulesLocked ? "selected" : pointsSystem === "custom" ? "selected locked" : ""}`}>
                    <input
                      type="radio"
                      checked={pointsSystem === "custom"}
                      onChange={() => { if (!rulesLocked) setPointsSystem("custom"); }}
                      disabled={rulesLocked}
                    />
                    {t("自定义", "Custom")}
                  </label>
                </div>

                {/* ESPN Default: read-only formula */}
                {pointsSystem === "espn_default" && (
                  <div className="formula-table">
                    <div className="formula-header">
                      <span>{t("数据项", "Stat")}</span>
                      <span>{t("每次得分", "Pts / Occurrence")}</span>
                    </div>
                    {ESPN_FORMULA_ROWS.map((row) => (
                      <div key={row.stat} className="formula-row">
                        <span>{t(row.label_zh, row.label_en)}</span>
                        <span className={`formula-value ${row.value < 0 ? "negative" : ""}`}>
                          {row.value > 0 ? `+${row.value}` : row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Custom: editable inputs */}
                {pointsSystem === "custom" && (
                  <div className="custom-weights">
                    {ESPN_FORMULA_ROWS.map((row) => (
                      <div key={row.stat} className="weight-row">
                        <label>{t(row.label_zh, row.label_en)}</label>
                        <input
                          type="number"
                          step="0.5"
                          value={customWeights[row.stat as keyof PointsWeights]}
                          onChange={(e) => {
                            if (rulesLocked) return;
                            setCustomWeights((prev) => ({
                              ...prev,
                              [row.stat]: parseFloat(e.target.value) || 0,
                            }));
                          }}
                          disabled={rulesLocked}
                          className="weight-input"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Draft Type */}
            <div className="form-group">
              <label>{t("选秀类型", "Draft Type")}</label>
              <select
                value={draftType}
                onChange={(e) => setDraftType(e.target.value)}
                disabled={rulesLocked}
              >
                <option value="snake">{t("蛇形选秀", "Snake")}</option>
                <option value="auction">{t("拍卖选秀", "Auction")}</option>
                <option value="autopick">{t("自动选秀", "Autopick")}</option>
              </select>
            </div>

            {/* Team Count */}
            <div className="form-group">
              <label>{t("队伍数量上限", "Team Count Limit")}</label>
              <select
                value={maxTeams}
                onChange={(e) => setMaxTeams(Number(e.target.value))}
                disabled={rulesLocked}
              >
                {[4, 6, 8, 10, 12, 14, 16, 18, 20].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Visibility */}
            <div className="form-group">
              <label>{t("可见性", "Visibility")}</label>
              <div className="radio-group">
                <label className={`radio-option ${visibility === "public" ? "selected" : ""} ${rulesLocked ? "locked" : ""}`}>
                  <input
                    type="radio"
                    checked={visibility === "public"}
                    onChange={() => { if (!rulesLocked) setVisibility("public"); }}
                    disabled={rulesLocked}
                  />
                  {t("公开", "Public")}
                </label>
                <label className={`radio-option ${visibility === "private" ? "selected" : ""} ${rulesLocked ? "locked" : ""}`}>
                  <input
                    type="radio"
                    checked={visibility === "private"}
                    onChange={() => { if (!rulesLocked) setVisibility("private"); }}
                    disabled={rulesLocked}
                  />
                  {t("私密", "Private")}
                </label>
              </div>
            </div>

            {!rulesLocked && (
              <div className="actions-bar">
                <button className="save-btn" onClick={handleSaveRules} disabled={savingRules}>
                  {savingRules ? t("保存中...", "Saving...") : t("保存赛制规则", "Save Rules")}
                </button>
              </div>
            )}
          </div>

          {/* ── Section 3: Draft Order ── */}
          <div className="settings-section">
            <h2>{t("选秀顺位", "Draft Order")}</h2>

            {rulesLocked ? (
              <div className="rules-locked-banner">
                <span className="lock-icon">🔒</span>
                <div>
                  <div className="lock-title">{t("顺位已锁定", "Draft Order Locked")}</div>
                  <div className="lock-desc">
                    {t("选秀开始后，顺位将锁定，无法再修改。", "Draft order is locked once the draft starts.")}
                  </div>
                </div>
              </div>
            ) : (
              <p className="section-hint">
                {t(
                  "可手动调整每位成员的选秀顺位，或点击【重新随机分配】重新洗牌。选秀开始后顺位将自动锁定。",
                  "Manually adjust each member's draft position, or click Reshuffle to randomize. Locks when draft starts."
                )}
              </p>
            )}

            {draftTeams.length === 0 ? (
              <p className="section-hint">{t("暂无成员，等待队员加入后顺位将自动分配。", "No members yet. Positions will be assigned when members join.")}</p>
            ) : (
              <>
                <div className="draft-order-list">
                  {[...draftTeams]
                    .sort((a, b) => (draftPositionInputs[a.id] ?? a.draft_position) - (draftPositionInputs[b.id] ?? b.draft_position))
                    .map((team) => (
                      <div key={team.id} className="draft-order-row">
                        <span className="draft-order-name">{team.name}</span>
                        <div className="draft-order-input-wrap">
                          <span className="draft-order-hash">#</span>
                          <input
                            type="number"
                            min={1}
                            max={draftTeams.length}
                            value={draftPositionInputs[team.id] ?? team.draft_position}
                            disabled={rulesLocked}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              if (!isNaN(val)) {
                                setDraftPositionInputs((prev) => ({ ...prev, [team.id]: val }));
                              }
                            }}
                            className="draft-order-input"
                          />
                        </div>
                      </div>
                    ))}
                </div>

                {!rulesLocked && (
                  <div className="actions-bar draft-order-actions">
                    <button
                      className="reshuffle-btn"
                      onClick={handleReshuffle}
                      disabled={reshuffling || savingDraftOrder}
                    >
                      {reshuffling ? t("随机中...", "Shuffling...") : t("重新随机分配", "Reshuffle")}
                    </button>
                    <button
                      className="save-btn"
                      onClick={handleSaveDraftOrder}
                      disabled={savingDraftOrder || reshuffling}
                    >
                      {savingDraftOrder ? t("保存中...", "Saving...") : t("保存顺位", "Save Order")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Section 4: Danger Zone ── */}
          <div className="danger-zone">
            <h2>⚠ {t("危险区域", "Danger Zone")}</h2>
            <p>{t("删除联赛将永久移除所有相关数据，此操作不可恢复。", "Deleting the league permanently removes all data. This cannot be undone.")}</p>
            <button className="delete-btn" onClick={handleDelete}>
              {t("删除联赛", "Delete League")}
            </button>
          </div>
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = `
  .league-header-mini { background: #1e3a8a; border-bottom: none; }
  .league-header-inner { max-width: 1200px; margin: 0 auto; padding: 16px; }
  .league-title { display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; font-size: 20px; font-weight: 600; }
  .league-icon { font-size: 28px; }
  .league-logo-sm { width: 36px; height: 36px; border-radius: 8px; object-fit: cover; }

  .page-content { min-height: calc(100vh - 200px); background: #f9fafb; padding: 24px 16px; }
  .container { max-width: 700px; margin: 0 auto; }
  h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 24px 0; }

  .settings-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .settings-section h2 { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 6px 0; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
  .section-hint { font-size: 13px; color: #6b7280; margin: 0 0 20px 0; }

  .form-group { margin-bottom: 20px; }
  .form-group > label { display: block; font-size: 14px; font-weight: 500; color: #374151; margin-bottom: 8px; }
  .form-group input[type="text"],
  .form-group input[type="url"],
  .form-group textarea,
  .form-group select {
    width: 100%; padding: 10px 14px; background: #f9fafb;
    border: 1px solid #e5e7eb; border-radius: 8px; color: #111827; font-size: 14px; box-sizing: border-box;
  }
  .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #1e3a8a; }
  .form-group input:disabled, .form-group textarea:disabled, .form-group select:disabled {
    background: #f3f4f6; color: #9ca3af; cursor: not-allowed;
  }

  .subsection { padding-left: 16px; border-left: 3px solid #e5e7eb; }

  /* Logo upload */
  .logo-upload-row { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .logo-preview { width: 64px; height: 64px; border-radius: 10px; object-fit: cover; border: 1px solid #e5e7eb; }
  .logo-upload-controls { display: flex; align-items: center; gap: 10px; flex: 1; flex-wrap: wrap; }
  .upload-btn {
    padding: 8px 16px; background: #fff; border: 1px solid #d1d5db;
    border-radius: 8px; font-size: 13px; color: #374151; cursor: pointer; white-space: nowrap;
  }
  .upload-btn:hover { background: #f9fafb; }
  .upload-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .logo-or { font-size: 13px; color: #9ca3af; }
  .logo-url-input { flex: 1; min-width: 160px; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; font-size: 13px; color: #111827; }

  /* Rules locked banner */
  .rules-locked-banner {
    display: flex; align-items: flex-start; gap: 12px;
    background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px;
    padding: 14px 16px; margin-bottom: 20px;
  }
  .lock-icon { font-size: 20px; }
  .lock-title { font-size: 14px; font-weight: 600; color: #92400e; margin-bottom: 2px; }
  .lock-desc { font-size: 13px; color: #78350f; }

  /* Scoring type cards */
  .scoring-type-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .scoring-type-card {
    position: relative; padding: 14px; background: #f9fafb; border: 2px solid #e5e7eb;
    border-radius: 10px; cursor: pointer; text-align: center; transition: border-color 0.15s;
  }
  .scoring-type-card.selected { border-color: #1e3a8a; background: #eff6ff; }
  .scoring-type-card.disabled { cursor: not-allowed; opacity: 0.55; }
  .scoring-card-label { font-size: 13px; font-weight: 600; color: #111827; display: block; }
  .coming-soon-badge {
    display: inline-block; margin-top: 6px; padding: 2px 8px;
    background: #f3f4f6; border-radius: 20px; font-size: 11px; color: #6b7280;
  }
  .selected-check { position: absolute; top: 6px; right: 8px; color: #1e3a8a; font-size: 14px; font-weight: 700; }

  /* Radio group */
  .radio-group { display: flex; gap: 12px; }
  .radio-option {
    flex: 1; display: flex; align-items: center; gap: 10px;
    padding: 12px 16px; background: #f9fafb; border: 2px solid #e5e7eb;
    border-radius: 10px; cursor: pointer; font-size: 14px; color: #374151;
  }
  .radio-option.selected { border-color: #1e3a8a; background: #eff6ff; }
  .radio-option.locked { cursor: not-allowed; opacity: 0.7; }
  .radio-option input { display: none; }

  /* Formula table (ESPN Default read-only) */
  .formula-table { margin-top: 12px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  .formula-header {
    display: flex; justify-content: space-between; padding: 8px 14px;
    background: #f3f4f6; font-size: 12px; font-weight: 600; color: #6b7280;
  }
  .formula-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 8px 14px; border-top: 1px solid #f3f4f6; font-size: 14px; color: #374151;
  }
  .formula-value { font-weight: 700; color: #1e3a8a; }
  .formula-value.negative { color: #ef4444; }

  /* Custom weights */
  .custom-weights { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
  .weight-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .weight-row label { font-size: 14px; color: #374151; min-width: 100px; }
  .weight-input { width: 80px; padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; text-align: center; background: #f9fafb; }
  .weight-input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }

  /* Actions */
  .actions-bar { display: flex; justify-content: flex-end; margin-top: 8px; }
  .save-btn {
    padding: 12px 28px; background: #1e3a8a; border: none; border-radius: 8px;
    color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .save-btn:hover { background: #1e40af; }
  .save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  /* Danger zone */
  .danger-zone {
    padding: 24px; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: 12px; margin-bottom: 40px;
  }
  .danger-zone h2 { font-size: 15px; font-weight: 600; color: #ef4444; margin: 0 0 8px 0; }
  .danger-zone p { font-size: 13px; color: #6b7280; margin: 0 0 16px 0; }
  .delete-btn {
    padding: 10px 22px; background: transparent; border: 1px solid #ef4444;
    border-radius: 8px; color: #ef4444; font-size: 14px; cursor: pointer;
  }
  .delete-btn:hover { background: #ef4444; color: #fff; }

  /* Loading / error */
  .loading-container, .error-container {
    min-height: 50vh; display: flex; flex-direction: column;
    align-items: center; justify-content: center; color: #6b7280;
  }
  .error-container h2 { color: #111827; margin-bottom: 16px; }
  .back-link { color: #1e3a8a; }

  /* Draft order */
  .draft-order-list { display: flex; flex-direction: column; gap: 8px; margin: 12px 0; }
  .draft-order-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 14px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px;
  }
  .draft-order-name { font-size: 14px; font-weight: 500; color: #374151; flex: 1; }
  .draft-order-input-wrap { display: flex; align-items: center; gap: 4px; }
  .draft-order-hash { font-size: 14px; font-weight: 700; color: #6b7280; }
  .draft-order-input {
    width: 56px; padding: 6px 8px; text-align: center;
    border: 1px solid #e5e7eb; border-radius: 6px; font-size: 14px; font-weight: 600;
    color: #1e3a8a; background: #fff;
  }
  .draft-order-input:focus { outline: none; border-color: #1e3a8a; }
  .draft-order-input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
  .draft-order-actions { justify-content: flex-end; gap: 10px; margin-top: 4px; }
  .reshuffle-btn {
    padding: 12px 22px; background: #fff; border: 1px solid #1e3a8a;
    border-radius: 8px; color: #1e3a8a; font-size: 14px; font-weight: 600; cursor: pointer;
  }
  .reshuffle-btn:hover { background: #eff6ff; }
  .reshuffle-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  @media (max-width: 600px) {
    .scoring-type-grid { grid-template-columns: 1fr; }
    .logo-upload-controls { flex-direction: column; align-items: flex-start; }
  }
`;
