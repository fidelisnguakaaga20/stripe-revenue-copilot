// src/app/billing/page.tsx
import { getSessionUser, userOrg } from "@lib/auth";
import { prisma } from "@lib/db";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getSessionUser();
  const org = userOrg(user);
  if (!user || !org) {
    return (
      <main className="card">
        <h1 style={{ marginTop: 0 }}>Billing</h1>
        <p>Please sign in and ensure you belong to an organization.</p>
      </main>
    );
  }

  const sub = await prisma.subscription.findFirst({
    where: { organizationId: org.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Billing</h1>
      <p>Org: <b>{org.name}</b> • Plan: <b>{org.plan}</b></p>
      <div className="card" style={{marginTop:12}}>
        <div>Status: <b>{sub?.status ?? "NONE"}</b> {sub?.cancelAtPeriodEnd ? "(cancels at period end)" : ""}</div>
        <div style={{display:"flex", gap:12, marginTop:10}}>
          <form action="/api/billing/cancel" method="post"><button type="submit">Cancel at period end</button></form>
          <form action="/api/billing/resume" method="post"><button type="submit">Resume (keep active)</button></form>
        </div>
      </div>
      <div style={{marginTop:12, display:"flex", gap:12}}>
        <a href="/pricing">Pricing</a>
        <a href="/analytics">Analytics</a>
        <a href="/invoices">Invoices</a>
      </div>
    </main>
  );
}
