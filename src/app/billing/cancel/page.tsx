// src/app/billing/cancel/page.tsx
export default function BillingCancelPage() {
  return (
    <main className="card">
      <h1 style={{ marginTop: 0 }}>Checkout Canceled</h1>
      <p>No charge was made. You can resume your purchase anytime.</p>
      <p style={{ display:"flex", gap:12 }}>
        <a href="/">Home</a>
        <a href="/pricing">Back to Pricing</a>
      </p>
    </main>
  );
}


// export default function BillingCancelPage() {
//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Checkout Canceled</h1>
//       <p>No charge was made. You can resume your purchase anytime.</p>
//       <p style={{ display:"flex", gap:12 }}>
//         <a href="/">Home</a> {/* ADDED: Home link */}
//         <a href="/pricing">Back to Pricing</a>
//       </p>
//     </main>
//   );
// }
