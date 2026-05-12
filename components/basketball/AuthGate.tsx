"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/shared/supabase";
import { useLang } from "@/lib/lang";

type Props = {
  children: React.ReactNode;
  /** Optional fallback when no Supabase session is present.
   *  Default behavior is to redirect to /auth/login?next=<current path>. */
  fallback?: React.ReactNode;
};

/**
 * Gate that releases its children only after confirming a Supabase auth
 * session is present. Without this, admin pages briefly render their chrome
 * before the API call fails — which looks like a security leak even when
 * the API correctly denies access.
 */
export default function AuthGate({ children, fallback }: Props) {
  const { t } = useLang();
  const router = useRouter();
  const pathname = usePathname() ?? "/";
  const [state, setState] = useState<"checking" | "ok" | "no_session">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setState("ok");
      } else {
        setState("no_session");
        if (!fallback) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname)}`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, fallback]);

  if (state === "checking") {
    return (
      <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
        {t("加载中…", "Loading…")}
      </main>
    );
  }
  if (state === "no_session") {
    return (
      <>
        {fallback ?? (
          <main style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            {t("正在跳转到登录页…", "Redirecting to login…")}
          </main>
        )}
      </>
    );
  }
  return <>{children}</>;
}
