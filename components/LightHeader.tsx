"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/store";

const NAV = [
  { href: "/",            zh: "首页",   en: "Home" },
  { href: "/rankings",    zh: "球员排名", en: "Rankings" },
  { href: "/league",      zh: "公开联赛", en: "Leagues" },
  { href: "/compare",     zh: "球员对比", en: "Compare" },
  { href: "/draft-guide", zh: "选秀指南", en: "Draft Guide" },
  { href: "/cheat-sheet", zh: "备忘单",  en: "Cheat Sheet" },
  { href: "/how-to-play", zh: "新手入门", en: "How To Play" },
  { href: "/my-team",     zh: "我的球队", en: "My Team" },
];

export default function LightHeader({ activeHref }: { activeHref: string }) {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<{ name: string; username: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser({ name: u.name, username: u.username });

    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("bp_session");
    setUser(null);
    window.location.href = "/";
  };

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,0.97)",
      backdropFilter: "blur(12px)",
      borderBottom: "1px solid #e2e8f0",
    }}>
      <div style={{
        maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 12px" : "0 24px",
        height: 64, display: "flex", alignItems: "center", gap: isMobile ? 12 : 32,
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
        </Link>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 2, flex: 1, overflowX: "auto", overflowY: "hidden" }}>
          {NAV.map(item => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  padding: "7px 13px",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? "#0f172a" : "#64748b",
                  background: isActive ? "#f1f5f9" : "transparent",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {lang === "zh" ? item.zh : item.en}
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 10, flexShrink: 0 }}>
          <button
            onClick={() => setLang(lang === "zh" ? "en" : "zh")}
            style={{
              padding: isMobile ? "6px 9px" : "7px 14px",
              border: "1px solid #e2e8f0",
              borderRadius: 999,
              background: "#fff",
              fontSize: isMobile ? 12 : 13,
              fontWeight: 600,
              color: "#64748b",
              cursor: "pointer",
            }}
          >
            中 / EN
          </button>

          {!user ? (
            <>
              <Link href="/auth/login" style={{
                padding: isMobile ? "7px 10px" : "8px 18px",
                border: "1px solid #e2e8f0",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#374151",
                textDecoration: "none",
                background: "#fff",
              }}>
                {t("登录", "Login")}
              </Link>
              <Link href="/auth/signup" style={{
                padding: isMobile ? "7px 10px" : "8px 20px",
                background: "#1e3a8a",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
              }}>
                {t("注册", "Sign Up")}
              </Link>
            </>
          ) : (
            <>
              <Link href={`/u/${user.username}`} style={{
                fontSize: isMobile ? 12 : 14, color: "#374151", textDecoration: "none",
                fontWeight: 500, padding: isMobile ? "6px 8px" : "8px 4px",
                maxWidth: isMobile ? 76 : "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                @{user.username}
              </Link>
              <button onClick={handleLogout} style={{
                padding: isMobile ? "6px 8px" : "8px 14px", fontSize: isMobile ? 12 : 14, color: "#64748b",
                border: "none", background: "transparent", cursor: "pointer",
              }}>
                {isMobile ? t("退", "Out") : t("退出", "Logout")}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
