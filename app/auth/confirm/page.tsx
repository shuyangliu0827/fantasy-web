"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { supabase } from "@/lib/store";

export default function ConfirmPage() {
  const { t } = useLang();
  const router = useRouter();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // Supabase auto-detects the token from the URL hash (#access_token=...&type=signup)
    // and establishes a session. We listen for the auth state change.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setStatus("success");
      }
    });

    // Also check if session is already established (in case the event fires before listener)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStatus("success");
      }
    });

    // If still verifying after 10 seconds, show error
    const timeout = setTimeout(() => {
      setStatus(prev => {
        if (prev === "verifying") {
          setErrorMsg(t(
            "验证链接已过期或无效，请重新注册或联系支持。",
            "The verification link is expired or invalid. Please try signing up again."
          ));
          return "error";
        }
        return prev;
      });
    }, 10000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEnterSite = () => {
    // Sign out so the user starts fresh via the login page.
    // The email is confirmed — they can now log in on any device.
    supabase.auth.signOut().catch(() => {});
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

          {status === "verifying" && (
            <>
              <h1>{t("正在验证邮箱...", "Verifying email...")}</h1>
              <p>{t("请稍候", "Please wait")}</p>
            </>
          )}

          {status === "success" && (
            <>
              <h1>{t("邮箱验证成功", "Email confirmed!")}</h1>
              <p>{t("你的账户已通过验证，可以开始使用了。", "Your account is verified and ready to go.")}</p>
            </>
          )}

          {status === "error" && (
            <>
              <h1>{t("验证失败", "Verification failed")}</h1>
              <p>{errorMsg}</p>
            </>
          )}
        </div>

        {status === "verifying" && (
          <div style={{
            padding: "20px",
            textAlign: "center",
            fontSize: 14,
            color: "#a1a1aa",
          }}>
            <div style={{
              width: 32, height: 32, border: "3px solid rgba(245, 158, 11, 0.3)",
              borderTopColor: "#f59e0b", borderRadius: "50%",
              margin: "0 auto 12px",
              animation: "spin 0.8s linear infinite",
            }} />
            {t("正在确认你的邮箱地址...", "Confirming your email address...")}
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {status === "success" && (
          <div style={{ textAlign: "center" }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(34, 197, 94, 0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 28,
            }}>
              ✓
            </div>
            <button
              onClick={handleEnterSite}
              style={{
                width: "100%",
                padding: "14px 24px",
                border: "none",
                borderRadius: 10,
                background: "#f59e0b",
                fontSize: 15,
                fontWeight: 700,
                color: "#000",
                cursor: "pointer",
              }}
            >
              {t("进入网站", "Go to site")}
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="auth-footer">
            <Link href="/auth/signup">{t("重新注册", "Sign up again")}</Link>
            <span style={{ margin: "0 8px", color: "#6b7280" }}>·</span>
            <Link href="/auth/login">{t("返回登录", "Back to login")}</Link>
          </div>
        )}
      </div>
    </div>
  );
}
