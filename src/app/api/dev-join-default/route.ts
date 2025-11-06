import { NextResponse } from "next/server";
import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure default org exists
  let org = await prisma.organization.findFirst({ where: { name: "NGU-TOP" } });
  if (!org) {
    org = await prisma.organization.create({ data: { name: "NGU-TOP", plan: "FREE" } });
  }

  // Ensure membership
  const has = await prisma.membership.findFirst({
    where: { userId: user.id, organizationId: org.id },
  });

  if (!has) {
    await prisma.membership.create({
      data: { userId: user.id, organizationId: org.id, role: "OWNER" },
    });
  }

  return NextResponse.json({ ok: true, org: { id: org.id, name: org.name } });
}
