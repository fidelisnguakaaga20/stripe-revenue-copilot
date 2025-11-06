// src/app/api/dev/send-test-email/route.ts
import { NextResponse } from "next/server";
import { sendMail } from "@lib/mailer"; // <-- MUST be @lib/mailer (your project uses this alias)

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * DEV-ONLY: send a test email using current SMTP env.
 * GET /api/dev/send-test-email?to=you@example.com
 * Header required: x-cron-key: <CRON_SECRET>
 */
export async function GET(req: Request) {
  try {
    const headerKey = req.headers.get("x-cron-key");
    const secret = process.env.CRON_SECRET || "";
    if (!secret || headerKey !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    if (!to) {
      return NextResponse.json({ ok: false, error: "Missing ?to=email@example.com" }, { status: 400 });
    }

    const out = await sendMail({
      to,
      subject: "SMTP Test — Stripe Revenue Copilot",
      text: "SMTP is working.",
      html: "<p><b>SMTP is working.</b></p>",
    });

    return NextResponse.json({ ok: true, out });
  } catch (e: any) {
    // Surface the exact problem (import error, SMTP auth, etc.)
    console.error("[send-test-email] error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
