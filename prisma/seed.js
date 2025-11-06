// /// Quick demo seeding so Analytics/Invoices screens aren’t empty on first run.
// /// Run: node prisma/seed.js  (ensure `DATABASE_URL` is set and `prisma migrate deploy` ran)

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // /// 1) Pick first org (created during your dev login / google flow)
  let org = await prisma.organization.findFirst();
  if (!org) {
    // /// If none exists, create a minimal org and user to attach invoices to.
    const user = await prisma.user.upsert({
      where: { email: "owner@example.com" },
      update: {},
      create: { email: "owner@example.com", name: "Owner" },
    });

    org = await prisma.organization.create({
      data: {
        name: "Default Org",
        slug: "default-org",
        plan: "FREE",
        stripeCustomerId: null, // /// will be filled after first real checkout
        memberships: { create: { userId: user.id, role: "OWNER" } },
      },
    });
  }

  // /// 2) Seed a few invoices across dates/statuses
  const now = new Date();
  const days = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  const samples = [
    {
      stripeInvoiceId: "demo_inv_001",
      amountDue: 15000,
      amountPaid: 15000,
      currency: "USD",
      status: "PAID",
      dueDate: days(25),
      periodStart: days(55),
      periodEnd: days(25),
      hostedInvoiceUrl: null,
    },
    {
      stripeInvoiceId: "demo_inv_002",
      amountDue: 15000,
      amountPaid: 0,
      currency: "USD",
      status: "OPEN",
      dueDate: days(5),
      periodStart: days(35),
      periodEnd: days(5),
      hostedInvoiceUrl: null,
    },
    {
      stripeInvoiceId: "demo_inv_003",
      amountDue: 15000,
      amountPaid: 0,
      currency: "USD",
      status: "OVERDUE",
      dueDate: days(1),
      periodStart: days(31),
      periodEnd: days(1),
      hostedInvoiceUrl: null,
    },
  ];

  for (const inv of samples) {
    await prisma.invoice.upsert({
      where: { stripeInvoiceId: inv.stripeInvoiceId },
      update: { ...inv, organizationId: org.id },
      create: { ...inv, organizationId: org.id },
    });
  }

  // /// 3) One subscription row for charts
  await prisma.subscription.upsert({
    where: { stripeSubscriptionId: "demo_sub_001" },
    update: {
      organizationId: org.id,
      status: "ACTIVE",
      priceId: "price_demo_monthly",
      currentPeriodStart: days(10),
      currentPeriodEnd: days(-20),
      cancelAtPeriodEnd: false,
    },
    create: {
      stripeSubscriptionId: "demo_sub_001",
      organizationId: org.id,
      status: "ACTIVE",
      priceId: "price_demo_monthly",
      currentPeriodStart: days(10),
      currentPeriodEnd: days(-20),
      cancelAtPeriodEnd: false,
    },
  });

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

