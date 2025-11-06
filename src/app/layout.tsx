import "./globals.css";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Stripe Revenue Copilot",
  description:
    "Multi-tenant finance SaaS: invoice tracking, reconciliation, and dunning.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  const org = user?.memberships?.[0]?.organization;

  return (
    <html lang="en">
      {/* ✔ proper mobile viewport */}
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <div className="container">
          <nav className="topnav">
            <a href="/" className="brand">
              Stripe Revenue Copilot
            </a>
            <span className="spacer" />
            <a className="navlink" href="/">Home</a>
            <a className="navlink" href="/invoices">Invoices</a>
            <a className="navlink" href="/analytics">Analytics</a>
            <a className="navlink" href="/audit">Audit</a>
            <a className="navlink" href="/pricing">Pricing</a>
            {!user ? (
              <a className="navlink" href="/login">Login</a>
            ) : (
              <>
                <span className="navmeta">
                  {org ? `${org.name} (${org.plan})` : user.email}
                </span>
                <a className="navlink" href="/api/dev-logout">Logout</a>
              </>
            )}
          </nav>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}


// import "./globals.css";
// import type { Metadata } from "next";
// import { getSessionUser } from "@/lib/auth";

// export const metadata: Metadata = {
//   title: "Stripe Revenue Copilot",
//   description:
//     "Multi-tenant finance SaaS: invoice tracking, reconciliation, and dunning.",
// };

// export default async function RootLayout({
//   children,
// }: {
//   children: React.ReactNode;
// }) {
//   const user = await getSessionUser();
//   const org = user?.memberships?.[0]?.organization;

//   return (
//     <html lang="en">
//       <body>
//         <div className="container">
//           <nav className="topnav">
//             <a href="/" className="brand">
//               Stripe Revenue Copilot
//             </a>
//             <span className="spacer" />
//             <a href="/">Home</a>
//             <a href="/invoices">Invoices</a>
//             <a href="/analytics">Analytics</a>
//             <a href="/audit">Audit</a>
//             <a href="/pricing">Pricing</a>
//             {!user ? (
//               <a href="/login">Login</a>
//             ) : (
//               <>
//                 <span style={{ opacity: 0.8, fontSize: 12 }}>
//                   {org ? `${org.name} (${org.plan})` : user.email}
//                 </span>
//                 <a href="/api/dev-logout">Logout</a>
//               </>
//             )}
//           </nav>
//           {children}
//         </div>
//       </body>
//     </html>
//   );
// }

