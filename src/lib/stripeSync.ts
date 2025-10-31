// src/lib/stripeSync.ts
import { prisma } from '@lib/db';
import { stripe } from '@lib/stripe';

type ReconStats = {
  organizations: number;
  invoicesUpserted: number;
  subscriptionsSynced: number;
};

function toInvStatus(s: string | null | undefined) {
  return (s?.toUpperCase() ?? 'OPEN') as any; // matches InvoiceStatus enum
}
function toSubStatus(s: string) {
  return s.toUpperCase() as any; // matches SubscriptionStatus enum
}

async function upsertInvoice(inv: Stripe.Invoice, organizationId: string) {
  await prisma.invoice.upsert({
    where: { stripeInvoiceId: inv.id },
    update: {
      currency: (inv.currency ?? 'usd').toUpperCase(),
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      status: toInvStatus(inv.status),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
    },
    create: {
      stripeInvoiceId: inv.id,
      currency: (inv.currency ?? 'usd').toUpperCase(),
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      status: toInvStatus(inv.status),
      dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
      periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
      periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
      hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
      organizationId,
    },
  });
}

async function syncSubscriptionForCustomer(orgId: string, customerId: string) {
  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 1 });
  if (!subs.data.length) return false;

  const sub = subs.data[0];
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
      organizationId: orgId,
    },
    create: {
      stripeSubscriptionId: sub.id,
      status: toSubStatus(sub.status),
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancel_at_period_end || false,
      organizationId: orgId,
    },
  });

  const active = ['active', 'trialing', 'past_due'].includes(sub.status);
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: active ? 'PRO' : 'FREE' },
  });

  return true;
}

export async function reconcileAll(): Promise<ReconStats> {
  const orgs = await prisma.organization.findMany({
    where: { stripeCustomerId: { not: null } },
    select: { id: true, stripeCustomerId: true },
  });

  let invoicesUpserted = 0;
  let subscriptionsSynced = 0;

  for (const org of orgs) {
    const customerId = org.stripeCustomerId!;
    // Paginate invoices for this customer
    let startingAfter: string | undefined = undefined;
    for (let pages = 0; pages < 20; pages++) {
      const list = await stripe.invoices.list({
        customer: customerId,
        limit: 100,
        starting_after: startingAfter,
      });
      for (const inv of list.data) {
        await upsertInvoice(inv, org.id);
        invoicesUpserted++;
      }
      if (!list.has_more) break;
      startingAfter = list.data[list.data.length - 1].id;
    }

    const subSynced = await syncSubscriptionForCustomer(org.id, customerId);
    if (subSynced) subscriptionsSynced++;
  }

  return { organizations: orgs.length, invoicesUpserted, subscriptionsSynced };
}
