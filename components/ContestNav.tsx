"use client";
// components/ContestNav.tsx
// Tab navigation shared by all Daily Fantasy sub-pages.
//
// Layout contract: the inner container uses the same maxWidth / margin / padding
// values as LightHeader so the tab row left-edge aligns with the logo/nav at
// every viewport width.
//   desktop (≥768px) : maxWidth 1200, padding 0 24px
//   mobile  (<768px) : maxWidth 1200, padding 0 10px

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "@/lib/lang";

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Noto Sans SC', sans-serif";

const TABS = [
  { href: "/contest",                labelZh: "选阵容",   labelEn: "Build" },
  { href: "/contest/leaderboard",    labelZh: "每日榜",   labelEn: "Daily Board" },
  { href: "/contest/weekly",         labelZh: "周积分榜", labelEn: "Weekly" },
  { href: "/contest/all-time",       labelZh: "总积分榜", labelEn: "All-Time" },
  { href: "/contest/my-lineup",      labelZh: "我的成绩", labelEn: "My Results" },
  { href: "/contest/other-leagues",  labelZh: "其他联赛", labelEn: "Other Leagues" },
] as const;

export default function ContestNav({ contestId }: { contestId?: string | null }) {
  const pathname = usePathname();
  const router   = useRouter();
  const { t }    = useLang();
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Horizontal padding that matches LightHeader's inner container exactly.
  const hPad = isMobile ? 10 : 24;

  return (
    // Outer strip — full viewport width, carries the bottom border.
    <div style={{ borderBottom: "1px solid #e5e7eb", background: "#fff", fontFamily: FONT }}>
      {/* Inner container — same maxWidth + margin as LightHeader */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: `0 ${hPad}px` }}>
        {/* Scrollable tab row — overflowX so tabs never wrap on narrow screens */}
        <div style={{ display: "flex", gap: 4, overflowX: "auto", padding: "8px 0",
                      scrollbarWidth: "none", msOverflowStyle: "none" }}>
          {TABS.map((tab) => {
            const active = tab.href === "/contest"
              ? pathname === "/contest"
              : pathname.startsWith(tab.href);

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
        </div>
      </div>
    </div>
  );
}

