import { NextResponse } from 'next/server';
import { createSession } from '@lib/auth';
import { prisma } from '@lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email') || 'owner@example.com';

  // Ensure user exists for dev convenience
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name: 'Dev User' } });
  }

  await createSession(email);
  return NextResponse.json({ ok: true, email });
}
