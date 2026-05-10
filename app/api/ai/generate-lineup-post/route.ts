// app/api/ai/generate-lineup-post/route.ts
//
// AI lineup-post generator. Given a tier-built DFS lineup + tone/style + an
// optional sanitized custom instruction, returns three distinct draft posts.
//
// Design rules:
//   - The route never imports DFS internals. It accepts a plain lineup array
//     shape (validated in lib/ai/input-safety.ts).
//   - Anthropic system prompt is sent with cache_control so repeated calls
//     hit prompt cache.
//   - Output JSON is strict; we re-prompt once on shape failure, then fail
//     with 502.
//   - Per-user in-memory rate limit: 5 requests / 60 s.
//
// Required env:
//   ANTHROPIC_API_KEY            (required)
//   AI_LINEUP_POST_MODEL         (optional, default claude-haiku-4-5-20251001)

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

import { getAuthUserId } from "@/lib/fantasy/daily/auth";
import { validateGenerateBody } from "@/lib/ai/posts/lineup-post/input-safety";
import {
  buildSystemPrompt,
  buildUserPrompt,
} from "@/lib/ai/posts/lineup-post/prompt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const REQUIRED_VERSION_STYLES = ["analysis", "casual", "bold"] as const;

type VersionStyle = (typeof REQUIRED_VERSION_STYLES)[number];
type Version = { style: VersionStyle; post: string };

// ── In-memory rate limit: 5 req / 60 s per user ─────────────────
const RL_WINDOW_MS = 60_000;
const RL_MAX = 5;
const rlBuckets = new Map<string, number[]>();

function rateLimit(userId: string): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - RL_WINDOW_MS;
  const arr = (rlBuckets.get(userId) ?? []).filter((t) => t > cutoff);
  if (arr.length >= RL_MAX) {
    const earliest = arr[0];
    return { ok: false, retryAfterSec: Math.ceil((earliest + RL_WINDOW_MS - now) / 1000) };
  }
  arr.push(now);
  rlBuckets.set(userId, arr);
  return { ok: true, retryAfterSec: 0 };
}

// ── Output parsing ──────────────────────────────────────────────

function extractFirstJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === "\\") { esc = true; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function parseVersions(text: string): Version[] | null {
  const json = extractFirstJsonObject(text);
  if (!json) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const versions = (parsed as { versions?: unknown }).versions;
  if (!Array.isArray(versions) || versions.length !== 3) return null;
  const seen = new Set<VersionStyle>();
  const out: Version[] = [];
  for (const v of versions) {
    if (!v || typeof v !== "object") return null;
    const r = v as Record<string, unknown>;
    const style = r.style;
    const post = r.post;
    if (typeof style !== "string" || typeof post !== "string") return null;
    if (!REQUIRED_VERSION_STYLES.includes(style as VersionStyle)) return null;
    if (seen.has(style as VersionStyle)) return null;
    if (post.trim().length === 0) return null;
    seen.add(style as VersionStyle);
    out.push({ style: style as VersionStyle, post });
  }
  if (seen.size !== 3) return null;
  return out;
}

// ── Anthropic call ──────────────────────────────────────────────

type CallArgs = {
  client: Anthropic;
  model: string;
  systemPrompt: string;
  userPrompt: string;
};

async function callClaude({ client, model, systemPrompt, userPrompt }: CallArgs): Promise<string> {
  const resp = await client.messages.create({
    model,
    max_tokens: 1500,
    temperature: 0.8,
    system: [
      {
        type: "text",
        text: systemPrompt,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });
  const parts: string[] = [];
  for (const block of resp.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("\n");
}

// ── Handler ─────────────────────────────────────────────────────

export async function POST(req: Request) {
  const userId = await getAuthUserId(req);
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "AI_NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  const rl = rateLimit(userId);
  if (!rl.ok) {
    return NextResponse.json(
      { ok: false, error: "RATE_LIMITED", retryAfterSec: rl.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }

  const validated = validateGenerateBody(body);
  if (!validated.ok) {
    return NextResponse.json(
      { ok: false, error: validated.error },
      { status: validated.status },
    );
  }
  const v = validated.value;

  const systemPrompt = buildSystemPrompt(v.language);
  const userPrompt = buildUserPrompt({
    language: v.language,
    lineup: v.lineup,
    contestDate: v.contestDate,
    tone: v.tone,
    style: v.style,
    customInstruction: v.customInstruction,
    generateCount: v.generateCount,
  });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const model = process.env.AI_LINEUP_POST_MODEL || DEFAULT_MODEL;

  let text: string;
  try {
    text = await callClaude({ client, model, systemPrompt, userPrompt });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    return NextResponse.json(
      { ok: false, error: "AI_UPSTREAM_ERROR", detail: message },
      { status: 502 },
    );
  }

  let versions = parseVersions(text);

  if (!versions) {
    // One retry with an explicit shape reminder.
    const reminder =
      v.language === "zh"
        ? "上一次输出格式不符。请只返回严格 JSON，不要 markdown 围栏。"
        : "Previous output had the wrong shape. Return STRICT JSON only, no markdown fence.";
    try {
      text = await callClaude({
        client,
        model,
        systemPrompt,
        userPrompt: userPrompt + "\n\n" + reminder,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      return NextResponse.json(
        { ok: false, error: "AI_UPSTREAM_ERROR", detail: message },
        { status: 502 },
      );
    }
    versions = parseVersions(text);
  }

  if (!versions) {
    return NextResponse.json({ ok: false, error: "AI_OUTPUT_SHAPE" }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    versions,
    customInstructionAccepted: v.customInstructionAccepted,
  });
}
