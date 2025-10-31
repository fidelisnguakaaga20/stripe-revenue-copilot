import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@lib/db';

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'session';
const AUTH_SECRET = process.env.AUTH_SECRET || 'dev-secret-change-me';

function key() {
  return new TextEncoder().encode(AUTH_SECRET);
}

export async function createSession(email: string) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key());

  const prod = process.env.NODE_ENV === 'production';
  (await cookies()).set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: prod,
    sameSite: 'lax',
    path: '/',
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

/** Optional helper for role checks within an org */
export async function requireOrgRole(orgId: string, roles: Array<'OWNER' | 'ACCOUNTANT'>) {
  const user = await getSessionUser();
  if (!user) return false;
  return user.memberships.some((m) => m.organizationId === orgId && roles.includes(m.role as any));
}
