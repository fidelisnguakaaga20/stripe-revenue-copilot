export function upcomingTemplate(args: {
  orgName: string;
  invoiceId: string;
  amountDueFormatted: string;
  dueDate?: Date | null;
  hostedInvoiceUrl?: string | null;
}) {
  const due = args.dueDate ? args.dueDate.toDateString() : "N/A";
  const link = args.hostedInvoiceUrl || "#";
  const subject = `[Heads-up] Upcoming invoice ${args.invoiceId} for ${args.orgName}`;

  const html = `
  <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
    <h2>Upcoming invoice for ${args.orgName}</h2>
    <p>Invoice: <strong>${args.invoiceId}</strong></p>
    <p>Amount due: <strong>${args.amountDueFormatted}</strong></p>
    <p>Due date: ${due}</p>
    <p><a href="${link}">View invoice</a></p>
    <hr/>
    <p>This is a friendly reminder so payment can be made on time.</p>
  </div>
  `;

  return { subject, html };
}
