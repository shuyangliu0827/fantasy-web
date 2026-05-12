"use client";

import { useLang } from "@/lib/lang";

type Visibility = "public" | "invite_only" | "private";

const CONFIG: Record<Visibility, { bg: string; fg: string; zh: string; en: string }> = {
  public: { bg: "#dcfce7", fg: "#166534", zh: "公开", en: "Public" },
  invite_only: { bg: "#fef3c7", fg: "#92400e", zh: "邀请制", en: "Invite-only" },
  private: { bg: "#fee2e2", fg: "#991b1b", zh: "私密", en: "Private" },
};

export default function LeagueVisibilityBadge({ visibility }: { visibility: Visibility }) {
  const { t } = useLang();
  const c = CONFIG[visibility] ?? CONFIG.invite_only;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 10px",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
      }}
    >
      {t(c.zh, c.en)}
    </span>
  );
}
