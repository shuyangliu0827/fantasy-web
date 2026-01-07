"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { signup } from "@/lib/store";

export default function SignupPage() {
  const { t } = useLang();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = signup(name, email, password);
    
    if (!res.ok) {
      setError(res.error || t("注册失败", "Signup failed"));
      setLoading(false);
      return;
    }

    router.push("/");
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
          <h1>{t("注册", "Sign Up")}</h1>
          <p>{t("创建你的蓝本账号", "Create your Blueprint account")}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t("用户名", "Name")}</label>
            <input
              className="form-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("你的名字", "Your name")}
              required
            />
          </div>

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

          <div className="form-group">
            <label className="form-label">{t("密码", "Password")}</label>
            <input
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="form-error">{error}</div>}

          <button className="form-submit" type="submit" disabled={loading}>
            {loading ? t("注册中...", "Creating account...") : t("注册", "Sign Up")}
          </button>
        </form>

        <div className="auth-footer">
          {t("已有账号？", "Already have an account?")} <Link href="/auth/login">{t("登录", "Login")}</Link>
        </div>
      </div>
    </div>
  );
}
