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
];

export default function LightHeader({ activeHref }: { activeHref: string }) {
  const { t, lang, setLang } = useLang();
  const [user, setUser] = useState<{ name: string; username: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const u = getSessionUser();
    if (u) setUser({ name: u.name, username: u.username });

    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setMenuOpen(false);
    };
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
        maxWidth: 1200, margin: "0 auto", padding: isMobile ? "0 10px" : "0 24px",
        height: isMobile ? 60 : 64, display: "flex", alignItems: "center", gap: isMobile ? 8 : 32,
      }}>

        {/* Logo */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 2, textDecoration: "none", flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: "#1e3a8a", letterSpacing: "-0.5px" }}>蓝本</span>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f59e0b", marginBottom: 8, flexShrink: 0 }} />
        </Link>

        {/* Desktop nav */}
        {!isMobile && (
          <nav style={{ display: "flex", gap: 2, flex: 1, minWidth: 0, overflowX: "auto", overflowY: "hidden" }}>
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
        )}

        {/* Spacer on mobile */}
        {isMobile && <div style={{ flex: 1 }} />}

        {/* Desktop right actions */}
        {!isMobile && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              style={{
                padding: "7px 14px",
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                background: "#fff",
                fontSize: 13,
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
                  padding: "8px 18px",
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
                  padding: "8px 20px",
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
                  fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500, padding: "8px 4px",
                }}>
                  {user.name}
                </Link>
                <button onClick={handleLogout} style={{
                  padding: "8px 14px", fontSize: 14, color: "#64748b",
                  border: "none", background: "transparent", cursor: "pointer",
                }}>
                  {t("退出", "Logout")}
                </button>
              </>
            )}
          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            style={{
              width: 44, height: 44,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: 5, background: "transparent", border: "none", cursor: "pointer", padding: 0, flexShrink: 0,
            }}
          >
            <span style={{
              display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2,
              transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none",
              transition: "transform 0.2s ease",
            }} />
            <span style={{
              display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2,
              opacity: menuOpen ? 0 : 1,
              transition: "opacity 0.2s ease",
            }} />
            <span style={{
              display: "block", width: 22, height: 2, background: "#64748b", borderRadius: 2,
              transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none",
              transition: "transform 0.2s ease",
            }} />
          </button>
        )}
      </div>

      {/* Mobile drawer */}
      {isMobile && menuOpen && (
        <div style={{
          position: "absolute",
          top: "100%",
          left: 0,
          right: 0,
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
          zIndex: 99,
          maxHeight: "calc(100vh - 60px)",
          overflowY: "auto",
        }}>
          {NAV.map(item => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                style={{
                  display: "block",
                  padding: "14px 20px",
                  fontSize: 15,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#1e3a8a" : "#374151",
                  textDecoration: "none",
                  borderLeft: isActive ? "3px solid #1e3a8a" : "3px solid transparent",
                  background: isActive ? "#f8fafc" : "transparent",
                }}
              >
                {lang === "zh" ? item.zh : item.en}
              </Link>
            );
          })}
          <div style={{ height: 1, background: "#e2e8f0", margin: "4px 0" }} />
          <div style={{ padding: "12px 16px 20px", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button
              onClick={() => setLang(lang === "zh" ? "en" : "zh")}
              style={{
                padding: "6px 14px", border: "1px solid #e2e8f0", borderRadius: 999,
                background: "#fff", fontSize: 13, fontWeight: 600, color: "#64748b", cursor: "pointer",
              }}
            >
              中 / EN
            </button>
            {!user ? (
              <>
                <Link className="btn btn-ghost" href="/auth/login" onClick={() => setMenuOpen(false)}
                  style={{ padding: "8px 16px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#374151", textDecoration: "none", background: "#fff" }}>
                  {t("登录", "Login")}
                </Link>
                <Link href="/auth/signup" onClick={() => setMenuOpen(false)}
                  style={{ padding: "8px 16px", background: "#1e3a8a", borderRadius: 8, fontSize: 14, fontWeight: 600, color: "#fff", textDecoration: "none" }}>
                  {t("注册", "Sign Up")}
                </Link>
              </>
            ) : (
              <>
                <Link href={`/u/${user.username}`} onClick={() => setMenuOpen(false)}
                  style={{ padding: "8px 4px", fontSize: 14, color: "#374151", textDecoration: "none", fontWeight: 500 }}>
                  {user.name}
                </Link>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }}
                  style={{ padding: "8px 14px", fontSize: 14, color: "#64748b", border: "none", background: "transparent", cursor: "pointer" }}>
                  {t("退出", "Logout")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
