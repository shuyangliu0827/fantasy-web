"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { updatePassword, supabase } from "@/lib/store";

export default function ResetPasswordPage() {
  const { t } = useLang();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase will auto-detect the token from the URL hash and establish a session
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("密码至少需要6个字符", "Password must be at least 6 characters"));
      return;
    }

    if (password !== confirmPassword) {
      setError(t("两次输入的密码不一致", "Passwords do not match"));
      return;
    }

    setLoading(true);
    const res = await updatePassword(password);

    if (!res.ok) {
      setError(res.error || t("重置失败", "Failed to reset password"));
      setLoading(false);
      return;
    }

    router.push("/auth/login");
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
          <h1>{t("设置新密码", "Set New Password")}</h1>
          <p>{t("请输入你的新密码", "Please enter your new password")}</p>
        </div>

        {!ready ? (
          <div style={{
            padding: "16px 20px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "var(--radius-md)",
            fontSize: 14,
            color: "#fbbf24",
            textAlign: "center",
            lineHeight: 1.6,
          }}>
            {t("正在验证重置链接...", "Verifying reset link...")}
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t("新密码", "New Password")}</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            <div className="form-group">
              <label className="form-label">{t("确认新密码", "Confirm New Password")}</label>
              <input
                className="form-input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>

            {error && <div className="form-error">{error}</div>}

            <button className="form-submit" type="submit" disabled={loading}>
              {loading ? t("重置中...", "Resetting...") : t("重置密码", "Reset Password")}
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
