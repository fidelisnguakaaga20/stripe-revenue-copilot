// /// Lightweight session inspector for debugging UI/org linking.
// /// Safe to call from the client to show who is logged in.
// /// Works with your existing dev-login cookie flow (best-effort).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  // /// Your dev flow usually sets a cookie; we read whatever you stored.
  const cookieStore = await cookies();
  const email = cookieStore.get("dev_email")?.value || cookieStore.get("email")?.value;

  if (!email) {
    return NextResponse.json({ authenticated: false });
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ authenticated: false });

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    include: { organization: true },
  });

  const org = memberships[0]?.organization ?? null;

  return NextResponse.json({
    authenticated: true,
    user: { id: user.id, email: user.email, name: user.name },
    organization: org
      ? {
          id: org.id,
          name: org.name,
          slug: org.slug,
          plan: org.plan,
          stripeCustomerId: org.stripeCustomerId,
        }
      : null,
  });
}



// import { NextResponse } from "next/server";
// import { getSessionUser } from "@/lib/auth";

// export async function GET() {
//   const user = await getSessionUser();
//   if (!user) return NextResponse.json({ authenticated: false });
//   return NextResponse.json({
//     authenticated: true,
//     email: user.email,
//     orgs:
//       user.memberships?.map((m) => ({
//         id: m.organizationId,
//         role: m.role,
//       })) ?? [],
//   });
// }


