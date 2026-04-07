export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
);

export async function POST() {
  const requestedAt = new Date().toISOString();

  let source: "edge_function" | "api_fallback" = "edge_function";
  let edgeResponse: unknown = null;

  try {
    const { data, error } = await supabase.functions.invoke("refresh-nba-stats", {
      body: { reason: "manual_refresh_endpoint" },
    });

    if (error) {
      source = "api_fallback";
      edgeResponse = { status: "invoke_failed", message: error.message };
    } else {
      edgeResponse = data;
    }
  } catch {
    source = "api_fallback";
    edgeResponse = { status: "refresh_started" };
  }

  await supabase
    .from("stats_cursor")
    .upsert({ id: 1, last_run_at: requestedAt }, { onConflict: "id" });

  return NextResponse.json(
    {
      status: "ok",
      source,
      requestedAt,
      edgeResponse,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
