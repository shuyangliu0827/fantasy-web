"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";
import { getSessionUser } from "@/lib/shared/store";
import { supabase } from "@/lib/shared/supabase";

export default function ProfileAliasRedirector() {
  const router = useRouter();
  const { t } = useLang();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = getSessionUser();
      if (stored?.username) {
        router.replace(`/u/${stored.username}`);
        return;
      }
      // Fallback: derive a username from the Supabase session if bp_session
      // is missing but auth still has us logged in (mirrors LightHeader logic).
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      const email = data.session?.user?.email ?? null;
      const handle = email ? email.split("@")[0] : null;
      if (handle) {
        router.replace(`/u/${handle}`);
      } else {
        router.replace("/auth/login?next=/profile");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div style={{ minHeight: "50vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748b", fontSize: 14 }}>
      {t("正在跳转到个人主页...", "Redirecting to your profile…")}
    </div>
  );
}
