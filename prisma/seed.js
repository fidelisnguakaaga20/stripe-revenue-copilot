/* Seed dev data: one OWNER and one Organization */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'owner@example.com';
  const name = 'Owner';
  const orgName = 'Acme Inc';

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name } });
  }

  let org = await prisma.organization.findFirst({ where: { name: orgName } });
  if (!org) {
    org = await prisma.organization.create({
      data: { name: orgName, plan: 'FREE' },
    });
  }

  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    update: { role: 'OWNER' },
    create: { role: 'OWNER', userId: user.id, organizationId: org.id },
  });

  console.log('Seed complete:', { user: user.email, org: org.name });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
