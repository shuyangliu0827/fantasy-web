"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang } from "@/lib/lang";
import { requestPasswordReset } from "@/lib/store";

export default function ForgotPasswordPage() {
  const { t } = useLang();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await requestPasswordReset(email);

    if (!res.ok) {
      setError(res.error || t("发送失败", "Failed to send reset link"));
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <Link href="/" style={{ display: "inline-block", marginBottom: 24 }}>
            <svg viewBox="0 0 40 40" fill="none" style={{ width: 50, height: 50, color: "#f59e0b" }}>
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="2.5"/>
              <path d="M20 4 C20 4, 8 16, 20 20 C32 24, 20 36, 20 36" stroke="currentColor" strokeWidth="2.5" fill="none"/>
              <path d="M4 20 H36" stroke="currentColor" strokeWidth="2.5"/>
            </svg>
          </Link>
          <h1>{t("重置密码", "Reset Password")}</h1>
          <p>{t("输入你的邮箱，我们将发送重置链接", "Enter your email and we'll send you a reset link")}</p>
        </div>

        {success ? (
          <div style={{
            padding: "16px 20px",
            background: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            color: "#4ade80",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            {t(
              "重置链接已发送到你的邮箱，请查看收件箱（包括垃圾邮件）并点击链接重置密码。",
              "A reset link has been sent to your email. Please check your inbox (and spam folder) and click the link to reset your password."
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t("邮箱", "Email")}</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="form-submit" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? t("发送中...", "Sending...") : t("发送重置链接", "Send Reset Link")}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <Link href="/auth/login">{t("返回登录", "Back to Login")}</Link>
        </div>
      </div>
    </div>
  );
}
