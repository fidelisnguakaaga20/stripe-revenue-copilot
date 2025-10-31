// src/app/api/cron/reconcile/route.ts
import { NextResponse } from 'next/server';
import { reconcileAll } from '@lib/stripeSync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const key = process.env.CRON_SECRET;
  const header = request.headers.get('x-cron-key');
  if (!key || header !== key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stats = await reconcileAll();
  return NextResponse.json({ ok: true, ...stats });
}

export async function GET() {
  // Small convenience to avoid 405s when probing
  return NextResponse.json({ ok: true, endpoint: '/api/cron/reconcile' });
}
