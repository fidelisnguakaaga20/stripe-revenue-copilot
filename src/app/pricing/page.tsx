import { getSessionUser } from '@lib/auth';
import { prisma } from '@lib/db';

export default async function PricingPage() {
  const user = await getSessionUser();
  let orgId: string | null = null;
  if (user) {
    const m = user.memberships[0];
    orgId = m?.organizationId ?? null;
  }

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Pricing</h1>
      <div>
        <h3>FREE</h3>
        <ul>
          <li>Core dashboard</li>
          <li>Manual sync</li>
          <li>Basic dunning (later)</li>
        </ul>
      </div>
      <hr />
      <div>
        <h3>PRO</h3>
        <ul>
          <li>Unlimited invoices</li>
          <li>Automated reconciliation</li>
          <li>Automated dunning + logs</li>
        </ul>

        {orgId ? (
          <form action={`/api/billing/checkout?orgId=${orgId}`} method="POST">
            <button type="submit">Upgrade to PRO</button>
          </form>
        ) : (
          <p><i>Login first to upgrade.</i></p>
        )}
      </div>
    </main>
  );
}
