// DEV-ONLY: /api/dev/sync-checkout?session_id=...&orgId=...
// Use this locally when you cannot run Stripe CLI webhooks.
// It pulls the Checkout Session + Subscription + latest Invoice from Stripe
// and upserts them into your DB (same effect as the webhook).
//
// SECURITY: This route is available ONLY in development.
// Do NOT deploy to production.

import { NextResponse } from "next/server";
import type { Stripe } from "stripe";
import { stripe } from "@lib/stripe";
import { prisma } from "@lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function assertDev() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("This endpoint is DEV-ONLY");
  }
}

async function getOrgIdFromCustomerId(customerId: string): Promise<string | null> {
  if (!customerId) return null;
  const res = await stripe.customers.retrieve(customerId);
  const obj = res as Stripe.Customer | Stripe.DeletedCustomer;
  if ("deleted" in obj && obj.deleted) return null;
  const md = (obj as Stripe.Customer).metadata;
  return (md?.orgId as string | undefined) ?? null;
}

async function upsertSubscriptionFromStripe(sub: any, orgId: string | null) {
  if (!orgId) return;
  const priceId = sub.items?.data?.[0]?.price?.id ?? "";
  const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date();
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date();
  const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
  const status = (sub.status || "incomplete").toUpperCase();

  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: sub.id },
    update: {
      status,
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      organizationId: orgId,
    },
    create: {
      stripeSubscriptionId: sub.id,
      status,
      priceId,
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd,
      organizationId: orgId,
    },
  });

  const active = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(status);
  await prisma.organization.update({
    where: { id: orgId },
    data: { plan: active ? "PRO" : "FREE" },
  });
}

async function upsertInvoiceFromStripe(inv: any, orgId: string | null) {
  if (!orgId) return;
  const hostedInvoiceUrl = inv.hosted_invoice_url || "";
  const status = (inv.status || "open").toUpperCase();
  const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : null;

  await prisma.invoice.upsert({
    where: { stripeInvoiceId: inv.id },
    update: {
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      currency: inv.currency ?? "usd",
      hostedInvoiceUrl,
      status,
      dueDate,
      organizationId: orgId,
    },
    create: {
      stripeInvoiceId: inv.id,
      amountDue: inv.amount_due ?? 0,
      amountPaid: inv.amount_paid ?? 0,
      currency: inv.currency ?? "usd",
      hostedInvoiceUrl,
      status,
      dueDate,
      organizationId: orgId,
    },
  });
}

export async function GET(req: Request) {
  try {
    assertDev();

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("session_id");
    let orgId = url.searchParams.get("orgId");

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400 });
    }

    // 1) Load checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["latest_invoice", "subscription"], // expand to access nested fields
    });

    const subscriptionId =
      typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;

    if (!orgId && customerId) {
      orgId = await getOrgIdFromCustomerId(customerId);
    }
    if (!orgId) {
      return NextResponse.json({ ok: false, error: "orgId not found on customer metadata" }, { status: 400 });
    }

    // 2) Upsert subscription
    if (subscriptionId) {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      await upsertSubscriptionFromStripe(sub, orgId);
    }

    // 3) Upsert latest invoice (best effort)
    let invoice: Stripe.Invoice | null = null;

    // --- FIX: TS-safe extraction of latest_invoice regardless of Response<T> typing ---
    // Some builds type `session` as Stripe.Response<Stripe.Checkout.Session>, which
    // doesn’t expose `latest_invoice` directly. Use a narrow cast to access it safely.
    const latest = (session as unknown as { latest_invoice?: string | Stripe.Invoice | null })
      .latest_invoice ?? null; // <-- change

    if (typeof latest === "string") {
      invoice = await stripe.invoices.retrieve(latest);
    } else if (latest && typeof latest === "object") {
      invoice = latest as Stripe.Invoice;
    } else if (customerId) {
      const list = await stripe.invoices.list({ customer: customerId, limit: 1 });
      invoice = list.data[0] ?? null;
    }

    if (invoice) {
      await upsertInvoiceFromStripe(invoice, orgId);
    }

    return NextResponse.json({
      ok: true,
      session: session.id,
      subscriptionId: subscriptionId ?? null,
      customerId: customerId ?? null,
      orgId,
      invoiceId: invoice?.id ?? null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "sync failed" }, { status: 500 });
  }
}



// // DEV-ONLY: /api/dev/sync-checkout?session_id=...&orgId=...
// // Use this locally when you cannot run Stripe CLI webhooks.
// // It pulls the Checkout Session + Subscription + latest Invoice from Stripe
// // and upserts them into your DB (same effect as the webhook).
// //
// // SECURITY: This route is available ONLY in development.
// // Do NOT deploy to production.

// import { NextResponse } from "next/server";
// import type { Stripe } from "stripe";
// import { stripe } from "@lib/stripe";
// import { prisma } from "@lib/db";

// export const runtime = "nodejs";
// export const dynamic = "force-dynamic";

// function assertDev() {
//   if (process.env.NODE_ENV !== "development") {
//     throw new Error("This endpoint is DEV-ONLY");
//   }
// }

// async function getOrgIdFromCustomerId(customerId: string): Promise<string | null> {
//   if (!customerId) return null;
//   const res = await stripe.customers.retrieve(customerId);
//   const obj = res as Stripe.Customer | Stripe.DeletedCustomer;
//   if ("deleted" in obj && obj.deleted) return null;
//   const md = (obj as Stripe.Customer).metadata;
//   return (md?.orgId as string | undefined) ?? null;
// }

// async function upsertSubscriptionFromStripe(sub: any, orgId: string | null) {
//   if (!orgId) return;
//   const priceId = sub.items?.data?.[0]?.price?.id ?? "";
//   const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : new Date();
//   const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : new Date();
//   const cancelAtPeriodEnd = !!sub.cancel_at_period_end;
//   const status = (sub.status || "incomplete").toUpperCase();

//   await prisma.subscription.upsert({
//     where: { stripeSubscriptionId: sub.id },
//     update: {
//       status,
//       priceId,
//       currentPeriodStart,
//       currentPeriodEnd,
//       cancelAtPeriodEnd,
//       organizationId: orgId,
//     },
//     create: {
//       stripeSubscriptionId: sub.id,
//       status,
//       priceId,
//       currentPeriodStart,
//       currentPeriodEnd,
//       cancelAtPeriodEnd,
//       organizationId: orgId,
//     },
//   });

//   const active = ["ACTIVE", "TRIALING", "PAST_DUE"].includes(status);
//   await prisma.organization.update({
//     where: { id: orgId },
//     data: { plan: active ? "PRO" : "FREE" },
//   });
// }

// async function upsertInvoiceFromStripe(inv: any, orgId: string | null) {
//   if (!orgId) return;
//   const hostedInvoiceUrl = inv.hosted_invoice_url || "";
//   const status = (inv.status || "open").toUpperCase();
//   const dueDate = inv.due_date ? new Date(inv.due_date * 1000) : null;

//   await prisma.invoice.upsert({
//     where: { stripeInvoiceId: inv.id },
//     update: {
//       amountDue: inv.amount_due ?? 0,
//       amountPaid: inv.amount_paid ?? 0,
//       currency: inv.currency ?? "usd",
//       hostedInvoiceUrl,
//       status,
//       dueDate,
//       organizationId: orgId,
//     },
//     create: {
//       stripeInvoiceId: inv.id,
//       amountDue: inv.amount_due ?? 0,
//       amountPaid: inv.amount_paid ?? 0,
//       currency: inv.currency ?? "usd",
//       hostedInvoiceUrl,
//       status,
//       dueDate,
//       organizationId: orgId,
//     },
//   });
// }

// export async function GET(req: Request) {
//   try {
//     assertDev();

//     const url = new URL(req.url);
//     const sessionId = url.searchParams.get("session_id");
//     let orgId = url.searchParams.get("orgId");

//     if (!sessionId) {
//       return NextResponse.json({ ok: false, error: "session_id required" }, { status: 400 });
//     }

//     // 1) Load checkout session
//     const session = await stripe.checkout.sessions.retrieve(sessionId, {
//       expand: ["latest_invoice", "subscription"], /// expand to access nested fields
//     });

//     const subscriptionId =
//       typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
//     const customerId =
//       typeof session.customer === "string" ? session.customer : session.customer?.id;

//     if (!orgId && customerId) {
//       orgId = await getOrgIdFromCustomerId(customerId);
//     }
//     if (!orgId) {
//       return NextResponse.json({ ok: false, error: "orgId not found on customer metadata" }, { status: 400 });
//     }

//     // 2) Upsert subscription
//     if (subscriptionId) {
//       const sub = await stripe.subscriptions.retrieve(subscriptionId);
//       await upsertSubscriptionFromStripe(sub, orgId);
//     }

//     // 3) Upsert latest invoice (best effort)
//     let invoice: Stripe.Invoice | null = null;

//     /// TS-safe access: handle SDK typing differences across versions
//     const latest = (session as any).latest_invoice as string | Stripe.Invoice | null; ///

//     if (typeof latest === "string") {
//       invoice = await stripe.invoices.retrieve(latest);
//     } else if (latest && typeof latest === "object") {
//       invoice = latest as Stripe.Invoice;
//     } else if (customerId) {
//       const list = await stripe.invoices.list({ customer: customerId, limit: 1 });
//       invoice = list.data[0] ?? null;
//     }

//     if (invoice) {
//       await upsertInvoiceFromStripe(invoice, orgId);
//     }

//     return NextResponse.json({
//       ok: true,
//       session: session.id,
//       subscriptionId: subscriptionId ?? null,
//       customerId: customerId ?? null,
//       orgId,
//       invoiceId: invoice?.id ?? null,
//     });
//   } catch (e: any) {
//     return NextResponse.json({ ok: false, error: e?.message || "sync failed" }, { status: 500 });
//   }
// }



