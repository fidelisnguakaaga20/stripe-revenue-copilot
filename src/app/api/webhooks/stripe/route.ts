// /// Stripe webhook handler: keeps your DB in sync with Stripe events in prod.
// /// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in env.
// /// In Stripe Dashboard, set the endpoint to: https://YOUR-APP.vercel.app/api/webhooks/stripe

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

export const runtime = "nodejs"; // ensure Node runtime for raw body access
export const dynamic = "force-dynamic";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2023-10-16",
});

const prisma = new PrismaClient();

async function findOrgByCustomerId(customerId: string) {
  return prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
  });
}

export async function POST(req: NextRequest) {
  // 1) Verify signature
  const rawBody = await req.text(); // raw string body (required for Stripe)
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

  // 2) Route by type
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

        // Compute values once; NEVER write nulls to required Prisma fields
        const item0 = sub.items?.data?.[0];
        const priceId =
          typeof item0?.price?.id === "string" ? item0.price.id : "";

        const currentPeriodStart = sub.current_period_start
          ? new Date(sub.current_period_start * 1000)
          : new Date();
        const currentPeriodEnd = sub.current_period_end
          ? new Date(sub.current_period_end * 1000)
          : new Date();

        await prisma.subscription.upsert({
          where: { stripeSubscriptionId: sub.id },
          update: {
            organizationId: org.id,
            status,
            // only write priceId if we have a non-empty string
            ...(priceId ? { priceId } : {}),
            // only update period dates if Stripe sent them (otherwise leave unchanged)
            ...(sub.current_period_start ? { currentPeriodStart } : {}),
            ...(sub.current_period_end ? { currentPeriodEnd } : {}),
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          },
          create: {
            stripeSubscriptionId: sub.id,
            organizationId: org.id,
            status,
            // required string on create; empty string is acceptable fallback
            priceId,
            // required DateTime on create; fallback to now if Stripe omitted
            currentPeriodStart,
            currentPeriodEnd,
            cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
          },
        });
        break;
      }

      default:
        // Not critical to handle other events now
        break;
    }

    // Optional audit log (only if we can resolve an org id)
    try {
      const obj: any = event.data.object as any;
      const customerId: string | undefined =
        typeof obj?.customer === "string" ? obj.customer : undefined;
      if (customerId) {
        const org = await findOrgByCustomerId(customerId);
        if (org?.id) {
          await prisma.auditLog.create({
            data: {
              organizationId: org.id,
              action: event.type,
              metadata: { id: event.id },
            },
          });
        }
      }
    } catch {
      // non-blocking
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}





// // /// Stripe webhook handler: keeps your DB in sync with Stripe events in prod.
// // /// Requires STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in env.
// // /// In Stripe Dashboard, set the endpoint to: https://YOUR-APP.vercel.app/api/webhooks/stripe

// import { NextRequest, NextResponse } from "next/server";
// import Stripe from "stripe";
// import { PrismaClient } from "@prisma/client";

// export const runtime = "nodejs"; // /// ensure Node runtime for raw body access
// export const dynamic = "force-dynamic";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
//  apiVersion: "2023-10-16",
// });

// const prisma = new PrismaClient();

// async function findOrgByCustomerId(customerId: string) {
//   return prisma.organization.findFirst({
//     where: { stripeCustomerId: customerId },
//   });
// }

// export async function POST(req: NextRequest) {
//   // /// 1) Verify signature
//   const rawBody = await req.text(); // /// raw string body (required for Stripe)
//   const sig = req.headers.get("stripe-signature");
//   if (!sig) return NextResponse.json({ error: "No signature" }, { status: 400 });

//   let event: Stripe.Event;
//   try {
//     event = stripe.webhooks.constructEvent(
//       rawBody,
//       sig,
//       process.env.STRIPE_WEBHOOK_SECRET!
//     );
//   } catch (err: any) {
//     return NextResponse.json({ error: `Signature error: ${err.message}` }, { status: 400 });
//   }

//   // /// 2) Route by type
//   try {
//     switch (event.type) {
//       case "invoice.created":
//       case "invoice.finalized":
//       case "invoice.payment_succeeded":
//       case "invoice.payment_failed": {
//         const inv = event.data.object as Stripe.Invoice;
//         const org = inv.customer ? await findOrgByCustomerId(inv.customer as string) : null;
//         if (!org) break;

//         await prisma.invoice.upsert({
//           where: { stripeInvoiceId: inv.id },
//           update: {
//             organizationId: org.id,
//             amountDue: inv.amount_due ?? 0,
//             amountPaid: inv.amount_paid ?? 0,
//             currency: (inv.currency ?? "usd").toUpperCase(),
//             status: (inv.status ?? "draft").toUpperCase() as any,
//             dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
//             periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
//             periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
//             hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
//           },
//           create: {
//             stripeInvoiceId: inv.id,
//             organizationId: org.id,
//             amountDue: inv.amount_due ?? 0,
//             amountPaid: inv.amount_paid ?? 0,
//             currency: (inv.currency ?? "usd").toUpperCase(),
//             status: (inv.status ?? "draft").toUpperCase() as any,
//             dueDate: inv.due_date ? new Date(inv.due_date * 1000) : null,
//             periodStart: inv.period_start ? new Date(inv.period_start * 1000) : null,
//             periodEnd: inv.period_end ? new Date(inv.period_end * 1000) : null,
//             hostedInvoiceUrl: inv.hosted_invoice_url ?? null,
//           },
//         });
//         break;
//       }

//       case "customer.subscription.created":
//       case "customer.subscription.updated":
//       case "customer.subscription.deleted": {
//         const sub = event.data.object as Stripe.Subscription;
//         const org = sub.customer ? await findOrgByCustomerId(sub.customer as string) : null;
//         if (!org) break;

//         const status = (sub.status ?? "incomplete").toUpperCase() as any;
//         await prisma.subscription.upsert({
//           where: { stripeSubscriptionId: sub.id },
//           update: {
//             organizationId: org.id,
//             status,
//             priceId: typeof sub.items?.data?.[0]?.price?.id === "string"
//               ? sub.items.data[0].price.id
//               : null,
//             currentPeriodStart: sub.current_period_start
//               ? new Date(sub.current_period_start * 1000)
//               : null,
//             currentPeriodEnd: sub.current_period_end
//               ? new Date(sub.current_period_end * 1000)
//               : null,
//             cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
//           },
//           create: {
//             stripeSubscriptionId: sub.id,
//             organizationId: org.id,
//             status,
//             priceId: typeof sub.items?.data?.[0]?.price?.id === "string"
//               ? sub.items.data[0].price.id
//               : null,
//             currentPeriodStart: sub.current_period_start
//               ? new Date(sub.current_period_start * 1000)
//               : null,
//             currentPeriodEnd: sub.current_period_end
//               ? new Date(sub.current_period_end * 1000)
//               : null,
//             cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
//           },
//         });
//         break;
//       }

//       default:
//         // /// Not critical to handle other events now
//         break;
//     }

//     // /// Optional: store compact audit log for dunning chart freshness
//     await prisma.auditLog.create({
//       data: {
//         organizationId:
//           (event.data.object as any)?.customer &&
//           (await findOrgByCustomerId((event.data.object as any).customer))?.id || null,
//         action: event.type,
//         metadata: { id: event.id },
//       },
//     }).catch(() => { /* non-blocking */ });

//     return NextResponse.json({ received: true }, { status: 200 });
//   } catch (e: any) {
//     return NextResponse.json({ error: e.message }, { status: 500 });
//   }
// }

