// lib/ai/input-safety.ts
//
// Pure validation + sanitization helpers for the AI lineup-post route.
// No Supabase, no SDK, no framework imports — safe to unit-test.

export const MAX_CUSTOM_INSTRUCTION_LEN = 120;

export const TONE_VALUES = [
  "analytical",
  "casual",
  "trash_talk",
  "bold_prediction",
  "ask_advice",
] as const;
export type Tone = (typeof TONE_VALUES)[number];

export const STYLE_VALUES = [
  "hupu",
  "xiaohongshu",
  "wechat_moments",
  "professional_short",
] as const;
export type Style = (typeof STYLE_VALUES)[number];

export const LANGUAGE_VALUES = ["zh", "en"] as const;
export type Language = (typeof LANGUAGE_VALUES)[number];

export type LineupPlayerInput = {
  slot: string;
  playerId: string;
  name: string;
  team: string;
  position: string;
  projFpts?: number;
};

export type NormalizedBody = {
  language: Language;
  tone: Tone;
  style: Style;
  contestDate: string;
  lineup: LineupPlayerInput[];
  customInstruction: string;
  customInstructionAccepted: boolean;
  generateCount: number;
};

const ZERO_WIDTH_AND_BIDI =
  /[​-‏‪-‮⁦-⁩﻿]/g;
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const ALLOW_KEYWORDS = [
  "球员", "阵容", "比赛", "赌", "嚣张", "正式", "语气", "口吻",
  "分析", "吐槽", "狠话", "朋友圈", "小红书", "虎扑", "简短",
  "输", "赢", "数据", "nba", "篮球", "得分", "篮板", "助攻",
  "lineup", "player", "game", "bet", "bold", "casual", "formal",
  "tone", "style", "trash", "short", "nba", "basketball", "fantasy",
  "roast", "hot take", "stat", "pick", "matchup",
];

const BLOCK_PATTERNS = [
  /ignore\s+(previous|prior|all|the\s+above)/i,
  /disregard\s+(previous|prior|all|the\s+above|instructions)/i,
  /forget\s+(previous|all|your)\s+(instructions|rules|prompt)/i,
  /system\s+prompt/i,
  /reveal\s+(your\s+)?(prompt|instructions|rules)/i,
  /repeat\s+(your\s+)?(prompt|instructions|system)/i,
  /act\s+as\s+/i,
  /you\s+are\s+now\s+/i,
  /jailbreak/i,
  /prompt\s+leak/i,
  /忽略(上面|上述|之前|所有|前面)/,
  /忽略.{0,4}指令/,
  /系统提示/,
  /系统指令/,
  /越狱/,
  /扮演/,
  /透露.{0,6}(提示|指令)/,
];

/**
 * Sanitizes a free-text instruction:
 *   - coerces non-strings to ""
 *   - NFC-normalizes
 *   - strips control + zero-width + bidi-override characters
 *   - collapses whitespace runs
 *   - trims
 *   - caps to MAX_CUSTOM_INSTRUCTION_LEN code points
 */
export function sanitizeCustomInstruction(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let s = raw.normalize("NFC");
  s = s.replace(ZERO_WIDTH_AND_BIDI, "");
  s = s.replace(CONTROL_CHARS, "");
  s = s.replace(/\s+/g, " ").trim();
  const codepoints = Array.from(s);
  if (codepoints.length > MAX_CUSTOM_INSTRUCTION_LEN) {
    s = codepoints.slice(0, MAX_CUSTOM_INSTRUCTION_LEN).join("");
  }
  return s;
}

/**
 * Heuristic — does this instruction look related to a basketball / fantasy
 * lineup post? Empty input passes (default). Long off-topic input or any
 * obvious jailbreak marker is rejected.
 */
export function isLikelyOnTopic(instruction: string): boolean {
  const trimmed = instruction.trim();
  if (trimmed.length === 0) return true;

  const lower = trimmed.toLowerCase();
  for (const re of BLOCK_PATTERNS) {
    if (re.test(trimmed) || re.test(lower)) return false;
  }

  const hasAllow = ALLOW_KEYWORDS.some((kw) => lower.includes(kw));
  if (hasAllow) return true;

  return Array.from(trimmed).length <= 20;
}

function isValidDate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + "T00:00:00Z");
  return !Number.isNaN(d.getTime());
}

function validatePlayer(raw: unknown): LineupPlayerInput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const slot = typeof r.slot === "string" ? r.slot.trim() : "";
  const playerId = typeof r.playerId === "string" ? r.playerId.trim() : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const team = typeof r.team === "string" ? r.team.trim() : "";
  const position = typeof r.position === "string" ? r.position.trim() : "";
  if (!slot || !playerId || !name || !team || !position) return null;
  const out: LineupPlayerInput = { slot, playerId, name, team, position };
  if (typeof r.projFpts === "number" && Number.isFinite(r.projFpts)) {
    out.projFpts = Math.round(r.projFpts * 10) / 10;
  }
  return out;
}

export type ValidateResult =
  | { ok: true; value: NormalizedBody }
  | { ok: false; error: string; status: 400 };

export function validateGenerateBody(body: unknown): ValidateResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "INVALID_BODY", status: 400 };
  }
  const b = body as Record<string, unknown>;

  if (!LANGUAGE_VALUES.includes(b.language as Language)) {
    return { ok: false, error: "INVALID_LANGUAGE", status: 400 };
  }
  if (!TONE_VALUES.includes(b.tone as Tone)) {
    return { ok: false, error: "INVALID_TONE", status: 400 };
  }
  if (!STYLE_VALUES.includes(b.style as Style)) {
    return { ok: false, error: "INVALID_STYLE", status: 400 };
  }
  if (!isValidDate(b.contestDate)) {
    return { ok: false, error: "INVALID_CONTEST_DATE", status: 400 };
  }
  if (!Array.isArray(b.lineup) || b.lineup.length === 0) {
    return { ok: false, error: "EMPTY_LINEUP", status: 400 };
  }
  if (b.lineup.length > 16) {
    return { ok: false, error: "LINEUP_TOO_LARGE", status: 400 };
  }

  const lineup: LineupPlayerInput[] = [];
  for (const raw of b.lineup) {
    const p = validatePlayer(raw);
    if (!p) return { ok: false, error: "INVALID_LINEUP_PLAYER", status: 400 };
    lineup.push(p);
  }

  const sanitized = sanitizeCustomInstruction(b.customInstruction);
  const accepted = isLikelyOnTopic(sanitized);
  const customInstruction = accepted ? sanitized : "";

  let generateCount = 3;
  if (typeof b.generateCount === "number" && Number.isFinite(b.generateCount)) {
    generateCount = Math.max(1, Math.min(3, Math.floor(b.generateCount)));
  }

  return {
    ok: true,
    value: {
      language: b.language as Language,
      tone: b.tone as Tone,
      style: b.style as Style,
      contestDate: b.contestDate as string,
      lineup,
      customInstruction,
      customInstructionAccepted: accepted,
      generateCount,
    },
  };
}
