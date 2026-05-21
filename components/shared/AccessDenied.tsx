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
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
          <span className="text-3xl" aria-hidden="true">
            🔒
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {t("访问受限", "Access Denied")}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {t(body.zh, body.en)}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {requireSignIn ? (
            <Link
              href={signInHref}
              className="inline-flex justify-center px-5 py-2.5 rounded-md bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-sm font-medium hover:opacity-90 transition"
            >
              {t("登录", "Sign in")}
            </Link>
          ) : null}
          <Link
            href="/"
            className="inline-flex justify-center px-5 py-2.5 rounded-md border border-neutral-300 dark:border-neutral-700 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900 transition"
          >
            {t("返回首页", "Back to Home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
