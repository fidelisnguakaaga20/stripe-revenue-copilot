import { NextResponse } from "next/server";
import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";
import { stripe } from "@lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const membership = user.memberships?.[0];
  const org = membership?.organization;
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });
  if (membership.role !== "OWNER") {
    return NextResponse.json({ error: "Forbidden (OWNER only)" }, { status: 403 });
  }

  const sub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });
  if (!sub) return NextResponse.json({ ok: true, note: "No subscription to resume" });

  try {
    await stripe.subscriptions.update(sub.stripeSubscriptionId, { cancel_at_period_end: false });
  } catch {}

  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.stripeSubscriptionId },
    data: { cancelAtPeriodEnd: false },
  });

  return NextResponse.redirect(new URL("/billing", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"));
}

