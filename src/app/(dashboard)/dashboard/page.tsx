import { prisma } from "@lib/db";
import { getSessionUser } from "@lib/auth";

export const dynamic = "force-dynamic";

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  const org = user?.memberships[0]?.organization;
  if (!user || !org) {
    return (
      <section className="card">
        <h1 style={{ marginTop: 0 }}>Dashboard</h1>
        <p>Please sign in and ensure you belong to an organization.</p>
      </section>
    );
  }

  const invoices = await prisma.invoice.findMany({
    where: { organizationId: org.id },
    select: { status: true, dueDate: true, amountDue: true, amountPaid: true, currency: true },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const now = new Date();

  let open = 0, paid = 0, overdue = 0, atRisk = 0, totalDue = 0, totalPaid = 0;
  for (const inv of invoices) {
    if (inv.status === "OPEN") open++;
    if (inv.status === "PAID") paid++;
    if (inv.amountDue) totalDue += inv.amountDue;
    if (inv.amountPaid) totalPaid += inv.amountPaid;

    const dd = inv.dueDate ? new Date(inv.dueDate) : null;
    const age = dd ? daysBetween(now, dd) : null; // positive => past due
    const isOverdue = age !== null && age > 0 && inv.status !== "PAID" && inv.status !== "VOID";
    const isAtRisk =
      inv.status === "OPEN" &&
      dd !== null &&
      dd.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 &&
      dd.getTime() - now.getTime() > 0;

    if (isOverdue) overdue++;
    if (!isOverdue && isAtRisk) atRisk++;
  }

  const fmt = (cents: number, currency = "USD") =>
    new Intl.NumberFormat(undefined, { style: "currency", currency }).format((cents ?? 0) / 100);

  return (
    <section className="card">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      <p style={{ marginTop: -8 }}>Org: <b>{org.name}</b> • Plan: <b>{org.plan}</b></p>

      {/* KPIs */}
      <div className="grid gap-3 grid-4">
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Open invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{open}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Overdue</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#b91c1c" }}>{overdue}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>At-risk (7d)</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#b45309" }}>{atRisk}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Paid invoices</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{paid}</div>
        </div>
      </div>

      {/* Totals */}
      <div className="grid gap-3 grid-2" style={{ marginTop: 12 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Total Billed</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(totalDue, invoices[0]?.currency ?? "USD")}</div>
        </div>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ opacity: 0.7, fontSize: 12 }}>Total Collected</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(totalPaid, invoices[0]?.currency ?? "USD")}</div>
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
        <a href="/invoices" className="btn">View invoices</a>
        <a href="/pricing" className="btn btn-primary">Upgrade</a>
      </div>
    </section>
  );
}



// import { prisma } from "@lib/db";
// import { getSessionUser } from "@lib/auth";

// export const dynamic = "force-dynamic";

// function daysBetween(a: Date, b: Date) {
//   return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
// }

// export default async function DashboardPage() {
//   const user = await getSessionUser();
//   const org = user?.memberships[0]?.organization;
//   if (!user || !org) {
//     return (
//       <main className="card">
//         <h1 style={{ marginTop: 0 }}>Dashboard</h1>
//         <p>Please sign in and ensure you belong to an organization.</p>
//       </main>
//     );
//   }

//   const invoices = await prisma.invoice.findMany({
//     where: { organizationId: org.id },
//     select: { status: true, dueDate: true, amountDue: true, amountPaid: true, currency: true },
//     orderBy: { createdAt: "desc" },
//     take: 500, // cap for speed
//   });

//   const now = new Date();

//   let open = 0, paid = 0, overdue = 0, atRisk = 0, totalDue = 0, totalPaid = 0;
//   for (const inv of invoices) {
//     if (inv.status === "OPEN") open++;
//     if (inv.status === "PAID") paid++;
//     if (inv.amountDue) totalDue += inv.amountDue;
//     if (inv.amountPaid) totalPaid += inv.amountPaid;

//     const dd = inv.dueDate ? new Date(inv.dueDate) : null;
//     const age = dd ? daysBetween(now, dd) : null; // positive => past due
//     const isOverdue = age !== null && age > 0 && inv.status !== "PAID" && inv.status !== "VOID";
//     const isAtRisk = inv.status === "OPEN" && dd !== null && dd.getTime() - now.getTime() <= 7 * 24 * 60 * 60 * 1000 && dd.getTime() - now.getTime() > 0;

//     if (isOverdue) overdue++;
//     if (!isOverdue && isAtRisk) atRisk++;
//   }

//   const fmt = (cents: number, currency = "USD") =>
//     new Intl.NumberFormat(undefined, { style: "currency", currency }).format((cents ?? 0) / 100);

//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Dashboard</h1>
//       <p style={{ marginTop: -8 }}>Org: <b>{org.name}</b> • Plan: <b>{org.plan}</b></p>

//       <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>Open invoices</div>
//           <div style={{ fontSize: 28, fontWeight: 700 }}>{open}</div>
//         </div>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>Overdue</div>
//           <div style={{ fontSize: 28, fontWeight: 700, color: "#b91c1c" }}>{overdue}</div>
//         </div>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>At-risk (7d)</div>
//           <div style={{ fontSize: 28, fontWeight: 700, color: "#b45309" }}>{atRisk}</div>
//         </div>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>Paid invoices</div>
//           <div style={{ fontSize: 28, fontWeight: 700 }}>{paid}</div>
//         </div>
//       </div>

//       <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12, marginTop: 12 }}>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>Total Billed</div>
//           <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(totalDue, invoices[0]?.currency ?? "USD")}</div>
//         </div>
//         <div className="card" style={{ padding: 16 }}>
//           <div style={{ opacity: 0.7, fontSize: 12 }}>Total Collected</div>
//           <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(totalPaid, invoices[0]?.currency ?? "USD")}</div>
//         </div>
//       </div>

//       <div style={{ marginTop: 16 }}>
//         <a href="/invoices"><button>View invoices</button></a>
//         <a href="/pricing" style={{ marginLeft: 8 }}><button>Upgrade</button></a>
//       </div>
//     </main>
//   );
// }
