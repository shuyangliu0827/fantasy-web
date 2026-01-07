"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getLeagueBySlug, getSessionUser, League } from "@/lib/store";

export default function LeagueDetailPage() {
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
        <header className="header">
          <div className="header-inner">
            <Link href="/" className="logo">
              <div className="logo-icon">
                <svg viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
                </svg>
              </div>
              <div className="logo-text"><span className="logo-title">蓝本</span></div>
            </Link>
          </div>
        </header>
        <main className="page-content" style={{ textAlign: "center", paddingTop: 100 }}>
          <h1 className="page-title">联赛未找到</h1>
          <p style={{ color: "#64748b", marginBottom: 24 }}>League not found</p>
          <Link href="/" className="btn btn-primary">返回首页</Link>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
              </svg>
            </div>
            <div className="logo-text"><span className="logo-title">蓝本</span></div>
          </Link>
          <Link href="/" className="btn btn-ghost">← 返回首页</Link>
        </div>
      </header>

      <main className="page-content">
        <div className="page-header">
          <h1 className="page-title">{league.name}</h1>
          <p className="page-desc">
            {league.visibility === "public" ? "公开联赛 Public League" : "私人联赛 Private League"}
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, maxWidth: 800 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>联赛信息 League Info</h3>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid var(--border-color)" }}>
              <span style={{ color: "var(--text-muted)" }}>创建时间</span>
              <span>{new Date(league.createdAt).toLocaleDateString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0" }}>
              <span style={{ color: "var(--text-muted)" }}>联赛 ID</span>
              <span>{league.slug}</span>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24 }}>
            <h3 style={{ marginBottom: 16 }}>快速操作 Actions</h3>
            <Link href="/mock-draft" className="btn btn-primary" style={{ width: "100%", marginBottom: 12, display: "block", textAlign: "center" }}>
              开始模拟选秀
            </Link>
            <Link href="/rankings" className="btn btn-ghost" style={{ width: "100%", display: "block", textAlign: "center" }}>
              查看球员排名
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
