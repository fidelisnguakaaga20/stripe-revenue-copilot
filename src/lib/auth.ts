// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "session";
const AUTH_SECRET = process.env.AUTH_SECRET || "dev-secret-change-me";
function key() {
  return new TextEncoder().encode(AUTH_SECRET);
}

export type OrgRole = "OWNER" | "ACCOUNTANT";
export type OrgPlan = "FREE" | "PRO";

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key());

  const prod = process.env.NODE_ENV === "production";
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: prod,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE_NAME);
}

export async function getSessionUser() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const email = (payload as any).email as string | undefined;
    if (!email) return null;
    return prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { organization: true } } },
    });
  } catch {
    return null;
  }
}

/** Role/plan helpers */
export function hasRole(user: any, orgId: string, roles: OrgRole[]) {
  return !!user?.memberships?.some(
    (m: any) => m.organizationId === orgId && roles.includes(m.role)
  );
}
export function userOrg(user: any) {
  return user?.memberships?.[0]?.organization ?? null;
}
export function hasPro(org: any) {
  return (org?.plan ?? "FREE") === "PRO";
}



// // src/lib/auth.ts
// import { SignJWT, jwtVerify } from 'jose';
// import { cookies } from 'next/headers';
// import { prisma } from '@lib/db';

// const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'session';
// const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';
// function key() { return new TextEncoder().encode(AUTH_SECRET); }

// export type OrgRole = 'OWNER' | 'ACCOUNTANT';
// export type OrgPlan = 'FREE' | 'PRO';

// export async function createSession(email: string) {
//   const token = await new SignJWT({ email })
//     .setProtectedHeader({ alg: 'HS256' })
//     .setIssuedAt()
//     .setExpirationTime('7d')
//     .sign(key());

//   const prod = process.env.NODE_ENV === 'production';
//   (await cookies()).set(SESSION_COOKIE_NAME, token, {
//     httpOnly: true, secure: prod, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
//   });
// }

// export async function clearSession() {
//   (await cookies()).delete(SESSION_COOKIE_NAME);
// }

// export async function getSessionUser() {
//   const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
//   if (!token) return null;
//   try {
//     const { payload } = await jwtVerify(token, key());
//     const email = (payload as any).email as string | undefined;
//     if (!email) return null;
//     return prisma.user.findUnique({
//       where: { email },
//       include: { memberships: { include: { organization: true } } },
//     });
//   } catch {
//     return null;
//   }
// }

// /** Role/plan checks */
// export function hasRole(user: any, orgId: string, roles: OrgRole[]) {
//   return !!user?.memberships?.some((m: any) => m.organizationId === orgId && roles.includes(m.role));
// }
// export function userOrg(user: any) {
//   return user?.memberships?.[0]?.organization ?? null;
// }
// export function hasPro(org: any) {
//   return (org?.plan ?? 'FREE') === 'PRO';
// }



