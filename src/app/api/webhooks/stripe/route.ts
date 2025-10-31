import type { Stripe } from 'stripe';
import { NextResponse } from 'next/server';
import { stripe } from '@lib/stripe';
import { prisma } from '@lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getOrgIdFromCustomerId(customerId: string): Promise<string | null> {
  if (!customerId) return null;

  // Stripe v14 returns Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>
  const res = await stripe.customers.retrieve(customerId);
  const obj = res as Stripe.Customer | Stripe.DeletedCustomer;

  // If deleted, there is no metadata
  if ('deleted' in obj && obj.deleted) return null;

  const md = (obj as Stripe.Customer).metadata;
  const orgId = (md?.orgId as string | undefined) ?? null;
  return orgId;
}

async function upsertSubscriptionFromStripe(sub: any, orgId: string | null) {
  if (!orgId) return; // require orgId to satisfy schema
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
      currentPeriodStart: currentPeriodStart!,
      currentPeriodEnd: currentPeriodEnd!,
      cancelAtPeriodEnd,
      organizationId: orgId
    },
    create: {
      stripeSubscriptionId: sub.id,
      status,
      priceId,
      currentPeriodStart: currentPeriodStart!,
      currentPeriodEnd: currentPeriodEnd!,
      cancelAtPeriodEnd,
      organizationId: orgId
    },
  });

  const active = ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(status);
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: active ? 'PRO' : 'FREE' },
  });
}

async function upsertInvoiceFromStripe(inv: any, orgId: string | null) {
  if (!orgId) return; // require orgId to satisfy schema
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
      organizationId: orgId
    },
    create: {
      stripeInvoiceId: inv.id,
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      currency: inv.currency ?? 'usd',
      hostedInvoiceUrl,
      status,
      dueDate,
      organizationId: orgId
    },
  });
}

async function logEvent(orgId: string | null, type: string, id: string) {
  try {
    if (!orgId) return;
    await prisma.auditLog.create({
      data: {
        organizationId: orgId,
        action: type,
        metadata: { id } // Prisma schema uses `metadata Json?`
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

  try {
    switch (event.type as string) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const orgId = await getOrgIdFromCustomerId(sub.customer as string);
        await upsertSubscriptionFromStripe(sub, orgId);
        await logEvent(orgId, event.type, sub.id);
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
        await logEvent(orgId, event.type, inv.id);
        break;
      }
      default:
        break;
    }
    return NextResponse.json({ received: true, type: event.type });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 500 });
  }
}
