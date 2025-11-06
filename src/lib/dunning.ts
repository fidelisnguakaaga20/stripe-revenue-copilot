import { prisma } from "@lib/db";
import { sendMail } from "@lib/mailer";
import { overdueTemplate } from "../templates/dunning/overdue";
import { upcomingTemplate } from "../templates/dunning/upcoming";

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
}

type DunningResult = {
  scanned: number;
  overdue: number;
  upcoming: number;
  sent: number;
};

async function ownerEmails(organizationId: string): Promise<string[]> {
  const owners = await prisma.membership.findMany({
    where: { organizationId, role: "OWNER" as any },
    select: { user: { select: { email: true } } },
  });
  return owners.map((m) => m.user.email).filter(Boolean) as string[];
}

async function logSend(organizationId: string, to: string, kind: "overdue" | "upcoming", mocked: boolean) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        action: "dunning.sent",
        metadata: { to, kind, mocked },
      },
    });
  } catch {}
}

export async function runDunning(): Promise<DunningResult> {
  const now = new Date();
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  // Pull candidate invoices per org
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      organizationId: true,
      stripeInvoiceId: true,
      currency: true,
      amountDue: true,
      amountPaid: true,
      status: true,
      dueDate: true,
      hostedInvoiceUrl: true,
      organization: { select: { name: true } },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  let overdue = 0;
  let upcoming = 0;
  let sent = 0;

  for (const inv of invoices) {
    const isPaid = inv.amountPaid >= inv.amountDue || inv.status === "PAID";
    const hasDue = !!inv.dueDate;

    if (isPaid || !hasDue) continue;

    // Overdue
    if (inv.dueDate! < now && inv.status !== "VOID") {
      overdue++;
      const emails = await ownerEmails(inv.organizationId);
      const args = {
        orgName: inv.organization.name,
        invoiceId: inv.stripeInvoiceId,
        amountDueFormatted: fmtMoney(inv.amountDue - inv.amountPaid, inv.currency),
        dueDate: inv.dueDate,
        hostedInvoiceUrl: inv.hostedInvoiceUrl,
      };
      const { subject, html } = overdueTemplate(args);
      for (const to of emails) {
        const res = await sendMail({ to, subject, html, text: undefined });
        await logSend(inv.organizationId, to, "overdue", (res as any).mocked === true);
        sent++;
      }
      continue;
    }

    // Upcoming (within 7 days)
    if (inv.status === "OPEN" && inv.dueDate! >= now && inv.dueDate! <= soon) {
      upcoming++;
      const emails = await ownerEmails(inv.organizationId);
      const args = {
        orgName: inv.organization.name,
        invoiceId: inv.stripeInvoiceId,
        amountDueFormatted: fmtMoney(inv.amountDue - inv.amountPaid, inv.currency),
        dueDate: inv.dueDate,
        hostedInvoiceUrl: inv.hostedInvoiceUrl,
      };
      const { subject, html } = upcomingTemplate(args);
      for (const to of emails) {
        const res = await sendMail({ to, subject, html, text: undefined });
        await logSend(inv.organizationId, to, "upcoming", (res as any).mocked === true);
        sent++;
      }
    }
  }

  return { scanned: invoices.length, overdue, upcoming, sent };
}



// /// src/lib/dunning.ts — multi-touch dunning with AuditLog tracking
// import { prisma } from "@lib/db";
// import { sendMail } from "@lib/mailer";
// import { overdueTemplate, upcomingTemplate } from "@templates/dunning";

// type JobCounts = { scanned: number; overdue: number; upcoming: number; sent: number };

// const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// // decide which “stage” an overdue invoice is in, by days past due
// function overdueStage(daysOverdue: number) {
//   if (daysOverdue <= 7) return 1;      // Day 1–7
//   if (daysOverdue <= 21) return 2;     // Day 8–21
//   return 3;                            // Day 22+
// }

// async function alreadySentToday(orgId: string, invoiceId: string) {
//   const since = new Date(Date.now() - ONE_DAY_MS);
//   const count = await prisma.auditLog.count({
//     where: {
//       organizationId: orgId,
//       action: "dunning.sent",
//       createdAt: { gte: since },
//       metadata: { path: ["invoiceId"], equals: invoiceId },
//     },
//   });
//   return count > 0;
// }

// async function recordSend(args: {
//   orgId: string;
//   invoiceId: string;
//   to: string;
//   kind: "overdue" | "upcoming";
//   stage?: number;
//   mocked: boolean;
// }) {
//   await prisma.auditLog.create({
//     data: {
//       organizationId: args.orgId,
//       action: "dunning.sent",
//       metadata: {
//         invoiceId: args.invoiceId,
//         to: args.to,
//         kind: args.kind,
//         stage: args.stage ?? null,
//         mocked: args.mocked,
//       },
//     },
//   });
// }

// export async function runDunning(): Promise<JobCounts> {
//   // Overdue: OPEN, unpaid, dueDate < now
//   const overdueInvoices = await prisma.invoice.findMany({
//     where: {
//       status: "OPEN",
//       amountPaid: { lt: prisma.invoice.fields.amountDue },
//       dueDate: { lt: new Date() },
//     },
//     orderBy: [{ dueDate: "asc" }],
//     select: {
//       id: true,
//       stripeInvoiceId: true,
//       amountDue: true,
//       amountPaid: true,
//       currency: true,
//       dueDate: true,
//       hostedInvoiceUrl: true,
//       organizationId: true,
//       organization: { select: { name: true } },
//     },
//     take: 100,
//   });

//   // Upcoming: OPEN, unpaid, due in next 7 days
//   const upcomingInvoices = await prisma.invoice.findMany({
//     where: {
//       status: "OPEN",
//       amountPaid: { lt: prisma.invoice.fields.amountDue },
//       dueDate: { gte: new Date(), lte: new Date(Date.now() + 7 * ONE_DAY_MS) },
//     },
//     orderBy: [{ dueDate: "asc" }],
//     select: {
//       id: true,
//       stripeInvoiceId: true,
//       amountDue: true,
//       amountPaid: true,
//       currency: true,
//       dueDate: true,
//       hostedInvoiceUrl: true,
//       organizationId: true,
//       organization: { select: { name: true } },
//     },
//     take: 100,
//   });

//   let sent = 0;

//   // helper to choose recipient (first member email)
//   async function recipientForOrg(orgId: string): Promise<string | null> {
//     const m = await prisma.membership.findFirst({
//       where: { organizationId: orgId },
//       include: { user: true },
//     });
//     return m?.user?.email ?? null;
//   }

//   // send overdue
//   for (const inv of overdueInvoices) {
//     const to = await recipientForOrg(inv.organizationId);
//     if (!to) continue;

//     const days = inv.dueDate ? Math.floor((Date.now() - inv.dueDate.getTime()) / ONE_DAY_MS) : 0;
//     const stage = overdueStage(days);

//     if (await alreadySentToday(inv.organizationId, inv.id)) continue;

//     const { subject, html, text } = overdueTemplate({
//       orgName: inv.organization?.name || "Your Organization",
//       invoice: {
//         stripeInvoiceId: inv.stripeInvoiceId,
//         currency: inv.currency || "USD",
//         amountDue: inv.amountDue,
//         amountPaid: inv.amountPaid ?? 0,
//         dueDate: inv.dueDate,
//         hostedInvoiceUrl: inv.hostedInvoiceUrl,
//       },
//     });

//     const res = await sendMail({ to, subject, html, text });
//     await recordSend({
//       orgId: inv.organizationId,
//       invoiceId: inv.id,
//       to,
//       kind: "overdue",
//       stage,
//       mocked: !!(res as any)?.mocked,
//     });
//     sent++;
//   }

//   // send upcoming (1 reminder, once per day max)
//   for (const inv of upcomingInvoices) {
//     const to = await recipientForOrg(inv.organizationId);
//     if (!to) continue;

//     if (await alreadySentToday(inv.organizationId, inv.id)) continue;

//     const daysUntil = inv.dueDate ? Math.max(0, Math.ceil((inv.dueDate.getTime() - Date.now()) / ONE_DAY_MS)) : 0;
//     const { subject, html, text } = upcomingTemplate({
//       orgName: inv.organization?.name || "Your Organization",
//       invoice: {
//         stripeInvoiceId: inv.stripeInvoiceId,
//         currency: inv.currency || "USD",
//         amountDue: inv.amountDue,
//         amountPaid: inv.amountPaid ?? 0,
//         dueDate: inv.dueDate,
//         hostedInvoiceUrl: inv.hostedInvoiceUrl,
//       },
//       daysUntil,
//     });

//     const res = await sendMail({ to, subject, html, text });
//     await recordSend({
//       orgId: inv.organizationId,
//       invoiceId: inv.id,
//       to,
//       kind: "upcoming",
//       mocked: !!(res as any)?.mocked,
//     });
//     sent++;
//   }

//   return {
//     scanned: overdueInvoices.length + upcomingInvoices.length,
//     overdue: overdueInvoices.length,
//     upcoming: upcomingInvoices.length,
//     sent,
//   };
// }
