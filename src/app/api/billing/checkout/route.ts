import { NextResponse } from 'next/server';
import { stripe } from '@lib/stripe';
import { prisma } from '@lib/db';
import { getSessionUser } from '@lib/auth';

export async function POST(request: Request) {
  const url = new URL(request.url);
  const orgId = url.searchParams.get('orgId');
  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const member = user.memberships.find((m) => m.organizationId === orgId);
  if (!member) return NextResponse.json({ error: 'Not a member' }, { status: 403 });

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const priceId = process.env.STRIPE_PRICE_ID_PRO_MONTHLY;
  if (!priceId) return NextResponse.json({ error: 'STRIPE_PRICE_ID_PRO_MONTHLY not set' }, { status: 500 });

  // Ensure Stripe customer
  let customerId = org.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: org.name,
      metadata: { orgId: org.id },
    });
    customerId = customer.id;
    await prisma.organization.update({
      where: { id: org.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const success = `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}&orgId=${org.id}`;
  const cancel = `${base}/pricing`;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: success,
    cancel_url: cancel,
  });

  return NextResponse.redirect(session.url!, { status: 303 });
}
