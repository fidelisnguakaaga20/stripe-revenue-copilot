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

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: org.id, action: "dunning.sent", createdAt: { gte: since } },
    select: { metadata: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  let upcoming = 0, overdue = 0, mocked = 0;
  for (const l of logs) {
    const kind = (l.metadata as any)?.kind;
    if (kind === "upcoming") upcoming++;
    if (kind === "overdue") overdue++;
    if ((l.metadata as any)?.mocked) mocked++;
  }

  return NextResponse.json({ ok: true, last30d: { total: logs.length, upcoming, overdue, mocked } });
}
