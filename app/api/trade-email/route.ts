export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

// POST /api/trade-email
// Sends email notification to the trade recipient
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      toEmail,
      toName,
      fromTeamName,
      toTeamName,
      leagueSlug,
      leagueName,
      offeredPlayers,
      requestedPlayers,
      message,
    } = body;

    if (!toEmail || !leagueSlug) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    // Build the trade link
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.headers.get("origin") || "http://localhost:3000";
    const tradeLink = `${baseUrl}/league/${leagueSlug}/trade?tab=pending`;

    // Build email HTML
    const offeredList = (offeredPlayers || []).map((p: string) => `<li style="padding:4px 0;color:#ef4444;">${p}</li>`).join("");
    const requestedList = (requestedPlayers || []).map((p: string) => `<li style="padding:4px 0;color:#10b981;">${p}</li>`).join("");
    const messageHtml = message ? `<p style="color:#888;font-style:italic;margin:16px 0;">"${message}"</p>` : "";

    const htmlContent = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:linear-gradient(135deg,#1a237e 0%,#0d1442 100%);padding:24px 32px;text-align:center;">
        <h1 style="margin:0;font-size:24px;color:#f59e0b;">🔄 New Trade Proposal</h1>
        <p style="margin:8px 0 0;color:#94a3b8;font-size:14px;">${leagueName || "Fantasy League"}</p>
      </div>
      <div style="padding:24px 32px;">
        <p style="font-size:16px;color:#e2e8f0;">Hi ${toName || "Manager"},</p>
        <p style="color:#94a3b8;">
          <strong style="color:#f59e0b;">${fromTeamName}</strong> has proposed a trade with your team <strong style="color:#f59e0b;">${toTeamName}</strong>.
        </p>

        <div style="display:flex;gap:16px;margin:20px 0;">
          <div style="flex:1;background:#111;border:1px solid #222;border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">They Send</div>
            <ul style="list-style:none;padding:0;margin:0;">${offeredList}</ul>
          </div>
          <div style="flex:1;background:#111;border:1px solid #222;border-radius:8px;padding:16px;">
            <div style="font-size:12px;color:#888;text-transform:uppercase;margin-bottom:8px;">They Want</div>
            <ul style="list-style:none;padding:0;margin:0;">${requestedList}</ul>
          </div>
        </div>

        ${messageHtml}

        <div style="text-align:center;margin:32px 0 16px;">
          <a href="${tradeLink}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000;text-decoration:none;border-radius:8px;font-weight:700;font-size:16px;">
            View Trade & Respond
          </a>
        </div>

        <p style="color:#555;font-size:12px;text-align:center;">
          Click the button above to accept or reject this trade in your league.
        </p>
      </div>
    </div>
    `;

    if (!RESEND_API_KEY) {
      // No email service configured - log and return success
      console.log("[trade-email] No RESEND_API_KEY set. Would send to:", toEmail);
      console.log("[trade-email] Trade link:", tradeLink);
      return NextResponse.json({
        ok: true,
        sent: false,
        message: "Email service not configured. Set RESEND_API_KEY to enable.",
        tradeLink,
      });
    }

    // Send via Resend API
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Fantasy Basketball <noreply@resend.dev>",
        to: [toEmail],
        subject: `🔄 ${fromTeamName} wants to trade with you! - ${leagueName || "Fantasy League"}`,
        html: htmlContent,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[trade-email] Resend error:", errText);
      return NextResponse.json({ ok: true, sent: false, message: "Email send failed" });
    }

    const result = await res.json();
    return NextResponse.json({ ok: true, sent: true, emailId: result.id, tradeLink });
  } catch (err) {
    console.error("[trade-email] Error:", err);
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
