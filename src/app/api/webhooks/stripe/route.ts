// src/app/api/webhooks/stripe/route.ts
/* 
  Stripe Webhooks — subscriptions + invoices
  Events handled:
    - checkout.session.completed
    - customer.subscription.created | updated | deleted
    - invoice.created | updated | paid | payment_failed | voided | uncollectible
  Notes:
    - Requires STRIPE_WEBHOOK_SECRET (set on Vercel → Environment Variables)
    - Runtime must be Node.js for Stripe SDK
*/

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { stripe } from '@lib/stripe';
import { prisma } from '@lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toSubStatus(s: string) {
  return s.toUpperCase() as any; // matches SubscriptionStatus enum in Prisma
}

function toInvStatus(s: string) {
  return s.toUpperCase() as any; // matches InvoiceStatus enum in Prisma
}

async function setOrgPlanFromSubscriptionStatus(organizationId: string, status: string) {
  const active = ['active', 'trialing', 'past_due'].includes(status);
  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan: active ? 'PRO' : 'FREE' },
  });
}

async function upsertSubscriptionByStripeId(opts: {
  orgId: string;
  stripeSubscriptionId: string;
}) {
  const sub = await stripe.subscriptions.retrieve(opts.stripeSubscriptionId);
  const priceId = sub.items.data[0]?.price?.id ?? '';
  const currentPeriodStart = new Date(sub.current_period_start * 1000);
  const currentPeriodEnd = new Date(sub.current_period_end * 1000);

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status: toSubStatus(sub.status),
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      organizationId: opts.orgId,
    },
    create: {
      stripeSubscriptionId: sub.id,
      status: toSubStatus(sub.status),
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      organizationId: opts.orgId,
    },
  });

  await setOrgPlanFromSubscriptionStatus(opts.orgId, sub.status);
}

async function upsertInvoiceByStripe(obj: Stripe.Invoice, orgId: string) {
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: obj.id },
    update: {
      currency: obj.currency?.toUpperCase() ?? 'USD',
      amountDue: obj.amount_due ?? 0,
      amountPaid: obj.amount_paid ?? 0,
      status: toInvStatus(obj.status ?? 'OPEN'),
      dueDate: obj.due_date ? new Date(obj.due_date * 1000) : null,
      periodStart: obj.period_start ? new Date(obj.period_start * 1000) : null,
      periodEnd: obj.period_end ? new Date(obj.period_end * 1000) : null,
    },
    create: {
      stripeInvoiceId: obj.id,
      currency: obj.currency?.toUpperCase() ?? 'USD',
      amountDue: obj.amount_due ?? 0,
      amountPaid: obj.amount_paid ?? 0,
      status: toInvStatus(obj.status ?? 'OPEN'),
      dueDate: obj.due_date ? new Date(obj.due_date * 1000) : null,
      periodStart: obj.period_start ? new Date(obj.period_start * 1000) : null,
      periodEnd: obj.period_end ? new Date(obj.period_end * 1000) : null,
      organizationId: orgId,
    },
  });
}

async function orgIdByCustomer(customerId: string | null | undefined) {
  if (!customerId) return null;
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

export async function POST(req: Request) {
  const sig = (await headers()).get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    // You said you’ll set this on Vercel — keep the endpoint locked until then.
    return NextResponse.json({ error: 'STRIPE_WEBHOOK_SECRET not set' }, { status: 400 });
  }
  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature' }, { status: 400 });
  }

  // Obtain raw body for signature verification
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription?.id;

        const customerId =
          typeof session.customer === 'string'
            ? session.customer
            : session.customer?.id;

        const orgId = await orgIdByCustomer(customerId);
        if (orgId && subId) {
          await upsertSubscriptionByStripeId({ orgId, stripeSubscriptionId: subId });
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
        const orgId = await orgIdByCustomer(customerId);
        if (orgId) {
          await upsertSubscriptionByStripeId({ orgId, stripeSubscriptionId: sub.id });
        }
        break;
      }

      case 'invoice.created':
      case 'invoice.updated':
      case 'invoice.paid':
      case 'invoice.payment_failed':
      case 'invoice.voided':
      case 'invoice.uncollectible': {
        const inv = event.data.object as Stripe.Invoice;
        const customerId =
          typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
        const orgId = await orgIdByCustomer(customerId);
        if (orgId) {
          await upsertInvoiceByStripe(inv, orgId);
        }
        break;
      }

      default:
        // Ignore unrelated events safely
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    // Fail closed but return 200 so Stripe doesn't retry forever on app bugs — we log to DB
    await prisma.auditLog.create({
      data: {
        organizationId: 'unknown',
        action: 'webhook.error',
        metadata: { type: event.type, message: err?.message ?? 'unknown' },
      },
    }).catch(() => {});
    return NextResponse.json({ error: 'Webhook handler error' }, { status: 200 });
  }
}
