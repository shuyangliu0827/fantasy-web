"use client";

import Link from "next/link";
import { useLang } from "@/lib/lang";

type Props = {
  /** Optional override for the body copy. */
  message?: { zh: string; en: string };
  /** When true, swaps the CTA to "Sign in" (use for anonymous visitors). */
  requireSignIn?: boolean;
  /** Path to redirect back to after sign-in. */
  nextHref?: string;
};

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

export default function AccessDenied({
  message,
  requireSignIn = false,
  nextHref,
}: Props) {
  const { t } = useLang();
  const defaultMsg = requireSignIn
    ? {
        zh: "请先登录以访问此页面。",
        en: "Please sign in to access this page.",
      }
    : {
        zh: "您没有访问此页面的权限。如需进入联赛管理中心，请联系平台管理员或联赛负责人申请权限。",
        en: "You don't have permission to access this page. Contact a platform admin or league owner to request access to the League Management Center.",
      };
  const body = message ?? defaultMsg;
  const signInHref = nextHref
    ? `/auth/login?next=${encodeURIComponent(nextHref)}`
    : "/auth/login";

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "64px 24px",
        background: "#f8fafc",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 20,
          padding: "32px 28px",
          textAlign: "center",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
        }}
      >
        <div
          style={{
            margin: "0 auto 18px",
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "#fef3c7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
          aria-hidden="true"
        >
          🔒
        </div>
        <h1
          style={{
            margin: "0 0 10px",
            fontSize: 22,
            fontWeight: 800,
            color: "#0f172a",
            letterSpacing: "-0.3px",
          }}
        >
          {t("访问受限", "Access Denied")}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            color: "#475569",
            lineHeight: 1.7,
          }}
        >
          {t(body.zh, body.en)}
        </p>
        <div
          style={{
            marginTop: 22,
            display: "flex",
            gap: 10,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          {requireSignIn ? (
            <Link
              href={signInHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "10px 20px",
                background: "#1e3a8a",
                color: "#fff",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {t("登录", "Sign in")}
            </Link>
          ) : null}
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "10px 20px",
              background: "#fff",
              color: "#0f172a",
              border: "1px solid #e2e8f0",
              borderRadius: 10,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {t("返回首页", "Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
