export function overdueTemplate(args: {
  orgName: string;
  invoiceId: string;
  amountDueFormatted: string;
  dueDate?: Date | null;
  hostedInvoiceUrl?: string | null;
}) {
  const due = args.dueDate ? args.dueDate.toDateString() : "N/A";
  const link = args.hostedInvoiceUrl || "#";
  const subject = `[Action Required] Overdue invoice ${args.invoiceId} for ${args.orgName}`;

  const html = `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
    <h2>Payment overdue for ${args.orgName}</h2>
    <p>Invoice: <strong>${args.invoiceId}</strong></p>
    <p>Amount due: <strong>${args.amountDueFormatted}</strong></p>
    <p>Due date: ${due}</p>
    <p><a href="${link}">View invoice</a></p>
    <hr/>
    <p>If you’ve already paid, please ignore this message.</p>
  </div>
  `;

  return { subject, html };
}
