import { redirect } from "next/navigation";
import { getSessionUser } from "@lib/auth";
import "../globals.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  return (
    <html lang="en">
      <body>
        <div className="container">
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <a href="/" aria-label="Back to Home">🏠 Home</a> {/* ADDED */}
              <div><b>Signed in:</b> {user.email}</div>
              <a href="/api/dev-logout">Logout</a>
              <span style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
                <a href="/dashboard">Dashboard</a>
                <a href="/invoices">Invoices</a>
                <a href="/pricing">Pricing</a>
              </span>
            </div>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}


