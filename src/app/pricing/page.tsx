// src/app/pricing/page.tsx
import { getSessionUser } from "@lib/auth";
import GoogleSignInButton from "../../components/GoogleSignInButton";

export default async function PricingPage() {
  const user = await getSessionUser();
  const org = user?.memberships?.[0]?.organization;
  const orgId = org?.id ?? null;

  return (
    <section className="card">
      <h1 style={{ marginTop: 0 }}>Pricing</h1>

      {org && (
        <p style={{ marginTop: -6, marginBottom: 8 }}>
          Current plan: <b>{org.plan}</b>
        </p>
      )}

      <div className="grid gap-3 grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>FREE</h3>
          <ul>
            <li>Core dashboard</li>
            <li>Manual sync</li>
            <li>Basic dunning (limited)</li>
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>PRO</h3>
          <ul>
            <li>Unlimited invoices</li>
            <li>Automated reconciliation</li>
            <li>Automated dunning + logs</li>
          </ul>

          {orgId ? (
            <form action={`/api/billing/checkout?orgId=${orgId}`} method="POST" style={{ marginTop: 8 }}>
              <button type="submit" className="btn btn-primary">Upgrade to PRO</button>
            </form>
          ) : (
            <div style={{ marginTop: 8 }}>
              <p><i>Login first to upgrade.</i></p>
              <GoogleSignInButton />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}



// // src/app/pricing/page.tsx
// import { getSessionUser } from "@lib/auth"
// import GoogleSignInButton from "../../components/GoogleSignInButton"

// export default async function PricingPage() {
//   const user = await getSessionUser()
//   const org = user?.memberships?.[0]?.organization
//   const orgId = org?.id ?? null

//   return (
//     <main className="card">
//       <h1 style={{ marginTop: 0 }}>Pricing</h1>

//       {org && (
//         <p style={{ marginTop: -6, marginBottom: 8 }}>
//           Current plan: <b>{org.plan}</b>
//         </p>
//       )}

//       <div>
//         <h3>FREE</h3>
//         <ul>
//           <li>Core dashboard</li>
//           <li>Manual sync</li>
//           <li>Basic dunning (limited)</li>
//         </ul>
//       </div>

//       <hr />

//       <div>
//         <h3>PRO</h3>
//         <ul>
//           <li>Unlimited invoices</li>
//           <li>Automated reconciliation</li>
//           <li>Automated dunning + logs</li>
//         </ul>

//         {orgId ? (
//           <form action={`/api/billing/checkout?orgId=${orgId}`} method="POST">
//             <button type="submit">Upgrade to PRO</button>
//           </form>
//         ) : (
//           <div>
//             <p><i>Login first to upgrade.</i></p>
//             <GoogleSignInButton />
//           </div>
//         )}
//       </div>
//     </main>
//   )
// }


