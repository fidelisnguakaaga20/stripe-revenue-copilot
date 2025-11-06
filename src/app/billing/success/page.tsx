// src/app/billing/success/page.tsx
import { stripe } from '@lib/stripe';
type Search = { session_id?: string; orgId?: string };

export default async function BillingSuccessPage({ searchParams }: { searchParams: Promise<Search>; }) {
  const sp = await searchParams;
  const sessionId = sp.session_id;
  const orgId = sp.orgId;

  let status = 'PENDING';
  if (sessionId) {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
    if (subId) {
      const sub = await stripe.subscriptions.retrieve(subId);
      status = ['active', 'trialing', 'past_due'].includes(sub.status) ? 'ACTIVE' : 'PENDING';
    }
  }

  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Payment Success</h1>
      <p>Thanks! Your payment completed. Final status appears after our webhook processes the event.</p>
      <p>Subscription status (live): <b>{status}</b></p>
      <p style={{ display:"flex", gap:12 }}>
        <a href="/">Home</a>
        {orgId ? <a href="/billing">Manage billing</a> : <a href="/pricing">Back to pricing</a>}
      </p>
    </main>
  );
}


// import { stripe } from '@lib/stripe';

// type Search = { session_id?: string; orgId?: string };

// export default async function BillingSuccessPage({
//   searchParams,
// }: {
//   searchParams: Promise<Search>;
// }) {
//   const sp = await searchParams;
//   const sessionId = sp.session_id;
//   const orgId = sp.orgId;

//   // We do not write to DB here. Webhooks are the source of truth.
//   let status = 'PENDING';
//   if (sessionId) {
//     const session = await stripe.checkout.sessions.retrieve(sessionId);
//     const subId =
//       typeof session.subscription === 'string'
//         ? session.subscription
//         : session.subscription?.id;
//     if (subId) {
//       const sub = await stripe.subscriptions.retrieve(subId);
//       status = ['active', 'trialing', 'past_due'].includes(sub.status) ? 'ACTIVE' : 'PENDING';
//     }
//   }

//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Payment Success</h1>
//       <p>Thanks! Your payment completed. Final status will appear after our Stripe webhook processes the event.</p>
//       <p>Subscription status (live): <b>{status}</b></p>
//       <p style={{ display:"flex", gap:12 }}>
//         {/* ADDED: always offer a Home link */}
//         <a href="/">Home</a>
//         {orgId ? <a href="/dashboard">Go to dashboard</a> : <a href="/pricing">Back to pricing</a>}
//       </p>
//     </main>
//   );
// }

