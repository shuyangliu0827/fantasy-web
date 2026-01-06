"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "@/lib/store";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canSubmit = email.trim() && pw.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;

    setLoading(true);
    setErr(null);

    const res = login(email, pw);
    if (!res.ok) {
      setErr(res.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
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
          <h1>Welcome Back</h1>
          <p>Sign in to continue to Blueprint Fantasy</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              className="form-input"
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          {err && <div className="form-error">{err}</div>}

          <button
            className="form-submit"
            type="submit"
            disabled={!canSubmit || loading}
            style={{ marginTop: 8 }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="auth-footer">
          Don&apos;t have an account? <Link href="/auth/signup">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
