// lib/i18n/labels.ts
//
// Centralized display-label helpers for enum / fixed string values that
// appear across the UI. These functions ONLY transform display labels —
// they never alter the underlying enum / DB value.
//
// Argument convention: `(value, lang)` to match the existing helpers in
// lib/basketball/role-labels.ts and lib/basketball/status-labels.ts.
//
// Usage:
//   import { useLang } from "@/lib/lang";
//   import { visibilityLabel } from "@/lib/i18n/labels";
//   const { lang } = useLang();
//   <span>{visibilityLabel(league.visibility, lang)}</span>
//
// For league/game status and basketball member role, prefer the existing
// helpers in lib/basketball/*; this file re-exports them so callers can
// import everything from one place.

export type Lang = "zh" | "en";

export {
  leagueStatusLabel,
  gameStatusLabel,
} from "@/lib/basketball/status-labels";

export {
  memberRoleLabel,
  MEMBER_ROLE_VALUES,
} from "@/lib/basketball/role-labels";

const norm = (v: unknown): string =>
  typeof v === "string" ? v.trim().toLowerCase() : "";

// ---------------------------------------------------------------------------
// Visibility (basketball_leagues.visibility)
// ---------------------------------------------------------------------------

const VISIBILITY_ZH: Record<string, string> = {
  public: "公开",
  invite_only: "仅邀请",
  private: "私密",
};
const VISIBILITY_EN: Record<string, string> = {
  public: "Public",
  invite_only: "Invite only",
  private: "Private",
};

export function visibilityLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? VISIBILITY_ZH[v] : VISIBILITY_EN[v]) ?? String(value ?? "");
}

// ---------------------------------------------------------------------------
// Member status (basketball_league_members.status)
// ---------------------------------------------------------------------------

const MEMBER_STATUS_ZH: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  removed: "已移除",
};
const MEMBER_STATUS_EN: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  removed: "Removed",
};

export function memberStatusLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? MEMBER_STATUS_ZH[v] : MEMBER_STATUS_EN[v]) ?? String(value ?? "");
}

// ---------------------------------------------------------------------------
// Player claim status (basketball_players.claim_status)
// ---------------------------------------------------------------------------

const CLAIM_STATUS_ZH: Record<string, string> = {
  unclaimed: "未认领",
  pending: "待审核",
  approved: "已审核",
  rejected: "已拒绝",
};
const CLAIM_STATUS_EN: Record<string, string> = {
  unclaimed: "Unclaimed",
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export function claimStatusLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? CLAIM_STATUS_ZH[v] : CLAIM_STATUS_EN[v]) ?? String(value ?? "");
}

// ---------------------------------------------------------------------------
// Contest / entry lifecycle status
// ---------------------------------------------------------------------------

const CONTEST_STATUS_ZH: Record<string, string> = {
  created: "已创建",
  open: "已开放",
  locked: "已锁定",
  settled: "已结算",
  scored: "已结算",
  active: "已启用",
  inactive: "未启用",
  pending: "待审核",
  draft: "草稿",
  completed: "已完成",
  cancelled: "已取消",
  canceled: "已取消",
};
const CONTEST_STATUS_EN: Record<string, string> = {
  created: "Created",
  open: "Open",
  locked: "Locked",
  settled: "Settled",
  scored: "Scored",
  active: "Active",
  inactive: "Inactive",
  pending: "Pending",
  draft: "Draft",
  completed: "Completed",
  cancelled: "Cancelled",
  canceled: "Cancelled",
};

export function contestStatusLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? CONTEST_STATUS_ZH[v] : CONTEST_STATUS_EN[v]) ?? String(value ?? "");
}

// ---------------------------------------------------------------------------
// Action labels (button text)
// ---------------------------------------------------------------------------

const ACTION_ZH: Record<string, string> = {
  claim: "认领",
  approve: "通过",
  reject: "拒绝",
  remove: "移除",
  invite: "邀请",
  "invite and approve": "邀请并通过",
  invite_and_approve: "邀请并通过",
  "request access": "申请权限",
  request_access: "申请权限",
  cancel: "取消",
  save: "保存",
  edit: "编辑",
  delete: "删除",
};
const ACTION_EN: Record<string, string> = {
  claim: "Claim",
  approve: "Approve",
  reject: "Reject",
  remove: "Remove",
  invite: "Invite",
  "invite and approve": "Invite and approve",
  invite_and_approve: "Invite and approve",
  "request access": "Request access",
  request_access: "Request access",
  cancel: "Cancel",
  save: "Save",
  edit: "Edit",
  delete: "Delete",
};

export function actionLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? ACTION_ZH[v] : ACTION_EN[v]) ?? String(value ?? "");
}

// ---------------------------------------------------------------------------
// Basketball positions
//
// Combined positions like "PG/SG", "G/F" are split on "/" or "-" and each
// segment is translated individually, so "PG/SG" → "控卫 / 分卫".
// English mode returns the raw code unchanged.
// ---------------------------------------------------------------------------

const POSITION_ZH: Record<string, string> = {
  PG: "控卫",
  SG: "分卫",
  SF: "小前",
  PF: "大前",
  C: "中锋",
  G: "后卫",
  F: "前锋",
  UTIL: "任意位置",
  UTIL1: "任意位置",
  UTIL2: "任意位置",
  UTIL3: "任意位置",
  BE: "替补",
  BE1: "替补",
  BE2: "替补",
  BE3: "替补",
  BENCH: "替补",
};

export function positionLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (lang === "en") return raw;
  const parts = raw.split(/\s*[\/\-]\s*/);
  const mapped = parts.map((p) => POSITION_ZH[p.toUpperCase()] ?? p);
  return mapped.join(" / ");
}

// ---------------------------------------------------------------------------
// Contest / feature labels (UI chrome strings, not enum values)
// ---------------------------------------------------------------------------

const FEATURE_ZH: Record<string, string> = {
  "daily contest": "每日竞赛",
  daily_contest: "每日竞赛",
  "public contest": "公开竞赛",
  public_contest: "公开竞赛",
  "community league": "社区联赛",
  community_league: "社区联赛",
  lineup: "阵容",
  leaderboard: "排行榜",
  "submit lineup": "提交阵容",
  submit_lineup: "提交阵容",
  "claim player": "认领球员",
  claim_player: "认领球员",
  "player claim": "球员认领",
  player_claim: "球员认领",
};
const FEATURE_EN: Record<string, string> = {
  "daily contest": "Daily contest",
  daily_contest: "Daily contest",
  "public contest": "Public contest",
  public_contest: "Public contest",
  "community league": "Community league",
  community_league: "Community league",
  lineup: "Lineup",
  leaderboard: "Leaderboard",
  "submit lineup": "Submit lineup",
  submit_lineup: "Submit lineup",
  "claim player": "Claim player",
  claim_player: "Claim player",
  "player claim": "Player claim",
  player_claim: "Player claim",
};

export function featureLabel(
  value: string | null | undefined,
  lang: Lang,
): string {
  const v = norm(value);
  return (lang === "zh" ? FEATURE_ZH[v] : FEATURE_EN[v]) ?? String(value ?? "");
}
