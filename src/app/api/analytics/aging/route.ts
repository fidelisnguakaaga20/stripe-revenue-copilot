import { NextResponse } from "next/server";
import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function daysSince(d: Date | null): number | null {
  if (!d) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}
function bucket(days: number | null): "0-30" | "31-60" | "61-90" | "90+" | "n/a" {
  if (days === null) return "n/a";
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const org = user.memberships[0]?.organization;
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 400 });

  const rows = await prisma.invoice.findMany({
    where: { organizationId: org.id },
    select: { amountDue: true, amountPaid: true, status: true, dueDate: true },
  });

  const data = rows.map((r) => {
    const d = daysSince(r.dueDate);
    return {
      bucket: bucket(d),
      outstanding: Math.max(0, (r.amountDue || 0) - (r.amountPaid || 0)),
      isOverdue: d !== null && d > 0 && r.status !== "PAID" && r.status !== "VOID",
    };
  });

  const rollup: Record<string, { count: number; outstanding: number; overdue: number }> = {
    "0-30": { count: 0, outstanding: 0, overdue: 0 },
    "31-60": { count: 0, outstanding: 0, overdue: 0 },
    "61-90": { count: 0, outstanding: 0, overdue: 0 },
    "90+": { count: 0, outstanding: 0, overdue: 0 },
    "n/a": { count: 0, outstanding: 0, overdue: 0 },
  };

  for (const r of data) {
    rollup[r.bucket].count += 1;
    rollup[r.bucket].outstanding += r.outstanding;
    if (r.isOverdue) rollup[r.bucket].overdue += 1;
  }

  return NextResponse.json({ ok: true, rollup });
}
