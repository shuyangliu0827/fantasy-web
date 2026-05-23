"use client";

import Link from "next/link";
import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLang } from "@/lib/lang";
import { login } from "@/lib/shared/store";
import { basketballFetch } from "@/lib/basketball/client";
import {
  EMPTY_ROLE_CONTEXT,
  type RoleContext,
} from "@/lib/auth/getCurrentUserRole";
import { resetCurrentUserRoles } from "@/lib/auth/use-current-user-roles";
import { getPostLoginRedirect } from "@/lib/auth/getPostLoginRedirect";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const { t } = useLang();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await login(email.trim().toLowerCase(), password);

    if (!res.ok) {
      setError(res.error || t("登录失败", "Login failed"));
      setLoading(false);
      return;
    }

    // Invalidate any cached RoleContext from a prior anonymous/different
    // session so subsequent UI reflects the new user.
    resetCurrentUserRoles();

    let roles: RoleContext = EMPTY_ROLE_CONTEXT;
    try {
      const rolesRes = await basketballFetch("/api/me/roles");
      if (rolesRes.ok) {
        const body = (await rolesRes.json()) as Partial<RoleContext>;
        roles = { ...EMPTY_ROLE_CONTEXT, ...body };
      }
    } catch {
      // Non-fatal — fall through to fallback redirect.
    }

    const dest = getPostLoginRedirect({ next, roles });
    router.push(dest);
  };

  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "#f3f4f6",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Left panel — hidden on mobile */}
      <div style={{
        flex: "0 0 42%",
        background: "linear-gradient(145deg, #f59e0b 0%, #f97316 60%, #ea580c 100%)",
        padding: "48px 44px",
        display: isMobile ? "none" : "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Background decoration */}
        <div style={{
          position: "absolute",
          top: -80,
          right: -80,
          width: 300,
          height: 300,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          bottom: -60,
          left: -60,
          width: 240,
          height: 240,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.06)",
          pointerEvents: "none",
        }} />

        {/* Logo */}
        <div>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{
              fontSize: 22,
              fontWeight: 700,
              color: "#fff",
              letterSpacing: "-0.3px",
            }}>
              蓝本· Blueprint
            </span>
          </Link>
        </div>

        {/* Hero text */}
        <div style={{ marginTop: 48 }}>
          <h1 style={{
            fontSize: 44,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.15,
            margin: 0,
            whiteSpace: "nowrap",
          }}>
            欢迎回来，<span style={{
              fontStyle: "italic",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.5)",
              textUnderlineOffset: 6,
            }}>球迷</span>
          </h1>
          <p style={{
            marginTop: 20,
            fontSize: 15,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.65,
            maxWidth: 260,
          }}>
            {t(
              "登录继续管理你的球队，查看实时赛况，和高手一较高下。",
              "Sign in to manage your team, track live scores, and compete with the best."
            )}
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 40 }}>
          {[
            {
              svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
              label: t("实时NBA数据更新", "Real-time NBA stats"),
            },
            {
              svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
              label: t("智能选手排名系统", "Smart player rankings"),
            },
            {
              svg: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
              label: t("多联赛同时参与", "Join multiple leagues"),
            },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                width: 36,
                height: 36,
                background: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>{item.svg}</span>
              <span style={{ fontSize: 14, color: "rgba(255,255,255,0.9)", fontWeight: 500 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div style={{
        flex: 1,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isMobile ? "32px 20px" : "48px 56px",
      }}>
        <div style={{ width: "100%", maxWidth: 400 }}>
          <h2 style={{
            fontSize: 30,
            fontWeight: 700,
            color: "#111827",
            margin: "0 0 6px 0",
          }}>
            {t("欢迎回来", "Welcome back")}
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px 0" }}>
            {t("登录你的蓝本账号", "Sign in to your Blueprint account")}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Email */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                {t("邮箱", "Email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  fontSize: 15,
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  outline: "none",
                  color: "#111827",
                  background: "#fff",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
            </div>

            {/* Password */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: "#374151" }}>
                  {t("密码", "Password")}
                </label>
                <Link href="/auth/forgot-password" style={{ fontSize: 13, color: "#f59e0b", fontWeight: 500, textDecoration: "none" }}>
                  {t("忘记密码？", "Forgot password?")}
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  fontSize: 15,
                  border: "1.5px solid #e5e7eb",
                  borderRadius: 10,
                  outline: "none",
                  color: "#111827",
                  background: "#fff",
                  boxSizing: "border-box",
                  transition: "border-color 0.2s",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#f59e0b")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
              />
            </div>

            {error && (
              <div style={{
                fontSize: 13,
                color: "#dc2626",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                padding: "10px 14px",
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                fontSize: 16,
                fontWeight: 700,
                color: "#fff",
                background: loading ? "#fbbf24" : "linear-gradient(90deg, #f59e0b, #f97316)",
                border: "none",
                borderRadius: 10,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "opacity 0.2s",
                letterSpacing: "0.3px",
              }}
            >
              {loading ? t("登录中...", "Signing in...") : t("登录 →", "Sign In →")}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: 13, color: "#9ca3af" }}>{t("或者", "or")}</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>

            {/* WeChat (coming soon) */}
            <button
              type="button"
              disabled
              aria-disabled="true"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 15,
                fontWeight: 500,
                color: "#374151",
                background: "#fff",
                border: "1.5px solid #e5e7eb",
                borderRadius: 10,
                cursor: "not-allowed",
                opacity: 0.6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              <span style={{ fontSize: 18 }}></span>
              {t("微信一键登录即将上线", "WeChat login coming soon")}
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#9ca3af", margin: "-4px 0 0" }}>
              {t("目前请先使用邮箱注册/登录", "Please use email sign-up/login for now.")}
            </p>

            {/* Signup link */}
            <p style={{ textAlign: "center", fontSize: 14, color: "#6b7280", margin: 0 }}>
              {t("还没有账号？", "Don't have an account?")}{" "}
              <Link href="/auth/signup" style={{ color: "#f59e0b", fontWeight: 600, textDecoration: "none" }}>
                {t("免费注册", "Sign up free")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
