"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import LightHeader from "@/components/LightHeader";
import LeagueNav from "@/components/LeagueNav";
import { useLang } from "@/lib/lang";
import {
  getSessionUser,
  getLeagueBySlug,
  getLeagueMembers,
  League,
  LeagueMember,
  supabase,
} from "@/lib/store";

export default function SettingsPage() {
  const { t } = useLang();
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [maxTeams, setMaxTeams] = useState(10);
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [scoringType, setScoringType] = useState("head_to_head_categories");
  const [draftType, setDraftType] = useState("snake");

  useEffect(() => {
    setUser(getSessionUser());
    loadData();
  }, [slug]);

  async function loadData() {
    const leagueData = await getLeagueBySlug(slug);
    if (leagueData) {
      setLeague(leagueData);
      setName(leagueData.name);
      setDescription((leagueData as any).description || "");
      setMaxTeams((leagueData as any).max_teams || 10);
      setVisibility(leagueData.visibility);
      setScoringType((leagueData as any).scoring_type || "head_to_head_categories");
      setDraftType((leagueData as any).draft_type || "snake");
    }
    setLoading(false);
  }

  async function handleSave() {
    if (!league) return;
    setSaving(true);

    const { error } = await supabase
      .from("leagues")
      .update({
        name,
        description,
        max_teams: maxTeams,
        visibility,
        scoring_type: scoringType,
        draft_type: draftType,
      })
      .eq("id", league.id);

    if (!error) {
      alert(t("保存成功！", "Settings saved!"));
    } else {
      alert(t("保存失败", "Failed to save"));
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!league) return;
    if (!confirm(t(`确定要删除联赛 "${league.name}" 吗？`, `Delete "${league.name}"?`))) return;

    const { error } = await supabase.from("leagues").delete().eq("id", league.id);
    if (!error) {
      router.push("/league");
    } else {
      alert(t("删除失败", "Failed to delete"));
    }
  }

  const isOwner = user && league && league.commissioner_id === user.id;

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
            <span className="league-icon">🏆</span>
            <span>{league.name}</span>
          </Link>
        </div>
      </div>

      <LeagueNav slug={slug} isOwner={!!isOwner} leagueId={league.id} />

      <main className="page-content">
        <div className="container">
          <h1>{t("联赛设置", "League Settings")}</h1>

          <div className="settings-section">
            <h2>{t("基本设置", "Basic Settings")}</h2>
            
            <div className="form-group">
              <label>{t("联赛名称", "League Name")}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} />
            </div>

            <div className="form-group">
              <label>{t("联赛描述", "Description")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
            </div>

            <div className="form-group">
              <label>{t("队伍数量上限", "Max Teams")}</label>
              <select value={maxTeams} onChange={(e) => setMaxTeams(Number(e.target.value))}>
                {[4, 6, 8, 10, 12, 14, 16, 18, 20].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>{t("可见性", "Visibility")}</label>
              <div className="radio-group">
                <label className={`radio-option ${visibility === "public" ? "selected" : ""}`}>
                  <input type="radio" checked={visibility === "public"} onChange={() => setVisibility("public")} />
                  🌍 {t("公开", "Public")}
                </label>
                <label className={`radio-option ${visibility === "private" ? "selected" : ""}`}>
                  <input type="radio" checked={visibility === "private"} onChange={() => setVisibility("private")} />
                  🔒 {t("私密", "Private")}
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h2>{t("计分设置", "Scoring")}</h2>
            <div className="form-group">
              <label>{t("计分类型", "Scoring Type")}</label>
              <select value={scoringType} onChange={(e) => setScoringType(e.target.value)}>
                <option value="head_to_head_categories">H2H Categories</option>
                <option value="head_to_head_points">H2H Points</option>
                <option value="rotisserie">Rotisserie</option>
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h2>{t("选秀设置", "Draft")}</h2>
            <div className="form-group">
              <label>{t("选秀类型", "Draft Type")}</label>
              <select value={draftType} onChange={(e) => setDraftType(e.target.value)}>
                <option value="snake">{t("蛇形选秀", "Snake")}</option>
                <option value="auction">{t("拍卖选秀", "Auction")}</option>
                <option value="autopick">{t("自动选秀", "Autopick")}</option>
              </select>
            </div>
          </div>

          <div className="actions-bar">
            <button className="save-btn" onClick={handleSave} disabled={saving}>
              {saving ? t("保存中...", "Saving...") : t("保存设置", "Save")}
            </button>
          </div>

          <div className="danger-zone">
            <h2>⚠️ {t("危险区域", "Danger Zone")}</h2>
            <p>{t("删除联赛将永久移除所有数据", "Deleting removes all data permanently")}</p>
            <button className="delete-btn" onClick={handleDelete}>🗑️ {t("删除联赛", "Delete League")}</button>
          </div>
        </div>
      </main>

      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .league-header-mini {
    background: #1e3a8a;
    border-bottom: none;
  }
  .league-header-inner { max-width: 1200px; margin: 0 auto; padding: 16px; }
  .league-title { display: flex; align-items: center; gap: 12px; color: #fff; text-decoration: none; font-size: 20px; font-weight: 600; }
  .league-icon { font-size: 28px; }
  .league-nav { background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 60px; z-index: 40; }
  .league-nav-inner { max-width: 1200px; margin: 0 auto; display: flex; gap: 4px; padding: 0 16px; overflow-x: auto; }
  .league-nav-link { display: flex; align-items: center; gap: 6px; padding: 14px 16px; color: #6b7280; text-decoration: none; font-size: 14px; border-bottom: 2px solid transparent; white-space: nowrap; }
  .league-nav-link:hover { color: #111827; }
  .league-nav-link.active { color: #1e3a8a; border-bottom-color: #1e3a8a; }
  .page-content { min-height: calc(100vh - 200px); background: #f9fafb; padding: 24px 16px; }
  .container { max-width: 700px; margin: 0 auto; }
  h1 { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 24px 0; }
  .settings-section { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin-bottom: 20px; }
  .settings-section h2 { font-size: 16px; font-weight: 600; color: #111827; margin: 0 0 20px 0; padding-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
  .form-group { margin-bottom: 20px; }
  .form-group label { display: block; font-size: 14px; color: #374151; margin-bottom: 8px; }
  .form-group input, .form-group textarea, .form-group select { width: 100%; padding: 12px 16px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; color: #111827; font-size: 14px; }
  .form-group input:focus, .form-group textarea:focus, .form-group select:focus { outline: none; border-color: #1e3a8a; }
  .radio-group { display: flex; gap: 12px; }
  .radio-option { flex: 1; display: flex; align-items: center; gap: 10px; padding: 16px; background: #f9fafb; border: 2px solid #e5e7eb; border-radius: 10px; cursor: pointer; }
  .radio-option.selected { border-color: #1e3a8a; background: #eff6ff; }
  .radio-option input { display: none; }
  .actions-bar { display: flex; justify-content: flex-end; margin-bottom: 40px; }
  .save-btn { padding: 14px 32px; background: #1e3a8a; border: none; border-radius: 8px; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  .save-btn:disabled { opacity: 0.6; }
  .danger-zone { padding: 24px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; }
  .danger-zone h2 { font-size: 16px; color: #ef4444; margin: 0 0 8px 0; }
  .danger-zone p { font-size: 14px; color: #6b7280; margin: 0 0 16px 0; }
  .delete-btn { padding: 12px 24px; background: transparent; border: 1px solid #ef4444; border-radius: 8px; color: #ef4444; cursor: pointer; }
  .delete-btn:hover { background: #ef4444; color: #fff; }
  .loading-container, .error-container { min-height: 50vh; display: flex; flex-direction: column; align-items: center; justify-content: center; color: #6b7280; }
  .error-container h2 { color: #111827; margin-bottom: 16px; }
  .back-link { color: #1e3a8a; }
`;
