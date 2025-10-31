import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stripe Revenue Copilot",
  description: "Multi-tenant finance SaaS: invoice tracking, reconciliation, and dunning."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
