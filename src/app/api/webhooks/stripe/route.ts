// /// Stripe webhook handler: keeps your DB in sync with Stripe events in prod.
// /// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in env.
// /// In Stripe Dashboard, set the endpoint to: https://YOUR-APP.vercel.app/api/webhooks/stripe

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs"; // /// ensure Node runtime for raw body access
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20", // /// keep pinned
});

const prisma = new PrismaClient();

async function findOrgByCustomerId(customerId: string) {
  return prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
}

export async function POST(req: NextRequest) {
  // /// 1) Verify signature
  const rawBody = await req.text(); // /// raw string body (required for Stripe)
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    return NextResponse.json({ error: `Signature error: ${err.message}` }, { status: 400 });
  }

  // /// 2) Route by type
  try {
    switch (event.type) {
      case "invoice.created":
      case "invoice.finalized":
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice;
        const org = inv.customer ? await findOrgByCustomerId(inv.customer as string) : null;
        if (!org) break;

        await prisma.invoice.upsert({
          where: { stripeInvoiceId: inv.id },
          update: {
            organizationId: org.id,
            amountDue: inv.amount_due ?? 0,
            amountPaid: inv.amount_paid ?? 0,
            currency: (inv.currency ?? "usd").toUpperCase(),
            status: (inv.status ?? "draft").toUpperCase() as any,
            dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
            periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
            periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          },
          create: {
            stripeInvoiceId: inv.id,
            organizationId: org.id,
            amountDue: inv.amount_due ?? 0,
            amountPaid: inv.amount_paid ?? 0,
            currency: (inv.currency ?? "usd").toUpperCase(),
            status: (inv.status ?? "draft").toUpperCase() as any,
            dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
            periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
            periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
            hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
          },
        });
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const org = sub.customer ? await findOrgByCustomerId(sub.customer as string) : null;
        if (!org) break;

        const status = (sub.status ?? "incomplete").toUpperCase() as any;
        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          update: {
            organizationId: org.id,
            status,
            priceId: typeof sub.items?.data?.[0]?.price?.id === "string"
              ? sub.items.data[0].price.id
              : null,
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : null,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          },
          create: {
            stripeSubscriptionId: sub.id,
            organizationId: org.id,
            status,
            priceId: typeof sub.items?.data?.[0]?.price?.id === "string"
              ? sub.items.data[0].price.id
              : null,
            currentPeriodStart: sub.current_period_start
              ? new Date(sub.current_period_start * 1000)
              : null,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          },
        });
        break;
      }

      default:
        // /// Not critical to handle other events now
        break;
    }

    // /// Optional: store compact audit log for dunning chart freshness
    await prisma.auditLog.create({
      data: {
        organizationId:
          (event.data.object as any)?.customer &&
          (await findOrgByCustomerId((event.data.object as any).customer))?.id || null,
        action: event.type,
        metadata: { id: event.id },
      },
    }).catch(() => { /* non-blocking */ });

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}



// import type { Stripe } from 'stripe';
// import { NextResponse } from 'next/server';
// import { stripe } from '@lib/stripe';
// import { prisma } from '@lib/db';

// export const runtime = 'nodejs';
// export const dynamic = 'force-dynamic';

// async function getOrgIdFromCustomerId(customerId: string): Promise<string | null> {
//   if (!customerId) return null;

//   // Stripe v14 returns Stripe.Response<Stripe.Customer | Stripe.DeletedCustomer>
//   const res = await stripe.customers.retrieve(customerId);
//   const obj = res as Stripe.Customer | Stripe.DeletedCustomer;

//   // If deleted, there is no metadata
//   if ('deleted' in obj && obj.deleted) return null;

//   const md = (obj as Stripe.Customer).metadata;
//   const orgId = (md?.orgId as string | undefined) ?? null;
//   return orgId;
// }

// async function upsertSubscriptionFromStripe(sub: any, orgId: string | null) {
//   if (!orgId) return; // require orgId to satisfy schema
//   const priceId = sub.items?.data?.[0]?.price?.id ?? '';
//   const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : null;
//   const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
//   const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
//   const status = (sub.status || 'incomplete').toUpperCase();

//   await prisma.subscription.upsert({
//     where: { stripeSubscriptionId: sub.id },
//     update: {
//       status,
//       priceId,
//       currentPeriodStart: currentPeriodStart!,
//       currentPeriodEnd: currentPeriodEnd!,
//       cancelAtPeriodEnd,
//       organizationId: orgId
//     },
//     create: {
//       stripeSubscriptionId: sub.id,
//       status,
//       priceId,
//       currentPeriodStart: currentPeriodStart!,
//       currentPeriodEnd: currentPeriodEnd!,
//       cancelAtPeriodEnd,
//       organizationId: orgId
//     },
//   });

//   const active = ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(status);
//   await prisma.organization.update({
//     where: { id: orgId },
//     data: { plan: active ? 'PRO' : 'FREE' },
//   });
// }

// async function upsertInvoiceFromStripe(inv: any, orgId: string | null) {
//   if (!orgId) return; // require orgId to satisfy schema
//   const hostedInvoiceUrl = inv.hosted_invoice_url || '';
//   const status = (inv.status || 'open').toUpperCase();
//   const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : null;

//   await prisma.invoice.upsert({
//     where: { stripeInvoiceId: inv.id },
//     update: {
//       amountDue: inv.amount_due ?? 0,
//       amountPaid: inv.amount_paid ?? 0,
//       currency: inv.currency ?? 'usd',
//       hostedInvoiceUrl,
//       status,
//       dueDate,
//       organizationId: orgId
//     },
//     create: {
//       stripeInvoiceId: inv.id,
//       amountDue: inv.amount_due ?? 0,
//       amountPaid: inv.amount_paid ?? 0,
//       currency: inv.currency ?? 'usd',
//       hostedInvoiceUrl,
//       status,
//       dueDate,
//       organizationId: orgId
//     },
//   });
// }

// async function logEvent(orgId: string | null, type: string, id: string) {
//   try {
//     if (!orgId) return;
//     await prisma.auditLog.create({
//       data: {
//         organizationId: orgId,
//         action: type,
//         metadata: { id } // Prisma schema uses `metadata Json?`
//       },
//     });
//   } catch {}
// }

// export async function POST(req: Request) {
//   const sig = req.headers.get('stripe-signature');
//   const secret = process.env.STRIPE_WEBHOOK_SECRET;
//   if (!sig || !secret) {
//     return NextResponse.json({ error: 'Missing signature/secret' }, { status: 400 });
//   }

//   let event: any;
//   try {
//     const body = await req.text(); // raw body required
//     event = stripe.webhooks.constructEvent(body, sig, secret);
//   } catch (err: any) {
//     return NextResponse.json({ error: `Invalid signature: ${err.message}` }, { status: 400 });
//   }

//   try {
//     switch (event.type as string) {
//       case 'customer.subscription.created':
//       case 'customer.subscription.updated':
//       case 'customer.subscription.deleted': {
//         const sub = event.data.object;
//         const orgId = await getOrgIdFromCustomerId(sub.customer as string);
//         await upsertSubscriptionFromStripe(sub, orgId);
//         await logEvent(orgId, event.type, sub.id);
//         break;
//       }
//       case 'invoice.finalized':
//       case 'invoice.paid':
//       case 'invoice.payment_failed':
//       case 'invoice.voided':
//       case 'invoice.marked_uncollectible': {
//         const inv = event.data.object;
//         const orgId = await getOrgIdFromCustomerId(inv.customer as string);
//         await upsertInvoiceFromStripe(inv, orgId);
//         await logEvent(orgId, event.type, inv.id);
//         break;
//       }
//       default:
//         break;
//     }
//     return NextResponse.json({ received: true, type: event.type });
//   } catch (err: any) {
//     return NextResponse.json({ error: err.message || 'Webhook error' }, { status: 500 });
//   }
// }
