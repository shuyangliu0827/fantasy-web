"use client";
// components/ContestNav.tsx
// Tab navigation shared by all Daily Fantasy sub-pages.

import { usePathname, useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const TABS = [
  { href: "/contest",             labelZh: "选阵容",   labelEn: "Build" },
  { href: "/contest/leaderboard", labelZh: "每日榜",   labelEn: "Daily Board" },
  { href: "/contest/weekly",      labelZh: "周积分榜", labelEn: "Weekly" },
  { href: "/contest/my-lineup",   labelZh: "我的成绩", labelEn: "My Results" },
] as const;

export default function ContestNav({ contestId }: { contestId?: string | null }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { t }    = useLang();

  return (
    <nav style={{
      display: "flex", gap: 4, padding: "8px 16px",
      borderBottom: "1px solid #e5e7eb", background: "#fff",
      fontFamily: FONT, overflowX: "auto",
    }}>
      {TABS.map((tab) => {
        // Exact match for /contest, prefix match for sub-pages.
        const active = tab.href === "/contest"
          ? pathname === "/contest"
          : pathname.startsWith(tab.href);

        // Append contest id as query param when navigating sub-pages.
        const href = contestId && tab.href !== "/contest"
          ? `${tab.href}?id=${contestId}`
          : tab.href;

        return (
          <button
            key={tab.href}
            onClick={() => router.push(href)}
            style={{
              padding: "7px 14px", borderRadius: 8, border: "none",
              cursor: "pointer", fontSize: 13, fontWeight: 600,
              flexShrink: 0,
              background: active ? "#1e3a8a" : "transparent",
              color:      active ? "#fff"    : "#6b7280",
              transition: "all 0.15s",
            }}
          >
            {t(tab.labelZh, tab.labelEn)}
          </button>
        );
      })}
    </nav>
  );
}
