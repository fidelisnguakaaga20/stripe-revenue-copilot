// src/app/(dashboard)/dashboard/page.tsx
import { getSessionUser } from "@lib/auth";

export default async function DashboardPage() {
  const user = await getSessionUser();
  const orgs = user?.memberships.map((m) => m.organization) ?? [];
  const firstOrg = orgs[0];

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Dashboard</h1>
      {firstOrg && (
        <p>
          <b>Active org:</b> {firstOrg.name} — plan: {firstOrg.plan}{" "}
          {firstOrg.plan === "FREE" && <a href="/pricing">Upgrade to PRO</a>}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "8px 0 16px" }}>
        <a href="/invoices"><button>View Invoices</button></a>
        <a href="/pricing"><button>Pricing</button></a>
      </div>

      <p>Organizations you belong to:</p>
      <ul>
        {orgs.map((o) => (
          <li key={o.id}>
            <b>{o.name}</b> — plan: {o.plan}
          </li>
        ))}
        {orgs.length === 0 && <li>No organizations yet.</li>}
      </ul>
    </main>
  );
}
