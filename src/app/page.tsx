// src/app/page.tsx
import GoogleSignInButton from "../components/GoogleSignInButton";

export default function HomePage() {
  return (
    <section className="card">
      <h1 style={{ marginTop: 0 }}>Stripe Revenue Copilot</h1>
      <p>Simple finance ops for SaaS: invoices, analytics & dunning.</p>

      {/* actions row with mobile wrap */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <a className="btn" href="/invoices">Invoices</a>
        <a className="btn" href="/analytics">Analytics</a>
        <a className="btn" href="/pricing">Pricing</a>
        <span style={{ marginLeft: "auto" }}>
          <GoogleSignInButton />
        </span>
      </div>
    </section>
  );
}



// // src/app/page.tsx
// import GoogleSignInButton from "../components/GoogleSignInButton"

// export default function HomePage() {
//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Stripe Revenue Copilot</h1>
//       <p>Simple finance ops for SaaS: invoices, analytics & dunning.</p>
//       <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
//         <a href="/invoices">Invoices</a>
//         <a href="/analytics">Analytics</a>
//         <a href="/pricing">Pricing</a>
//         <span style={{ marginLeft: "auto" }}>
//           <GoogleSignInButton />
//         </span>
//       </div>
//       <ul style={{ marginTop: 12 }}>
//         {/* <li>Health: <a href="/api/health">/api/health</a></li>
//         <li>Stripe webhooks: <code>/api/webhooks/stripe</code></li> */}
//       </ul>
//     </main>
//   )
// }

