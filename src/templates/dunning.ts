/// NEW: src/templates/dunning.ts
import { Invoice } from "@prisma/client";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format((cents ?? 0) / 100);
}

function dueDateFmt(d?: Date | null) {
  return d ? new Date(d).toDateString() : "N/A";
}

export function overdueTemplate(params: {
  orgName: string;
  invoice: Pick<
    Invoice,
    | "stripeInvoiceId"
    | "currency"
    | "amountDue"
    | "amountPaid"
    | "dueDate"
    | "hostedInvoiceUrl"
  >;
}) {
  const { orgName, invoice } = params;
  const subject = `[Action Required] Overdue invoice ${invoice.stripeInvoiceId} for ${orgName}`;
  const payUrl = invoice.hostedInvoiceUrl || "";
  const amount = money(invoice.amountDue - (invoice.amountPaid ?? 0), invoice.currency);
  const due = dueDateFmt(invoice.dueDate);

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Payment overdue for ${orgName}</h2>
      <p>Invoice <strong>${invoice.stripeInvoiceId}</strong> became due on <strong>${due}</strong>.</p>
      <p><strong>Balance due:</strong> ${amount}</p>
      ${
        payUrl
          ? `<p><a href="${payUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;border:1px solid #222">View & Pay Invoice</a></p>`
          : ""
      }
      <p>If you've already paid, please ignore this email.</p>
      <hr/>
      <small>This is an automated reminder from Stripe Revenue Copilot.</small>
    </div>
  `.trim();

  const text = `
Payment overdue for ${orgName}
Invoice ${invoice.stripeInvoiceId} became due on ${due}.
Balance due: ${amount}
${payUrl ? "Pay: " + payUrl : ""}
If you've already paid, please ignore this email.
`.trim();

  return { subject, html, text };
}

export function upcomingTemplate(params: {
  orgName: string;
  invoice: Pick<
    Invoice,
    | "stripeInvoiceId"
    | "currency"
    | "amountDue"
    | "amountPaid"
    | "dueDate"
    | "hostedInvoiceUrl"
  >;
  daysUntil: number;
}) {
  const { orgName, invoice, daysUntil } = params;
  const subject = `[Reminder] Invoice ${invoice.stripeInvoiceId} due in ${daysUntil} day(s) for ${orgName}`;
  const payUrl = invoice.hostedInvoiceUrl || "";
  const amount = money(invoice.amountDue - (invoice.amountPaid ?? 0), invoice.currency);
  const due = dueDateFmt(invoice.dueDate);

  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;line-height:1.5">
      <h2>Upcoming payment for ${orgName}</h2>
      <p>Invoice <strong>${invoice.stripeInvoiceId}</strong> is due on <strong>${due}</strong> (${daysUntil} day(s)).</p>
      <p><strong>Amount:</strong> ${amount}</p>
      ${
        payUrl
          ? `<p><a href="${payUrl}" style="display:inline-block;padding:10px 16px;border-radius:8px;text-decoration:none;border:1px solid #222">View & Pay Invoice</a></p>`
          : ""
      }
      <p>Thank you!</p>
      <hr/>
      <small>This is an automated reminder from Stripe Revenue Copilot.</small>
    </div>
  `.trim();

  const text = `
Upcoming payment for ${orgName}
Invoice ${invoice.stripeInvoiceId} is due on ${due} (${daysUntil} day(s)).
Amount: ${amount}
${payUrl ? "Pay: " + payUrl : ""}
`.trim();

  return { subject, html, text };
}
