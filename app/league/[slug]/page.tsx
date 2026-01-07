"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import Header from "@/components/Header";
import { useLang } from "@/lib/lang";
import { getLeagueBySlug, getSessionUser, League } from "@/lib/store";

export default function LeagueDetailPage() {
  const { t } = useLang();
  const params = useParams();
  const slug = params.slug as string;
  const [league, setLeague] = useState<League | null>(null);
  const [user, setUser] = useState<ReturnType<typeof getSessionUser>>(null);

  useEffect(() => {
    setUser(getSessionUser());
    const l = getLeagueBySlug(slug);
    setLeague(l);
  }, [slug]);

  if (!league) {
    return (
      <div className="app">
        <Header />
        <main className="page-content" style={{ textAlign: "center", paddingTop: 100 }}>
          <h1 className="page-title">{t("联赛未找到", "League Not Found")}</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>{t("该联赛不存在或已被删除", "This league doesn't exist or has been deleted")}</p>
          <Link href="/" className="btn btn-primary">{t("返回首页", "Back to Home")}</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{league.name}</h1>
          <p className="page-desc">
            {league.visibility === "public" ? t("公开联赛", "Public League") : t("私人联赛", "Private League")}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24, maxWidth: 900 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>{t("联赛信息", "League Info")}</h3>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
              <span style={{ color: "var(--text-muted)" }}>{t("创建时间", "Created")}</span>
              <span>{new Date(league.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
              <span style={{ color: "var(--text-muted)" }}>{t("联赛 ID", "League ID")}</span>
              <span>{league.slug}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
              <span style={{ color: "var(--text-muted)" }}>{t("状态", "Status")}</span>
              <span style={{ color: "#10b981" }}>{t("招募中", "Recruiting")}</span>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>{t("快速操作", "Quick Actions")}</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Link href="/mock-draft" className="btn btn-primary" style={{ textAlign: "center" }}>
                {t("开始模拟选秀", "Start Mock Draft")}
              </Link>
              <Link href="/rankings" className="btn btn-ghost" style={{ textAlign: "center" }}>
                {t("查看球员排名", "View Player Rankings")}
              </Link>
              <Link href="/draft-guide" className="btn btn-ghost" style={{ textAlign: "center" }}>
                {t("阅读选秀指南", "Read Draft Guide")}
              </Link>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 32 }}>
          <h3 style={{ marginBottom: 16 }}>{t("联赛成员", "League Members")}</h3>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <p style={{ color: "var(--text-muted)", textAlign: "center" }}>
              {t("暂无其他成员，邀请朋友加入吧！", "No other members yet. Invite friends to join!")}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
