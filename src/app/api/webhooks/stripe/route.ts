// src/app/api/webhooks/stripe/route.ts
import { NextResponse } from 'next/server';
import { stripe } from '@lib/stripe';
import { prisma } from '@lib/db';

async function getOrgIdFromCustomerId(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const customer = await stripe.customers.retrieve(customerId);
  if (customer && typeof customer !== 'string') {
    return (customer.metadata?.orgId as string) || null;
  }
  return null;
}

async function upsertSubscriptionFromStripe(sub: any, orgId: string | null) {
  const priceId = sub.items?.data?.[0]?.price?.id ?? '';
  const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
  const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
  const status = (sub.status || 'incomplete').toUpperCase();

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status,
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      organizationId: orgId || undefined,
    },
    create: {
      stripeSubscriptionId: sub.id,
      status,
      priceId,
      currentPeriodStart: currentPeriodStart!,
      currentPeriodEnd: currentPeriodEnd!,
      cancelAtPeriodEnd,
      organizationId: orgId || undefined,
    },
  });

  if (orgId) {
    const active = ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(status);
    await prisma.organization.update({
      where: { id: orgId },
      data: { plan: active ? 'PRO' : 'FREE' },
    });
  }
}

async function upsertInvoiceFromStripe(inv: any, orgId: string | null) {
  const hostedInvoiceUrl = inv.hosted_invoice_url || '';
  const status = (inv.status || 'open').toUpperCase();
  const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : null;

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: inv.id },
    update: {
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      currency: inv.currency ?? 'usd',
      hostedInvoiceUrl,
      status,
      dueDate,
      organizationId: orgId || undefined,
    },
    create: {
      stripeInvoiceId: inv.id,
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      currency: inv.currency ?? 'usd',
      hostedInvoiceUrl,
      status,
      dueDate,
      organizationId: orgId || undefined,
    },
  });
}

async function logEvent(orgId: string | null, type: string, id: string) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: orgId || undefined,
        action: type,
        meta: JSON.stringify({ id }),
      },
    });
  } catch {}
}

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) {
    return NextResponse.json({ error: 'Missing signature/secret' }, { status: 400 });
  }

  let event: any;
  try {
    const body = await req.text(); // raw body required
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  const type = event.type as string;
  try {
    switch (type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const orgId = await getOrgIdFromCustomerId(sub.customer as string);
        await upsertSubscriptionFromStripe(sub, orgId);
        await logEvent(orgId, type, sub.id);
        break;
      }
      case 'invoice.finalized':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.marked_uncollectible': {
        const inv = event.data.object;
        const orgId = await getOrgIdFromCustomerId(inv.customer as string);
        await upsertInvoiceFromStripe(inv, orgId);
        await logEvent(orgId, type, inv.id);
        break;
      }
      default:
        // ignore others
        break;
    }
    return NextResponse.json({ received: true, type });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 500 });
  }
}
