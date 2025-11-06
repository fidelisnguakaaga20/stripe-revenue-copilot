import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";
import React from "react";

export const dynamic = "force-dynamic";

function fmtMoney(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
}
function agingDays(dueDate: Date | null): number | null {
  if (!dueDate) return null;
  const ms = Date.now() - dueDate.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
function bucket(days: number | null): string {
  if (days === null) return "n/a";
  if (days <= 30) return "0–30";
  if (days <= 60) return "31–60";
  if (days <= 90) return "61–90";
  return "90+";
}
function statusBadge(status: string) {
  const base: React.CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12, border: "1px solid #e5e7eb", background: "#f9fafb" };
  return <span style={base}>{status}</span>;
}

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  const org = user?.memberships?.[0]?.organization;
  if (!user || !org) {
    return (
      <main className="card">
        <h1 style={{ marginTop: 0 }}>Invoices</h1>
        <p>Please sign in, then ensure you belong to an organization.</p>
        <p><a href="/">Back to Home</a></p>
      </main>
    );
  }

  // Soft gating: FREE can browse, PRO gets everything (you can hard-gate if you want)
  const isPro = org.plan === "PRO";

  const sp = await searchParams;
  const page = Math.max(1, Number((sp.page as string) ?? 1));
  const limit = Math.min(50, Math.max(1, Number((sp.limit as string) ?? 10)));
  const status = ((sp.status as string) ?? "ALL").toUpperCase();
  const q = (sp.q as string | undefined)?.trim();

  const where: any = { organizationId: org.id };
  if (status !== "ALL") where.status = status;
  if (q) where.OR = [
    { stripeInvoiceId: { contains: q, mode: "insensitive" } },
    { currency: { contains: q, mode: "insensitive" } },
  ];

  const [total, rows] = await Promise.all([
    prisma.invoice.count({ where }),
    prisma.invoice.findMany({
      where,
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        stripeInvoiceId: true,
        currency: true,
        amountDue: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        periodStart: true,
        periodEnd: true,
        hostedInvoiceUrl: true,
        createdAt: true,
      },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / limit));

  const enriched = rows.map((r) => {
    const days = agingDays(r.dueDate);
    const overdue = days !== null && days > 0 && r.status !== "PAID" && r.status !== "VOID";
    const atRisk =
      r.status === "OPEN" &&
      r.dueDate !== null &&
      r.dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 &&
      r.dueDate.getTime() - Date.now() > 0;
    return { ...r, days, overdue, atRisk, bucket: bucket(days) };
  });

  const qs = (next: Partial<{ page: number; status: string; q: string }>) => {
    const p = new URLSearchParams();
    p.set("page", String(next.page ?? page));
    p.set("limit", String(limit));
    p.set("status", (next.status ?? status) as string);
    if (typeof (next.q ?? q) === "string" && (next.q ?? q)!.length)
      p.set("q", (next.q ?? q)!);
    return `/invoices?${p.toString()}`;
  };

  const statuses = ["ALL", "DRAFT", "OPEN", "PAID", "UNCOLLECTIBLE", "VOID", "CANCELED"];

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Invoices</h1>
      {!isPro && (
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
          You are on <b>FREE</b>. Some analytics are limited. <a href="/pricing">Upgrade to PRO</a>.
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        <form method="get" action="/invoices" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="hidden" name="limit" value={limit} />
          <select name="status" defaultValue={status} style={{ padding: 6 }}>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input name="q" defaultValue={q ?? ""} placeholder="Search id or currency" style={{ padding: 6, minWidth: 220 }} />
          <button type="submit">Filter</button>
        </form>
        <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
          <a href="/">Home</a>
          <a href="/analytics">Analytics</a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", fontWeight: 600, padding: "8px 0", borderBottom: "1px solid #eee" }}>
        <div>Invoice</div><div>Status</div><div>Amount</div><div>Paid</div><div>Due / Aging</div><div>Action</div>
      </div>

      {enriched.map((r) => (
        <div key={r.id} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", padding: "10px 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
          <div title={r.stripeInvoiceId}>{r.stripeInvoiceId.slice(0, 10)}…</div>
          <div>{statusBadge(r.status)}</div>
          <div>{fmtMoney(r.amountDue, r.currency)}</div>
          <div>{fmtMoney(r.amountPaid, r.currency)}</div>
          <div>
            {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : <i>n/a</i>}
            <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
              [{r.bucket}{r.days !== null ? ` (${r.days}d)` : ""}]
            </span>
            {r.overdue && <span style={{ marginLeft: 8, color: "#b91c1c", fontWeight: 600 }}>OVERDUE</span>}
            {!r.overdue && r.atRisk && <span style={{ marginLeft: 8, color: "#b45309", fontWeight: 600 }}>AT-RISK</span>}
          </div>
          <div>{r.hostedInvoiceUrl ? <a href={r.hostedInvoiceUrl} target="_blank">View</a> : <span style={{ opacity: 0.6 }}>—</span>}</div>
        </div>
      ))}

      <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
        <span>Page {page} of {pages} • {total} total</span>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={qs({ page: Math.max(1, page - 1) })}><button disabled={page === 1}>Previous</button></a>
          <a href={qs({ page: Math.min(pages, page + 1) })}><button disabled={page === pages}>Next</button></a>
        </div>
      </div>
    </main>
  );
}



// import { prisma } from "@lib/db";
// import { getSessionUser } from "@lib/auth";
// import React from "react";

// export const dynamic = "force-dynamic";

// function fmtMoney(cents: number, currency: string) {
//   return new Intl.NumberFormat(undefined, { style: "currency", currency: currency.toUpperCase() }).format((cents ?? 0) / 100);
// }
// function agingDays(dueDate: Date | null): number | null {
//   if (!dueDate) return null;
//   const ms = Date.now() - dueDate.getTime();
//   return Math.floor(ms / (1000 * 60 * 60 * 24));
// }
// function bucket(days: number | null): string {
//   if (days === null) return "n/a";
//   if (days <= 30) return "0–30";
//   if (days <= 60) return "31–60";
//   if (days <= 90) return "61–90";
//   return "90+";
// }
// function statusBadge(status: string) {
//   const base: React.CSSProperties = { padding: "2px 8px", borderRadius: 999, fontSize: 12, border: "1px solid #e5e7eb", background: "#f9fafb" };
//   return <span style={base}>{status}</span>;
// }

// export default async function InvoicesPage({
//   searchParams,
// }: {
//   searchParams: Promise<Record<string, string | string[] | undefined>>;
// }) {
//   const user = await getSessionUser();
//   const org = user?.memberships[0]?.organization;
//   if (!user || !org) {
//     return (
//       <main className="card">
//         <h1 style={{ marginTop: 0 }}>Invoices</h1>
//         <p>Please sign in, then ensure you belong to an organization.</p>
//         <p><a href="/">Back to Home</a></p>
//       </main>
//     );
//   }

//   const sp = await searchParams;
//   const page = Math.max(1, Number((sp.page as string) ?? 1));
//   const limit = Math.min(50, Math.max(1, Number((sp.limit as string) ?? 10)));
//   const status = ((sp.status as string) ?? "ALL").toUpperCase();
//   const q = (sp.q as string | undefined)?.trim();

//   const where: any = { organizationId: org.id };
//   if (status !== "ALL") where.status = status;
//   if (q) where.OR = [
//     { stripeInvoiceId: { contains: q, mode: "insensitive" } },
//     { currency: { contains: q, mode: "insensitive" } },
//   ];

//   const [total, rows] = await Promise.all([
//     prisma.invoice.count({ where }),
//     prisma.invoice.findMany({
//       where,
//       orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
//       skip: (page - 1) * limit,
//       take: limit,
//       select: {
//         id: true,
//         stripeInvoiceId: true,
//         currency: true,
//         amountDue: true,
//         amountPaid: true,
//         status: true,
//         dueDate: true,
//         periodStart: true,
//         periodEnd: true,
//         hostedInvoiceUrl: true,
//         createdAt: true,
//       },
//     }),
//   ]);

//   const pages = Math.max(1, Math.ceil(total / limit));

//   const enriched = rows.map((r) => {
//     const days = agingDays(r.dueDate);
//     const overdue = days !== null && days > 0 && r.status !== "PAID" && r.status !== "VOID";
//     const atRisk =
//       r.status === "OPEN" &&
//       r.dueDate !== null &&
//       r.dueDate.getTime() - Date.now() <= 7 * 24 * 60 * 60 * 1000 &&
//       r.dueDate.getTime() - Date.now() > 0;
//     return { ...r, days, overdue, atRisk, bucket: bucket(days) };
//   });

//   const qs = (next: Partial<{ page: number; status: string; q: string }>) => {
//     const p = new URLSearchParams();
//     p.set("page", String(next.page ?? page));
//     p.set("limit", String(limit));
//     p.set("status", (next.status ?? status) as string);
//     if (typeof (next.q ?? q) === "string" && (next.q ?? q)!.length)
//       p.set("q", (next.q ?? q)!);
//     return `/invoices?${p.toString()}`;
//   };

//   const statuses = ["ALL", "DRAFT", "OPEN", "PAID", "UNCOLLECTIBLE", "VOID", "CANCELED"];

//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Invoices</h1>

//       <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
//         <form method="get" action="/invoices" style={{ display: "flex", gap: 8, alignItems: "center" }}>
//           <input type="hidden" name="limit" value={limit} />
//           <select name="status" defaultValue={status} style={{ padding: 6 }}>
//             {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
//           </select>
//           <input name="q" defaultValue={q ?? ""} placeholder="Search id or currency" style={{ padding: 6, minWidth: 220 }} />
//           <button type="submit">Filter</button>
//         </form>

//         <div style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
//           <a href="/">Home</a>
//           <a href="/dashboard">Dashboard</a>
//         </div>
//       </div>

//       <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", fontWeight: 600, padding: "8px 0", borderBottom: "1px solid #eee" }}>
//         <div>Invoice</div><div>Status</div><div>Amount</div><div>Paid</div><div>Due / Aging</div><div>Action</div>
//       </div>

//       {enriched.map((r) => (
//         <div key={r.id} style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", padding: "10px 0", borderBottom: "1px solid #f1f5f9", alignItems: "center" }}>
//           <div title={r.stripeInvoiceId}>{r.stripeInvoiceId.slice(0, 10)}…</div>
//           <div>{statusBadge(r.status)}</div>
//           <div>{fmtMoney(r.amountDue, r.currency)}</div>
//           <div>{fmtMoney(r.amountPaid, r.currency)}</div>
//           <div>
//             {r.dueDate ? new Date(r.dueDate).toLocaleDateString() : <i>n/a</i>}
//             <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.8 }}>
//               [{r.bucket}{r.days !== null ? ` (${r.days}d)` : ""}]
//             </span>
//             {r.overdue && <span style={{ marginLeft: 8, color: "#b91c1c", fontWeight: 600 }}>OVERDUE</span>}
//             {!r.overdue && r.atRisk && <span style={{ marginLeft: 8, color: "#b45309", fontWeight: 600 }}>AT-RISK</span>}
//           </div>
//           <div>{r.hostedInvoiceUrl ? <a href={r.hostedInvoiceUrl} target="_blank">View</a> : <span style={{ opacity: 0.6 }}>—</span>}</div>
//         </div>
//       ))}

//       <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12 }}>
//         <span>Page {page} of {pages} • {total} total</span>
//         <div style={{ display: "flex", gap: 8 }}>
//           <a href={qs({ page: Math.max(1, page - 1) })}><button disabled={page === 1}>Previous</button></a>
//           <a href={qs({ page: Math.min(pages, page + 1) })}><button disabled={page === pages}>Next</button></a>
//         </div>
//       </div>
//     </main>
//   );
// }

