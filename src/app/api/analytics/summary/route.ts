import { NextResponse } from "next/server";
import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = user.memberships[0]?.organization;
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const now = new Date();
  const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Active/trialing/past_due = paying cohort
  const activeSubs = await prisma.subscription.findMany({
    where: { organizationId: org.id, status: { in: ["ACTIVE", "TRIALING", "PAST_DUE"] as any } },
    select: { id: true },
  });

  // Sales last 30d (paid invoices)
  const paidLast30 = await prisma.invoice.findMany({
    where: {
      organizationId: org.id,
      status: "PAID" as any,
      periodEnd: { gte: d30 },
    },
    select: { amountPaid: true, currency: true },
  });

  // Collections last 30d (all invoices issued)
  const issuedLast30 = await prisma.invoice.findMany({
    where: { organizationId: org.id, periodEnd: { gte: d30 } },
    select: { amountDue: true, amountPaid: true },
  });

  const sum = (arr: number[]) => arr.reduce((a, b) => a + (b || 0), 0);

  const mrr = sum(paidLast30.map((i) => i.amountPaid)); // naive MRR ≈ paid in last 30d
  const arr = mrr * 12;

  const activeCustomers = activeSubs.length || 0;
  const arpa = activeCustomers > 0 ? mrr / activeCustomers : 0;

  const due = sum(issuedLast30.map((i) => i.amountDue));
  const paid = sum(issuedLast30.map((i) => i.amountPaid));
  const collectionRate = due > 0 ? paid / due : 0;

  // Day Sales Outstanding: (Receivables / Average Daily Sales)
  const receivablesOpen = await prisma.invoice.findMany({
    where: {
      organizationId: org.id,
      status: { in: ["OPEN", "UNCOLLECTIBLE"] as any },
    },
    select: { amountDue: true, amountPaid: true },
  });
  const ar = sum(receivablesOpen.map((i) => i.amountDue - i.amountPaid));
  const avgDailySales = mrr / 30;
  const dso = avgDailySales > 0 ? ar / avgDailySales : 0;

  return NextResponse.json({
    ok: true,
    currency: paidLast30[0]?.currency?.toUpperCase() ?? "USD",
    kpis: {
      MRR: mrr,
      ARR: arr,
      activeCustomers,
      ARPA: arpa,
      collectionRate, // 0..1
      DSO: dso,       // days
    },
  });
}
