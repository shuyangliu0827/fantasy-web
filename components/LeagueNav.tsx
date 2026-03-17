"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/lang";
import { getSessionUser, getPendingTradeCount } from "@/lib/store";
import { supabase } from "@/lib/supabase";

type LeagueNavProps = {
  slug: string;
  isOwner: boolean;
  leagueId?: string;
};

export default function LeagueNav({ slug, isOwner, leagueId }: LeagueNavProps) {
  const { t } = useLang();
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!leagueId) return;
    loadPendingCount();

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
  }, [leagueId]);

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

  const mainNav: { href: string; label: string; badge: number }[] = [
    { href: `/league/${slug}`, label: t("联赛主页", "League Home"), badge: 0 },
    { href: `/league/${slug}/roster`, label: t("阵容", "Roster"), badge: 0 },
    { href: `/league/${slug}/free-agents`, label: t("自由市场", "Free Agents"), badge: 0 },
    { href: `/league/${slug}/trade`, label: t("交易", "Trade"), badge: pendingCount },
    { href: `/league/${slug}/standings`, label: t("排行榜", "Standings"), badge: 0 },
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
    <nav className="league-nav">
      <div className="league-nav-inner">
        {mainNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`league-nav-link ${isActive(item.href) ? "active" : ""}`}
          >
            <span className="nav-label">{item.label}</span>
            {item.badge > 0 && (
              <span className="trade-badge">{item.badge}</span>
            )}
          </Link>
        ))}
      </div>
      <style jsx>{`
        .league-nav { background: #fff; border-bottom: 1px solid #e5e7eb; position: sticky; top: 64px; z-index: 40; }
        .league-nav-inner { max-width: 1200px; margin: 0 auto; display: flex; gap: 4px; padding: 0 16px; overflow-x: auto; }
        .league-nav-link { display: flex; align-items: center; gap: 6px; padding: 12px 16px; color: #6b7280; text-decoration: none; font-size: 14px; font-weight: 500; border-bottom: 2px solid transparent; white-space: nowrap; position: relative; }
        .league-nav-link:hover { color: #111827; }
        .league-nav-link.active { color: #1e3a8a; border-bottom-color: #1e3a8a; font-weight: 600; }
        .trade-badge {
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          min-width: 18px;
          height: 18px;
          border-radius: 9px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
          line-height: 1;
          animation: badge-pulse 2s ease-in-out infinite;
        }
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
      `}</style>
    </nav>
  );
}
