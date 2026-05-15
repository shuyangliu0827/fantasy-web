// lib/basketball/use-platform-admin.ts
//
// Shared client-side hook that resolves whether the current user is a
// platform admin. Pages that render their own inline top-nav (rather
// than LightHeader / Header) can call this hook to gate the "平台管理"
// nav entry, instead of duplicating the fetch.
//
// The hook never throws — failures fall back to `false`.

"use client";

import { useEffect, useState } from "react";
import { basketballFetch } from "@/lib/basketball/client";

export function usePlatformAdmin(): { isPlatformAdmin: boolean } {
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await basketballFetch("/api/me/basketball-access");
        if (!res.ok) return;
        const body = (await res.json()) as { is_platform_admin?: boolean };
        if (!cancelled) setIsPlatformAdmin(!!body.is_platform_admin);
      } catch {
        // non-fatal
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { isPlatformAdmin };
}
