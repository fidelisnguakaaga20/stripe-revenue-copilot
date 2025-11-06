import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth";

const Body = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json().catch(() => ({}));
    const parsed = Body.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, name } = parsed.data;

    const user = await prisma.user.upsert({
      where: { email },
      update: { name: name ?? undefined },
      create: { email, name: name ?? null },
    });

    // Ensure a default org + membership (OWNER) for first login
    let org = await prisma.organization.findFirst({ where: { name: "NGU-TOP" } });
    if (!org) org = await prisma.organization.create({ data: { name: "NGU-TOP", plan: "FREE" } });

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, organizationId: org.id },
    });
    if (!membership) {
      await prisma.membership.create({
        data: { userId: user.id, organizationId: org.id, role: "OWNER" },
      });
    }

    await createSession(email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("google auth route error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

