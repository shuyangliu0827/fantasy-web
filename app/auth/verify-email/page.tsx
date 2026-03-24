"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLang } from "@/lib/lang";
import { resendConfirmationEmail } from "@/lib/store";

function VerifyEmailContent() {
  const { t } = useLang();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  const handleResend = async () => {
    if (!email || resending) return;
    setResending(true);
    setResendError(null);
    const res = await resendConfirmationEmail(email);
    setResending(false);
    if (res.ok) {
      setResent(true);
    } else {
      setResendError(res.error);
    }
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
          <h1>{t("请先验证邮箱", "Check your email")}</h1>
          <p>{t("你的账户已创建成功！", "Your account has been created!")}</p>
        </div>

        <div style={{
          padding: "20px 24px",
          background: "rgba(245, 158, 11, 0.08)",
          border: "1px solid rgba(245, 158, 11, 0.25)",
          borderRadius: 12,
          fontSize: 14,
          color: "#d4d4d8",
          lineHeight: 1.7,
          marginBottom: 20,
        }}>
          <p style={{ margin: "0 0 12px 0" }}>
            {t(
              "我们已向你的邮箱发送了一封验证邮件，请查收并点击邮件中的链接完成验证。",
              "We've sent a confirmation email to your inbox. Please click the link in the email to verify your account."
            )}
          </p>
          {email && (
            <p style={{ margin: "0 0 12px 0", fontWeight: 600, color: "#fbbf24" }}>
              {email}
            </p>
          )}
          <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa" }}>
            {t(
              "如果没有收到邮件，请检查垃圾邮件/Spam文件夹。",
              "If you don't see it, check your spam/junk folder."
            )}
          </p>
        </div>

        {/* Resend button */}
        <button
          onClick={handleResend}
          disabled={resending || resent}
          style={{
            width: "100%",
            padding: "12px 20px",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: 10,
            background: resent ? "rgba(34, 197, 94, 0.1)" : "transparent",
            fontSize: 14,
            fontWeight: 600,
            color: resent ? "#22c55e" : "#fbbf24",
            cursor: resending || resent ? "default" : "pointer",
            opacity: resending ? 0.6 : 1,
            marginBottom: 12,
          }}
        >
          {resending
            ? t("发送中...", "Sending...")
            : resent
              ? t("✓ 邮件已重新发送", "✓ Email resent")
              : t("重新发送验证邮件", "Resend confirmation email")}
        </button>

        {resendError && (
          <div className="form-error">{resendError}</div>
        )}

        <div className="auth-footer">
          <Link href="/auth/login">
            {t("我已完成验证，去登录", "I've confirmed — go to login")}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
