"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";

export default function Header() {
  const { lang, setLang, t } = useLang();
  const pathname = usePathname();
  const [user, setUser] = useState<{ name: string; username: string } | null>(() => {
    const u = getSessionUser();
    return u ? { name: u.name, username: u.username } : null;
  });

  const navItems = [
    { href: "/", label: t("首页", "Home") },
    { href: "/discover", label: t("发现", "Discover") },
    { href: "/league", label: t("公开联赛", "Leagues") },
    { href: "/contest", label: t("每日竞赛", "Daily Fantasy") },
  ];

  const handleLogout = () => {
    localStorage.removeItem("bp_session");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link href="/" className="logo">
            <div className="logo-icon">
              <svg viewBox="0 0 40 40" fill="none">
                <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
                <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
                <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
              </svg>
            </div>
            <div className="logo-text">
              <span className="logo-title">{t("蓝本", "Blueprint")}</span>
              <span className="logo-sub">{t("Fantasy 篮球决策平台", "Fantasy Basketball Platform")}</span>
            </div>
          </Link>

          <div className="header-actions">
            {/* 发帖按钮 - 登录后显示 */}
            {user && (
              <Link href="/insights/new" className="btn btn-accent">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 18, height: 18, marginRight: 6 }}>
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
                {t("发帖", "Post")}
              </Link>
            )}

            <button className="lang-toggle" onClick={() => setLang(lang === "zh" ? "en" : "zh")}>
              <span className={lang === "zh" ? "active" : ""}>ZH</span>
              <span className="divider">/</span>
              <span className={lang === "en" ? "active" : ""}>EN</span>
            </button>

            {!user ? (
              <>
                <Link className="btn btn-ghost" href="/auth/login">{t("登录", "Login")}</Link>
                <Link className="btn btn-primary" href="/auth/signup">{t("注册", "Sign Up")}</Link>
              </>
            ) : (
              <>
                <Link className="btn btn-ghost" href={`/u/${user.username}`}>{user.name || user.username}</Link>
                <button className="btn btn-ghost" onClick={handleLogout}>{t("退出", "Logout")}</button>
              </>
            )}
          </div>
        </div>
      </header>

      <nav className="main-nav">
        <div className="nav-inner">
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${pathname === item.href ? "active" : ""}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}