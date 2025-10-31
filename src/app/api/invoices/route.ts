// src/app/api/invoices/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Q = { page: number; limit: number; status?: string; q?: string };

function parseQuery(url: URL): Q {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 10)));
  const status = url.searchParams.get("status") || undefined;
  const q = url.searchParams.get("q") || undefined;
  return { page, limit, status, q };
}

function amountFmt(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
}
function agingDays(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const ms = Date.now() - dueDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function bucket(days: number | null): "0-30" | "31-60" | "61-90" | "90+" | "n/a" {
  if (days === null) return "n/a";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = user.memberships[0]?.organization;
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const url = new URL(req.url);
  const { page, limit, status, q } = parseQuery(url);

  const where: any = { organizationId: org.id };
  if (status && status !== "ALL") where.status = status as any;
  if (q) where.OR = [{ stripeInvoiceId: { contains: q, mode: "insensitive" } }, { currency: { contains: q, mode: "insensitive" } }];

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        stripeInvoiceId: true,
        currency: true,
        amountDue: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        periodStart: true,
        periodEnd: true,
        hostedInvoiceUrl: true,
        createdAt: true,
      },
    }),
  ]);

  const data = rows.map((r) => {
    const days = agingDays(r.dueDate);
    const overdue = days !== null && days > 0 && r.status !== "PAID" && r.status !== "VOID";
    const atRisk = r.status === "OPEN" && r.dueDate !== null && r.dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 && r.dueDate.getTime() - Date.now() > 0;
    return {
      ...r,
      amountDueFormatted: amountFmt(r.amountDue, r.currency),
      amountPaidFormatted: amountFmt(r.amountPaid, r.currency),
      agingDays: days,
      agingBucket: bucket(days),
      flags: { overdue, atRisk },
    };
  });

  const rollups = {
    buckets: {
      "0-30": data.filter((d) => d.agingBucket === "0-30").length,
      "31-60": data.filter((d) => d.agingBucket === "31-60").length,
      "61-90": data.filter((d) => d.agingBucket === "61-90").length,
      "90+": data.filter((d) => d.agingBucket === "90+").length,
      "n/a": data.filter((d) => d.agingBucket === "n/a").length,
    },
    overdue: data.filter((d) => d.flags.overdue).length,
    atRisk: data.filter((d) => d.flags.atRisk).length,
  };

  return NextResponse.json({ ok: true, page, limit, total, pages: Math.max(1, Math.ceil(total / limit)), data, rollups });
}
