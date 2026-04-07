"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang";
import { getSessionUser, getPendingTradeCount, supabase } from "@/lib/store";

type LeagueNavProps = {
  slug: string;
  isOwner: boolean;
  leagueId?: string;
};

export default function LeagueNav({ slug, isOwner, leagueId }: LeagueNavProps) {
  const { t } = useLang();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  async function loadPendingCount() {
    if (!leagueId) return;
    const user = getSessionUser();
    if (!user) return;

    // Find user's team in this league
    const { data: team } = await supabase
      .from("fantasy_teams")
      .select("id")
      .eq("league_id", leagueId)
      .eq("user_id", user.id)
      .single();

    if (team) {
      const count = await getPendingTradeCount(leagueId, team.id);
      setPendingCount(count);
    }
  }

  useEffect(() => {
    if (!leagueId) return;
    void loadPendingCount(); // eslint-disable-line react-hooks/set-state-in-effect

    // Subscribe to real-time trade updates
    const channel = supabase
      .channel(`trades_${leagueId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trade_proposals",
          filter: `league_id=eq.${leagueId}`,
        },
        () => {
          loadPendingCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leagueId]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainNav: { href: string; label: string; badge: number }[] = [
    { href: `/league/${slug}`, label: t("联赛主页", "League Home"), badge: 0 },
    { href: `/league/${slug}/roster`, label: t("阵容", "Roster"), badge: 0 },
    { href: `/league/${slug}/free-agents`, label: t("自由市场", "Free Agents"), badge: 0 },
    { href: `/league/${slug}/trade`, label: t("交易", "Trade"), badge: pendingCount },
    { href: `/league/${slug}/standings`, label: t("排行榜", "Standings"), badge: 0 },
    { href: `/league/${slug}/schedule`, label: t("赛程", "Schedule"), badge: 0 },
    { href: `/league/${slug}/scoreboard`, label: t("记分板", "Scoreboard"), badge: 0 },
    { href: `/league/${slug}/members`, label: t("成员", "Members"), badge: 0 },
  ];
  if (isOwner) {
    mainNav.push({ href: `/league/${slug}/settings`, label: t("设置", "Settings"), badge: 0 });
  }

  function isActive(href: string): boolean {
    if (href === `/league/${slug}`) {
      return pathname === `/league/${slug}`;
    }
    return pathname.startsWith(href);
  }

  return (
    <nav style={{
      background: "#fff",
      borderBottom: "1px solid #e5e7eb",
      position: "sticky",
      top: 64,
      zIndex: 40,
    }}>
      <div className="league-nav-scroll" style={{
        maxWidth: 1200,
        margin: "0 auto",
        display: "flex",
        gap: 4,
        padding: "0 16px",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}>
        {mainNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "12px 16px",
                color: active ? "#1e3a8a" : "#6b7280",
                textDecoration: "none",
                fontSize: 14,
                fontWeight: active ? 600 : 500,
                borderBottom: active ? "2px solid #1e3a8a" : "2px solid transparent",
                whiteSpace: "nowrap",
                position: "relative",
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#111827"; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#6b7280"; }}
            >
              {item.label}
              {item.badge > 0 && (
                <span style={{
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0 5px",
                  lineHeight: 1,
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
