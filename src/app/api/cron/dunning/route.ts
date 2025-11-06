/// /api/cron/dunning — POST only

import { NextResponse } from "next/server";
import { runDunning } from "@lib/dunning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const key = process.env.CRON_SECRET;
  const header = request.headers.get("x-cron-key");
  if (!key || header !== key) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    const res = await runDunning();
    return NextResponse.json({ ok: true, ...res });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "dunning failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "/api/cron/dunning" });
}


