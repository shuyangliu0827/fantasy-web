"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { signup } from "@/lib/store";

export default function SignupPage() {
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [agreed, setAgreed] = useState(false);
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
    if (!agreed) {
      setError(t("请同意用户服务协议和隐私政策", "Please agree to the Terms and Privacy Policy"));
      return;
    }
    setError(null);
    setLoading(true);

    const res = await signup(name, email.trim().toLowerCase(), password);

    if (!res.ok) {
      setError(res.error || t("注册失败", "Signup failed"));
      setLoading(false);
      return;
    }

    router.push("/");
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
            fontSize: 52,
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1.1,
            margin: 0,
          }}>
            加入
            <br />
            <span style={{
              fontStyle: "italic",
              textDecoration: "underline",
              textDecorationColor: "rgba(255,255,255,0.5)",
              textUnderlineOffset: 6,
            }}>12,000+</span>
            <br />
            幻想球迷
          </h1>
          <p style={{
            marginTop: 20,
            fontSize: 15,
            color: "rgba(255,255,255,0.85)",
            lineHeight: 1.65,
            maxWidth: 260,
          }}>
            {t(
              "免费注册，立即开始你的第一次选秀，挑战全国高手。",
              "Sign up free and start your first draft today."
            )}
          </p>
        </div>

        {/* Feature bullets */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 40 }}>
          {[
            { icon: "", label: t("免费模拟选秀无限次", "Unlimited mock drafts") },
            { icon: "", label: t("实时推送选秀提醒", "Real-time draft alerts") },
            { icon: "", label: t("新用户免费参加精英联赛", "Free elite league for new users") },
          ].map((item) => (
            <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 18,
                width: 36,
                height: 36,
                background: "rgba(255,255,255,0.2)",
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>{item.icon}</span>
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
            {t("创建账号", "Create Account")}
          </h2>
          <p style={{ fontSize: 14, color: "#6b7280", margin: "0 0 32px 0" }}>
            {t("开始你的范特西篮球之旅", "Begin your fantasy basketball journey")}
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Username */}
            <div>
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                {t("用户名", "Username")}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("湾区球迷007", "Your name")}
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
              <label style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
                {t("密码", "Password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("至少8位，包含大写和数字", "Min 8 chars, uppercase & number")}
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

            {/* Terms checkbox */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                style={{
                  width: 16,
                  height: 16,
                  marginTop: 2,
                  accentColor: "#f59e0b",
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              />
              <span style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
                {t("我已阅读并同意", "I have read and agree to the")}{" "}
                <span style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>
                  {t("《用户服务协议》", "Terms of Service")}
                </span>
                {t(" 和 ", " and ")}{" "}
                <span style={{ color: "#2563eb", textDecoration: "underline", cursor: "pointer" }}>
                  {t("《隐私政策》", "Privacy Policy")}
                </span>
              </span>
            </label>

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
              {loading ? t("注册中...", "Creating account...") : t("注册并开始选秀 →", "Sign Up & Start Drafting →")}
            </button>

            {/* Divider */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
              <span style={{ fontSize: 13, color: "#9ca3af" }}>{t("或者", "or")}</span>
              <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            </div>

            {/* WeChat */}
            <button
              type="button"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: 15,
                fontWeight: 500,
                color: "#374151",
                background: "#fff",
                border: "1.5px solid #e5e7eb",
                borderRadius: 10,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "border-color 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#d1d5db")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
            >
              <span style={{ fontSize: 18 }}></span>
              {t("使用微信快速注册", "Sign up with WeChat")}
            </button>

            {/* Login link */}
            <p style={{ textAlign: "center", fontSize: 14, color: "#6b7280", margin: 0 }}>
              {t("已有账号？", "Already have an account?")}{" "}
              <Link href="/auth/login" style={{ color: "#f59e0b", fontWeight: 600, textDecoration: "none" }}>
                {t("直接登录", "Log in")}
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
